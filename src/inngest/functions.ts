import { z } from "zod";
import { runGPT5Agent, formatMessagesForGPT5, type GPT5AgentContext } from "@/lib/gpt5-agent";
import { Sandbox } from "@e2b/code-interpreter";
import { openai, createAgent, createTool, createNetwork, type Tool, type Message, createState } from "@inngest/agent-kit";

import { 
  FRAGMENT_TITLE_PROMPT, 
  RESPONSE_PROMPT, 
  getPromptForProjectType,
  GPT52_CODE_AGENT_PROMPT 
} from "@/prompt";
import { prisma } from "@/lib/db";

import { inngest } from "./client";
import { getSandbox, lastAssistantTextMessageContent, parseAgentOutput } from "./utils";
import { SANDBOX_TIMEOUT } from "./types";
import type { FigmaImportResult } from "@/lib/figma/types";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
}

/**
 * Extracts dependencies from AI output
 * Looks for <required_dependencies>...</required_dependencies> tags
 */
function extractDependencies(summary: string): Record<string, string> {
  try {
    const match = summary.match(/<required_dependencies>([\s\S]*?)<\/required_dependencies>/);
    if (!match) {
      console.log('⚠️ No dependencies found in summary');
      return {};
    }

    const depsJson = match[1].trim();
    const dependencies = JSON.parse(depsJson);

    console.log('📦 Extracted dependencies:', dependencies);
    return dependencies;
  } catch (error) {
    console.error('❌ Failed to parse dependencies:', error);
    return {};
  }
}

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    // Get Figma data if present
    const figmaData = event.data.figmaData as FigmaImportResult | undefined;

    // Get project type from database
    const project = await step.run("get-project", async () => {
      return await prisma.project.findUnique({
        where: { id: event.data.projectId },
        select: { projectType: true },
      });
    });

    const projectType = (project?.projectType as "web" | "mobile") || "web";
    const isMobile = projectType === "mobile";

    console.log(`🎯 Project type: ${projectType}, isMobile: ${isMobile}`);
    if (figmaData) {
      console.log(`🎨 Figma data present: ${figmaData.fileName}`);
    }

    // Only create E2B sandbox for web projects
    const sandboxId = !isMobile ? await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("slide-nextjs-test-1");
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      return sandbox.sandboxId;
    }) : null;

    // Get previous messages from database
const dbMessages = await step.run("get-previous-messages", async () => {
  return await prisma.message.findMany({
    where: { projectId: event.data.projectId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
});

// Format ALL messages (including current one) for GPT-5.2
const allMessages = [
  ...dbMessages.reverse().map(msg => ({
    role: msg.role,
    content: msg.content,
    attachments: msg.attachments as Array<{ url: string; type: string; name: string; size: number }> | undefined
  })),
  // Add current message with its attachments
  {
    role: 'USER' as const,
    content: event.data.value,
    attachments: event.data.attachments as Array<{ url: string; type: string; name: string; size: number }> | undefined
  }
];

const gpt5Messages = formatMessagesForGPT5(allMessages);

// Add Figma context if present (at the beginning)
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
${Object.keys(figmaData.components).map(name => `- ${name}`).join('\n')}

Component Code Reference:
${Object.entries(figmaData.components).map(([name, code]) => `
=== ${name} ===
${code}
`).join('\n')}
      `.trim();

  gpt5Messages.unshift({
    role: 'user',
    content: figmaContext
  });
}

    // Get the correct prompt for project type
    const codePrompt = getPromptForProjectType(projectType) + '\n\n' + GPT52_CODE_AGENT_PROMPT;

    console.log(`🚀 Delegating to GPT-5.2 agent (${isMobile ? 'mobile' : 'web'} mode)`);

    // Run GPT-5.2 agent with tool callback
const gpt5Result = await step.run("run-gpt5-agent", async () => {
  const currentFiles: Record<string, string> = {}; // ✅ const instead of let

  const result = await runGPT5Agent(
    {
      projectType,
      messages: gpt5Messages,
      systemPrompt: codePrompt,
      currentFiles,
      sandboxId: sandboxId || undefined
    },
    // Tool callback - executes tools via Inngest step.run
    async (toolName: string, args: { files?: Array<{ path: string; content: string }>; command?: string }) => { // ✅ Typed args
      if (toolName === 'createOrUpdateFiles' && !isMobile && sandboxId) {
        // Web: Create files in E2B sandbox
        const sandbox = await getSandbox(sandboxId);
        if (args.files) {
          for (const file of args.files) {
            await sandbox.files.write(file.path, file.content);
            currentFiles[file.path] = file.content;
            console.log(`📝 Created file: ${file.path}`);
          }
        }
        return 'Files created successfully';
      } else if (toolName === 'createOrUpdateFiles' && isMobile) {
        // Mobile: Store files in memory
        if (args.files) {
          for (const file of args.files) {
            currentFiles[file.path] = file.content;
            console.log(`📱 Created mobile file: ${file.path}`);
          }
        }
        return 'Files created successfully';
      } else if (toolName === 'terminal' && sandboxId && args.command) {
        // Web: Execute terminal command
        const sandbox = await getSandbox(sandboxId);
        const buffers = { stdout: '', stderr: '' };
        try {
          const result = await sandbox.commands.run(args.command, {
            onStdout: (data: string) => { buffers.stdout += data; },
            onStderr: (data: string) => { buffers.stderr += data; }
          });
          console.log(`💻 Terminal: ${args.command} → ${result.stdout}`);
          return result.stdout;
        } catch (e) {
          console.error(`❌ Terminal error: ${e}`);
          return `Error: ${e}\nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
        }
      } else if (toolName === 'readFiles' && sandboxId && args.files) {
        // Web: Read files from sandbox
        const sandbox = await getSandbox(sandboxId);
        const contents = [];
        for (const file of args.files) {
          const content = await sandbox.files.read(file.path);
          contents.push({ path: file.path, content });
        }
        return JSON.stringify(contents);
      }
      return 'Tool not available';
    }
  );

  return result;
});

    console.log(`✅ GPT-5.2 completed with ${Object.keys(gpt5Result.files).length} files`);

    // Generate fragment title
    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({ model: "gpt-4o" }),
    });

    // Generate user-facing response
    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: openai({ model: "gpt-4o" }),
    });

    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(gpt5Result.summary);
    const { output: responseOutput } = await responseGenerator.run(gpt5Result.summary);

    const isError = !gpt5Result.summary || Object.keys(gpt5Result.files || {}).length === 0;

    // Get sandbox URL
    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      if (isMobile) {
        console.log("📱 Mobile project - code will be handled client-side");
        return "mobile-preview://ready";
      } else {
        console.log("🌐 Creating E2B sandbox URL...");
        const sandbox = await getSandbox(sandboxId!);
        const host = sandbox.getHost(3000);
        return `https://${host}`;
      }
    });

    // Save to database
    await step.run("save-result", async () => {
      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "something's went wrong. please try again.",
            role: "ASSISTANT",
            type: "ERROR",
          },
        });
      }

      // Extract dependencies for mobile
      const dependencies = isMobile ? extractDependencies(gpt5Result.summary) : null;

      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: parseAgentOutput(responseOutput),
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: parseAgentOutput(fragmentTitleOutput),
              files: gpt5Result.files,
              dependencies: dependencies || undefined,
            }
          }
        },
      });
    });

    return {
      url: sandboxUrl,
      title: parseAgentOutput(fragmentTitleOutput),
      files: gpt5Result.files,
      summary: gpt5Result.summary,
    };
  },
);