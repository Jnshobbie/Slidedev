import { task } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@e2b/code-interpreter";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { getPromptForProjectType, GPT52_CODE_AGENT_PROMPT } from "@/prompt";
import { formatMessagesForGPT5 } from "@/lib/gpt5-agent";
import { SANDBOX_TIMEOUT } from "@/inngest/types";
import type { FigmaImportResult } from "@/lib/figma/types";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface GenerateCodePayload {
  projectId: string;
  value: string;
  attachments?: Array<{ url: string; type: string; name: string; size: number }>;
  figmaData?: FigmaImportResult;
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

    // 5. Define tools with proper typing
    const tools: ChatCompletionTool[] = isMobile ? [
      {
        type: 'function' as const,
        function: {
          name: 'createOrUpdateFiles',
          description: 'Create or update React Native files',
          parameters: {
            type: 'object',
            properties: {
              files: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string' },
                    content: { type: 'string' }
                  },
                  required: ['path', 'content']
                }
              }
            },
            required: ['files']
          }
        }
      }
    ] : [
      {
        type: 'function' as const,
        function: {
          name: 'terminal',
          description: 'Run terminal commands',
          parameters: {
            type: 'object',
            properties: { command: { type: 'string' } },
            required: ['command']
          }
        }
      },
      {
        type: 'function' as const,
        function: {
          name: 'createOrUpdateFiles',
          description: 'Create or update files in Next.js sandbox',
          parameters: {
            type: 'object',
            properties: {
              files: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    path: { type: 'string' },
                    content: { type: 'string' }
                  },
                  required: ['path', 'content']
                }
              }
            },
            required: ['files']
          }
        }
      },
      {
        type: 'function' as const,
        function: {
          name: 'readFiles',
          description: 'Read files from sandbox',
          parameters: {
            type: 'object',
            properties: {
              files: { type: 'array', items: { type: 'string' } }
            },
            required: ['files']
          }
        }
      }
    ];

    // 6. GPT-5.2 agent loop with PROPER TYPES
const messages: ChatCompletionMessageParam[] = [
  { 
    role: 'system', 
    content: systemPrompt 
  },
  ...gpt5Messages.map((msg): ChatCompletionMessageParam => {
    // Handle user messages with potential images
    if (msg.role === 'user') {
      if (Array.isArray(msg.content)) {
        // Content is already an array of parts (text/image)
        // Map to proper OpenAI content part types
        const contentParts = msg.content.map(part => {
          if (part.type === 'text') {
            return {
              type: 'text' as const,
              text: part.text || ''  // ← Ensure text is always string
            };
          } else if (part.type === 'image_url') {
            return {
              type: 'image_url' as const,
              image_url: {
                url: part.image_url?.url || ''  // ← Ensure url is always string
              }
            };
          }
          // Fallback for unknown types
          return {
            type: 'text' as const,
            text: ''
          };
        });
        
        return {
          role: 'user',
          content: contentParts
        };
      } else {
        // Simple string content
        return {
          role: 'user',
          content: msg.content
        };
      }
    } 
    // Handle assistant messages
    else {
      return {
        role: 'assistant',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      };
    }
  })
];

    let iterations = 0;
    const maxIterations = 15;
    let finalSummary = '';

    console.log('🤖 Starting GPT-5.2 agent loop');

    while (iterations < maxIterations) {
      iterations++;
      console.log(`🔄 Iteration ${iterations}/${maxIterations}`);

      const response = await openai.chat.completions.create({
        model: 'gpt-5.2',
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.1,
      });

      const choice = response.choices[0];
      const message = choice.message;

      // Push assistant message with proper typing
      messages.push({
        role: 'assistant',
        content: message.content,
        tool_calls: message.tool_calls
      } as ChatCompletionMessageParam);

      // Check for completion
      if (message.content && typeof message.content === 'string' && message.content.includes('<task_summary>')) {
        console.log('✅ Task complete');
        finalSummary = message.content;
        break;
      }

      // Handle tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`🔧 Processing ${message.tool_calls.length} tool calls`);

        for (const toolCall of message.tool_calls) {
          if (toolCall.type !== 'function') continue;

          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          console.log(`→ ${functionName}`);

          let toolResult = '';

          // Execute tools
          if (functionName === 'createOrUpdateFiles' && functionArgs.files) {
            if (!isMobile && sandboxId) {
              const sandbox = await Sandbox.connect(sandboxId);
              await sandbox.setTimeout(SANDBOX_TIMEOUT);
              for (const file of functionArgs.files) {
                await sandbox.files.write(file.path, file.content);
                currentFiles[file.path] = file.content;
              }
            } else {
              for (const file of functionArgs.files) {
                currentFiles[file.path] = file.content;
              }
            }
            toolResult = 'Files created successfully';
          } else if (functionName === 'terminal' && sandboxId && functionArgs.command) {
            const sandbox = await Sandbox.connect(sandboxId);
            await sandbox.setTimeout(SANDBOX_TIMEOUT);
            const result = await sandbox.commands.run(functionArgs.command);
            toolResult = result.stdout;
          } else if (functionName === 'readFiles' && sandboxId && functionArgs.files) {
            const sandbox = await Sandbox.connect(sandboxId);
            await sandbox.setTimeout(SANDBOX_TIMEOUT);
            const contents = [];
            for (const filePath of functionArgs.files) {
              const content = await sandbox.files.read(filePath);
              contents.push({ path: filePath, content });
            }
            toolResult = JSON.stringify(contents);
          }

          // Push tool result with proper typing
          messages.push({
            role: 'tool',
            content: toolResult || 'Tool execution completed',
            tool_call_id: toolCall.id
          } as ChatCompletionMessageParam);
        }
      } else {
        console.log('⚠️ No tool calls, prompting to continue');
        messages.push({
          role: 'user',
          content: 'Continue with the task. Use the available tools.'
        });
      }

      if (choice.finish_reason === 'stop' && !message.tool_calls) {
        console.log('⚠️ Agent stopped without completing');
        break;
      }
    }

    console.log(`✅ Agent completed in ${iterations} iterations`);
    console.log(`📝 Files created: ${Object.keys(currentFiles).length}`);

    // 7. Generate title and response with GPT-4o
    const [titleResp, responseResp] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Generate a short title (max 5 words) for this code project.' },
          { role: 'user', content: finalSummary }
        ],
        temperature: 0.4,
      }),
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Generate a friendly response to the user explaining what you built.' },
          { role: 'user', content: finalSummary }
        ],
        temperature: 0.4,
      }),
    ]);

    const fragmentTitle = titleResp.choices[0]?.message?.content?.trim() || "Fragment";
    const assistantText = responseResp.choices[0]?.message?.content?.trim() || "Here's what I built.";

    // 8. Get sandbox URL
    let sandboxUrl = "mobile-preview://ready";
    if (!isMobile && sandboxId) {
      const sandbox = await Sandbox.connect(sandboxId);
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      const host = sandbox.getHost(3000);
      sandboxUrl = `https://${host}`;
    }

    // 9. Save to database
    const isError = !finalSummary || Object.keys(currentFiles).length === 0;

    if (isError) {
      await prisma.message.create({
        data: {
          projectId,
          content: "Something went wrong. Please try again.",
          role: "ASSISTANT",
          type: "ERROR",
        },
      });
    } else {
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
              files: currentFiles,
            },
          },
        },
      });
    }

    console.log('💾 Saved to database');

    return {
      success: !isError,
      url: sandboxUrl,
      title: fragmentTitle,
      filesCount: Object.keys(currentFiles).length,
    };
  },
}); 