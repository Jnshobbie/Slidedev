import { task } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@e2b/code-interpreter";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { getPromptForProjectType, GPT52_CODE_AGENT_PROMPT } from "@/prompt";
import { formatMessagesForGPT5, runGPT5Agent } from "@/lib/gpt5-agent";
import { SANDBOX_TIMEOUT } from "@/inngest/types";
import type { FigmaImportResult } from "@/lib/figma/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface GenerateCodePayload {
  projectId: string;
  value: string;
  attachments?: Array<{ url: string; type: string; name: string; size: number }>;
  figmaData?: FigmaImportResult;
}

// Tool argument types
interface CreateOrUpdateFilesArgs {
  files: Array<{ path: string; content: string }>;
}

interface TerminalArgs {
  command: string;
}

interface ReadFilesArgs {
  files: string[];
}

export const generateCode = task({
  id: "generate-code",
  maxDuration: 300, // 5 minutes max
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: GenerateCodePayload) => {
    const { projectId, value, attachments, figmaData } = payload;

    console.log('🎯 Trigger.dev: Starting code generation');
    console.log('📦 Payload:', { projectId, hasAttachments: !!attachments, hasFigmaData: !!figmaData });

    // 1. Get project type
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { projectType: true },
    });

    const projectType = (project?.projectType as "web" | "mobile") || "web";
    const isMobile = projectType === "mobile";

    console.log(`🎯 Project type: ${projectType}`);

    // 2. Create sandbox for web projects
    let sandboxId: string | null = null;
    if (!isMobile) {
      const sandbox = await Sandbox.create("slide-nextjs-test-1");
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      sandboxId = sandbox.sandboxId;
      console.log(`🖥️ Sandbox created: ${sandboxId}`);
    }

    // 3. Get previous messages
    const dbMessages = await prisma.message.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const allMessages = [
      ...dbMessages.reverse().map((msg) => ({
        role: msg.role,
        content: msg.content,
        attachments: msg.attachments as typeof attachments,
      })),
      {
        role: "USER" as const,
        content: value,
        attachments,
      },
    ];

    const gpt5Messages = formatMessagesForGPT5(allMessages);

    // 4. Add Figma context if present
    if (figmaData) {
      const figmaContext = `
FIGMA DESIGN IMPORTED:
File: ${figmaData.fileName}

Design System Tokens:
Colors: ${JSON.stringify(figmaData.designSystem.colors, null, 2)}
Typography: ${JSON.stringify(figmaData.designSystem.typography, null, 2)}
Spacing: ${JSON.stringify(figmaData.designSystem.spacing, null, 2)}

Tailwind Config:
${JSON.stringify(figmaData.tailwindConfig, null, 2)}

Component Files Extracted:
${Object.keys(figmaData.components).map((name) => `- ${name}`).join("\n")}
      `.trim();

      gpt5Messages.unshift({
        role: "user",
        content: figmaContext,
      });
    }

    const systemPrompt = getPromptForProjectType(projectType) + "\n\n" + GPT52_CODE_AGENT_PROMPT;
    const currentFiles: Record<string, string> = {};

    // 5. Run GPT-5.2 agent with tool callback
    console.log('🤖 Starting GPT-5.2 agent');
    
    const gpt5Result = await runGPT5Agent(
      {
        projectType,
        messages: gpt5Messages,
        systemPrompt,
        currentFiles,
        sandboxId: sandboxId || undefined,
      },
      // Tool execution callback with proper typing
      async (toolName: string, args: Record<string, unknown>): Promise<string> => {
        console.log(`🔧 Executing tool: ${toolName}`);
        
        // Type guard for createOrUpdateFiles
        if (toolName === "createOrUpdateFiles" && "files" in args) {
          const typedArgs = args as unknown as CreateOrUpdateFilesArgs;
          const files = typedArgs.files;
          
          if (!isMobile && sandboxId) {
            // Web: Write to E2B sandbox
            const sandbox = await Sandbox.connect(sandboxId);
            await sandbox.setTimeout(SANDBOX_TIMEOUT);
            for (const file of files) {
              await sandbox.files.write(file.path, file.content);
              currentFiles[file.path] = file.content;
              console.log(`  ✓ Wrote to sandbox: ${file.path}`);
            }
          } else {
            // Mobile: Store in memory
            for (const file of files) {
              currentFiles[file.path] = file.content;
              console.log(`  ✓ Stored in memory: ${file.path}`);
            }
          }
          return "Files created successfully";
        } 
        
        // Type guard for terminal
        else if (toolName === "terminal" && "command" in args && sandboxId) {
          const typedArgs = args as unknown as TerminalArgs;
          const sandbox = await Sandbox.connect(sandboxId);
          await sandbox.setTimeout(SANDBOX_TIMEOUT);
          const result = await sandbox.commands.run(typedArgs.command);
          console.log(`  ✓ Terminal: ${typedArgs.command}`);
          console.log(`  → ${result.stdout}`);
          return result.stdout;
        } 
        
        // Type guard for readFiles
        else if (toolName === "readFiles" && "files" in args && sandboxId) {
          const typedArgs = args as unknown as ReadFilesArgs;
          const sandbox = await Sandbox.connect(sandboxId);
          await sandbox.setTimeout(SANDBOX_TIMEOUT);
          const contents: Array<{ path: string; content: string }> = [];
          for (const filePath of typedArgs.files) {
            const content = await sandbox.files.read(filePath);
            contents.push({ path: filePath, content });
            console.log(`  ✓ Read from sandbox: ${filePath}`);
          }
          return JSON.stringify(contents);
        }

        console.log(`  ⚠️ Tool not available: ${toolName}`);
        return "Tool not available";
      }
    );

    console.log(`✅ GPT-5.2 agent completed`);
    console.log(`📝 Files created: ${Object.keys(gpt5Result.files).length}`);

    // 6. Generate title and response with GPT-4o
    console.log('💬 Generating user-facing response with GPT-4o');
    
    const [titleResp, responseResp] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Generate a short title (max 5 words) for this code project.' },
          { role: 'user', content: gpt5Result.summary }
        ],
        temperature: 0.4,
      }),
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Generate a friendly response to the user explaining what you built.' },
          { role: 'user', content: gpt5Result.summary }
        ],
        temperature: 0.4,
      }),
    ]);

    const fragmentTitle = titleResp.choices[0]?.message?.content?.trim() || "Fragment";
    const assistantText = responseResp.choices[0]?.message?.content?.trim() || "Here's what I built.";

    // 7. Get sandbox URL
    let sandboxUrl = "mobile-preview://ready";
    if (!isMobile && sandboxId) {
      const sandbox = await Sandbox.connect(sandboxId);
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      const host = sandbox.getHost(3000);
      sandboxUrl = `https://${host}`;
      console.log(`🌐 Sandbox URL: ${sandboxUrl}`);
    }

    // 8. Save to database
    const isError = !gpt5Result.summary || Object.keys(gpt5Result.files).length === 0;

    if (isError) {
      console.log('❌ Task failed - no summary or files');
      await prisma.message.create({
        data: {
          projectId,
          content: "Something went wrong. Please try again.",
          role: "ASSISTANT",
          type: "ERROR",
        },
      });
    } else {
      console.log('💾 Saving results to database');
      await prisma.message.create({
        data: {
          projectId,
          content: assistantText,
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl,
              title: fragmentTitle,
              files: gpt5Result.files,
            },
          },
        },
      });
    }

    console.log('✅ Trigger.dev task completed');

    return {
      success: !isError,
      url: sandboxUrl,
      title: fragmentTitle,
      filesCount: Object.keys(gpt5Result.files).length,
    };
  },
});