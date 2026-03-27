import { task } from "@trigger.dev/sdk";
import { Sandbox } from "@e2b/code-interpreter";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { prisma } from "@/lib/db";
import { getPromptForProjectType, GPT52_CODE_AGENT_PROMPT, FRAGMENT_TITLE_PROMPT, RESPONSE_PROMPT, PLANNING_PROMPT } from "@/prompt";
import { SANDBOX_TIMEOUT } from "@/inngest/types";
import type { FigmaImportResult } from "@/lib/figma/types";
import Anthropic from "@anthropic-ai/sdk";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface GenerateCodePayload {
  projectId: string;
  value: string;
  model?: string;
  attachments?: Array<{ url: string; type: string; name: string; size: number }>;
  figmaData?: FigmaImportResult;
  smartDesignData?: { fileName: string; nodes: Record<string, unknown> | object[]; imageUrls: Record<string, string> };
}

export const generateCode = task({
  id: "generate-code",
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: GenerateCodePayload) => {
    const { projectId, value, attachments, figmaData, smartDesignData } = payload;

    console.log('🎯 Trigger.dev: Starting code generation');
    console.log('📦 Payload:', { projectId, hasAttachments: !!attachments, hasFigmaData: !!figmaData });

    // 1. Get project type
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { projectType: true, model: true },
    });

    const selectedModel = payload.model || project?.model || "gpt-5.2";
    const projectType = (project?.projectType as "web" | "mobile") || "web";
    const isMobile = projectType === "mobile";

    console.log(`🎯 Project type: ${projectType}`);

    // 🆕 ADD THIS SECTION HERE - Start planning message
    const planningPrompt = PLANNING_PROMPT
      .replace('{USER_REQUEST}', value)
      .replace('{PROJECT_TYPE}', projectType)
      .replace('{HAS_IMAGES}', (attachments && attachments.length > 0) ? 'Yes' : 'No')
      .replace('{HAS_FIGMA}', figmaData ? 'Yes' : 'No');

    // Start GPT-4o planning in parallel (don't await yet)
    const planResp = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: planningPrompt },
        { role: 'user', content: value }
      ],
      temperature: 0.7,
    });

    const planText = planResp.choices[0]?.message?.content?.trim() || "Building your project...";

    // Save initial thinking message
    await prisma.message.create({
      data: {
        projectId,
        content: planText,  // Placeholder, will update later
        role: "ASSISTANT",
        type: "RESULT",
      },
    });

    await prisma.message.create({
      data: {
        projectId,
        content: "BUILDING_CODE",
        role: "ASSISTANT",
        type: "RESULT",
      },
    });

    // 🆕 END OF NEW SECTION

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
      where: { projectId, NOT: { content: "BUILDING_CODE" } },
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

    // 4. Format messages for GPT-5.2 (inline, no helper)
    const formattedMessages = allMessages.map(msg => {
      const imageUrls = msg.attachments?.filter(a => a.type.startsWith('image/')).map(a => a.url) || [];

      if (imageUrls.length > 0) {
        return {
          role: msg.role === 'ASSISTANT' ? 'assistant' : 'user',
          content: [
            { type: 'text' as const, text: msg.content },
            ...imageUrls.map(url => ({
              type: 'image_url' as const,
              image_url: { url, detail: 'high' as const }
            }))
          ]
        };
      }

      return {
        role: msg.role === 'ASSISTANT' ? 'assistant' : 'user',
        content: msg.content
      };
    });

    // 5. Add Figma context if present
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

      formattedMessages.unshift({
        role: "user",
        content: figmaContext,
      });
    }

    // Smart Export context


    const systemPrompt = getPromptForProjectType(projectType) + "\n\n" + GPT52_CODE_AGENT_PROMPT;
    const currentFiles: Record<string, string> = {};

    // 6. Define tools
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

    // 7. GPT-5.2 DIRECT LOOP (no helper, all inline)
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...formattedMessages.map((msg): ChatCompletionMessageParam => {
        if (msg.role === 'user') {
          if (Array.isArray(msg.content)) {
            const contentParts = msg.content.map(part => {
              if (part.type === 'text') {
                return { type: 'text' as const, text: part.text || '' };
              } else if (part.type === 'image_url') {
                return {
                  type: 'image_url' as const,
                  image_url: { url: part.image_url?.url || '' }
                };
              }
              return { type: 'text' as const, text: '' };
            });
            return { role: 'user', content: contentParts };
          } else {
            return { role: 'user', content: msg.content };
          }
        } else {
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

    console.log('🤖 Starting GPT-5.2 direct loop');

    // Define Claude tools upfront so smart export loop can use them
    const claudeTools: Anthropic.Tool[] = isMobile ? [
      {
        name: "createOrUpdateFiles",
        description: "Create or update React Native files",
        input_schema: {
          type: "object" as const,
          properties: {
            files: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  content: { type: "string" },
                },
                required: ["path", "content"],
              },
            },
          },
          required: ["files"],
        },
      },
    ] : [
      {
        name: "terminal",
        description: "Run terminal commands",
        input_schema: {
          type: "object" as const,
          properties: { command: { type: "string" } },
          required: ["command"],
        },
      },
      {
        name: "createOrUpdateFiles",
        description: "Create or update files in Next.js sandbox",
        input_schema: {
          type: "object" as const,
          properties: {
            files: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  content: { type: "string" },
                },
                required: ["path", "content"],
              },
            },
          },
          required: ["files"],
        },
      },
      {
        name: "readFiles",
        description: "Read files from sandbox",
        input_schema: {
          type: "object" as const,
          properties: {
            files: { type: "array", items: { type: "string" } },
          },
          required: ["files"],
        },
      },
    ];


    // Smart Export
    if (smartDesignData) {
      const nodes = smartDesignData.nodes as Record<string, unknown>;
      const nodeEntries = Object.entries(nodes);

      // Process each section with a separate AI call — same project, same sandbox
      for (const [id, node] of nodeEntries) {
        const n = node as Record<string, unknown>;
        const sectionName = (n.name as string) || id;

        console.log(`🎨 Building section: ${sectionName}`);

        const sectionContext = `
SMART EXPORT - SECTION: ${sectionName}
File: ${smartDesignData.fileName}

Build ONLY this section as a React component named ${sectionName.replace(/\s+/g, '')}Section.
Use exact values from the node data — no approximations.

Real Image URLs:
${JSON.stringify(smartDesignData.imageUrls, null, 2)}

Node Data for this section:
${JSON.stringify(node, null, 2)}

Instructions:
- Create ONLY the ${sectionName} component
- Save it to components/${sectionName.replace(/\s+/g, '')}Section.tsx
- Use exact colors from fills rgba values
- Use exact font sizes and weights from text nodes
- Use exact padding and gap from layoutMode properties
- For any node that has an "imageUrl" field use that URL directly in img src or CSS background-image
- Do NOT use placeholder images — only use imageUrl values found in the node data
- Export as default
    `.trim();

        // Add section context as first message for this iteration
        const sectionMessages = [
          ...formattedMessages,
          { role: "user" as const, content: sectionContext }
        ];

        // Run AI for this section
        const sectionSystemPrompt = getPromptForProjectType(projectType) + "\n\n" + GPT52_CODE_AGENT_PROMPT;

        if (selectedModel === "claude-opus-4-6") {
          // Claude section call
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const claudeSectionMessages: Anthropic.MessageParam[] = sectionMessages.map(msg => ({
            role: msg.role === "ASSISTANT" ? "assistant" : "user",
            content: msg.content as string,
          }));

          let sectionDone = false;
          let sectionIterations = 0;

          while (!sectionDone && sectionIterations < 5) {
            sectionIterations++;
            const response = await anthropic.messages.create({
              model: "claude-opus-4-6",
              max_tokens: 8096,
              system: sectionSystemPrompt,
              tools: claudeTools,
              messages: claudeSectionMessages,
            });

            const assistantContent: Anthropic.ContentBlock[] = [];
            for (const block of response.content) {
              if (block.type === "text") {
                assistantContent.push(block);
                if (block.text.includes("<task_summary>")) sectionDone = true;
              } else if (block.type === "tool_use") {
                assistantContent.push(block);
              }
            }
            claudeSectionMessages.push({ role: "assistant", content: assistantContent });

            if (response.stop_reason === "tool_use") {
              const toolResults: Anthropic.ToolResultBlockParam[] = [];
              for (const block of response.content) {
                if (block.type !== "tool_use") continue;
                const { name, input, id: toolId } = block;
                let toolResult = "";
                if (name === "createOrUpdateFiles") {
                  const { files } = input as { files: { path: string; content: string }[] };
                  if (sandboxId) {
                    const sandbox = await Sandbox.connect(sandboxId);
                    await sandbox.setTimeout(SANDBOX_TIMEOUT);
                    for (const file of files) {
                      await sandbox.files.write(file.path, file.content);
                      currentFiles[file.path] = file.content;
                    }
                  }
                  toolResult = "Files created successfully";
                } else if (name === "terminal" && sandboxId) {
                  const { command } = input as { command: string };
                  const sandbox = await Sandbox.connect(sandboxId);
                  await sandbox.setTimeout(SANDBOX_TIMEOUT);
                  const result = await sandbox.commands.run(command);
                  toolResult = result.stdout;
                }
                toolResults.push({ type: "tool_result", tool_use_id: toolId, content: toolResult });
              }
              claudeSectionMessages.push({ role: "user", content: toolResults });
            }
          }

        } else {
          // GPT section call
          const sectionGptMessages: ChatCompletionMessageParam[] = [
            { role: 'system', content: sectionSystemPrompt },
            ...sectionMessages.map(msg => ({
              role: msg.role === 'ASSISTANT' ? 'assistant' as const : 'user' as const,
              content: msg.content as string,
            }))
          ];

          let sectionDone = false;
          let sectionIterations = 0;

          while (!sectionDone && sectionIterations < 5) {
            sectionIterations++;
            const response = await openai.chat.completions.create({
              model: selectedModel,
              messages: sectionGptMessages,
              tools,
              tool_choice: 'auto',
              temperature: 0.1,
            });

            const choice = response.choices[0];
            const message = choice.message;

            sectionGptMessages.push({
              role: 'assistant',
              content: message.content,
              tool_calls: message.tool_calls
            } as ChatCompletionMessageParam);

            if (message.content?.includes('<task_summary>')) {
              finalSummary = message.content;
              sectionDone = true;
            }

            if (message.tool_calls && message.tool_calls.length > 0) {
              for (const toolCall of message.tool_calls) {
                if (toolCall.type !== 'function') continue;
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                let toolResult = '';

                if (functionName === 'createOrUpdateFiles' && functionArgs.files) {
                  if (sandboxId) {
                    const sandbox = await Sandbox.connect(sandboxId);
                    await sandbox.setTimeout(SANDBOX_TIMEOUT);
                    for (const file of functionArgs.files) {
                      await sandbox.files.write(file.path, file.content);
                      currentFiles[file.path] = file.content;
                    }
                  }
                  toolResult = 'Files created successfully';
                } else if (functionName === 'terminal' && sandboxId && functionArgs.command) {
                  const sandbox = await Sandbox.connect(sandboxId);
                  await sandbox.setTimeout(SANDBOX_TIMEOUT);
                  const result = await sandbox.commands.run(functionArgs.command);
                  toolResult = result.stdout;
                }

                sectionGptMessages.push({
                  role: 'tool',
                  content: toolResult || 'Tool execution completed',
                  tool_call_id: toolCall.id
                } as ChatCompletionMessageParam);
              }
            } else {
              sectionDone = true;
            }
          }
        }

        console.log(`✅ Section ${sectionName} complete`);
      }

      // After all sections done, ask AI to assemble them
      const sectionComponents = nodeEntries.map(([id, node]) => {
        const n = node as Record<string, unknown>;
        return ((n.name as string) || id).replace(/\s+/g, '');
      });

      const pageContent = `"use client";
${sectionComponents.map(name => `import ${name}Section from '../components/${name}Section';`).join('\n')}

export default function Page() {
  return (
    <main>
      ${sectionComponents.map(name => `<${name}Section />`).join('\n      ')}
    </main>
  );
}`;

      const assembleContext = `
All sections have been built. Now write EXACTLY this content to app/page.tsx using createOrUpdateFiles:

${pageContent}

Use createOrUpdateFiles with path "app/page.tsx" and that exact content above.
`.trim();

      const assembleWithRefresh = assembleContext + `\n\nAfter writing the file, run this terminal command to ensure hot reload picks it up:\ntouch app/page.tsx`;

      messages.push({ role: 'user', content: assembleWithRefresh });
      finalSummary = `Built ${nodeEntries.length} sections and assembled into complete page.`;
    }


    if (selectedModel === "claude-opus-4-6") {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const claudeMessages: Anthropic.MessageParam[] = formattedMessages.map(msg => ({
        role: msg.role === "ASSISTANT" ? "assistant" : "user",
        content: Array.isArray(msg.content)
          ? msg.content.map((part: { type: string; text?: string; image_url?: { url: string } }) => {
            if (part.type === "text") return { type: "text" as const, text: part.text ?? "" };
            if (part.type === "image_url") return {
              type: "image" as const,
              source: { type: "url" as const, url: part.image_url?.url ?? "" },
            };
            return { type: "text" as const, text: "" };
          })
          : msg.content as string,
      }));

      let claudeIterations = 0;

      while (claudeIterations < maxIterations) {
        claudeIterations++;
        console.log(`🔄 Claude iteration ${claudeIterations}/${maxIterations}`);

        const response = await anthropic.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 8096,
          system: systemPrompt,
          tools: claudeTools,
          messages: claudeMessages,
        });

        console.log("✅ Claude API call successful");

        const assistantContent: Anthropic.ContentBlock[] = [];

        for (const block of response.content) {
          if (block.type === "text") {
            assistantContent.push(block);
            if (block.text.includes("<task_summary>")) {
              console.log("✅ Claude task complete");
              finalSummary = block.text;
            }
          } else if (block.type === "tool_use") {
            assistantContent.push(block);
          }
        }

        claudeMessages.push({ role: "assistant", content: assistantContent });

        if (finalSummary) break;

        if (response.stop_reason === "tool_use") {
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of response.content) {
            if (block.type !== "tool_use") continue;

            const { name, input, id } = block;
            let toolResult = "";

            console.log(`→ ${name}`);

            if (name === "createOrUpdateFiles") {
              const { files } = input as { files: { path: string; content: string }[] };
              if (!isMobile && sandboxId) {
                const sandbox = await Sandbox.connect(sandboxId);
                await sandbox.setTimeout(SANDBOX_TIMEOUT);
                for (const file of files) {
                  await sandbox.files.write(file.path, file.content);
                  currentFiles[file.path] = file.content;
                }
              } else {
                for (const file of files) {
                  currentFiles[file.path] = file.content;
                }
              }
              toolResult = "Files created successfully";
            } else if (name === "terminal" && sandboxId) {
              const { command } = input as { command: string };
              const sandbox = await Sandbox.connect(sandboxId);
              await sandbox.setTimeout(SANDBOX_TIMEOUT);
              const result = await sandbox.commands.run(command);
              toolResult = result.stdout;
            } else if (name === "readFiles" && sandboxId) {
              const { files } = input as { files: string[] };
              const sandbox = await Sandbox.connect(sandboxId);
              await sandbox.setTimeout(SANDBOX_TIMEOUT);
              const contents = [];
              for (const filePath of files) {
                const content = await sandbox.files.read(filePath);
                contents.push({ path: filePath, content });
              }
              toolResult = JSON.stringify(contents);
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: id,
              content: toolResult || "Tool execution completed",
            });
          }

          claudeMessages.push({ role: "user", content: toolResults });

        } else if (response.stop_reason === "end_turn" && !finalSummary) {
          console.log("⚠️ Claude stopped without task_summary, prompting to continue");
          claudeMessages.push({
            role: "user",
            content: "Continue with the task. Use the available tools and finish with a <task_summary>.",
          });
        }
      }

      console.log(`✅ Claude completed in ${claudeIterations} iterations`);

    } else {

      while (iterations < maxIterations) {
        iterations++;
        console.log(`🔄 Iteration ${iterations}/${maxIterations}`);

        // DIRECT GPT-5.2 CALL (no helper function)
        console.log('📡 Calling GPT-5.2 API directly...');
        const response = await openai.chat.completions.create({
          model: selectedModel,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.1,
        });

        console.log('✅ GPT-5.2 API call successful');

        const choice = response.choices[0];
        const message = choice.message;

        // Push assistant message
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

            // Execute tools directly (no callback)
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

            // Push tool result
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

      console.log(`✅ GPT-5.2 completed in ${iterations} iterations`);
      console.log(`📝 Files created: ${Object.keys(currentFiles).length}`);
    }

    // 8. Generate title and response with GPT-4o
    const [titleResp, responseResp] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: FRAGMENT_TITLE_PROMPT },  // ← Use imported prompt
          { role: 'user', content: finalSummary }
        ],
        temperature: 0.4,
      }),
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: RESPONSE_PROMPT },  // ← Use imported prompt
          { role: 'user', content: finalSummary }
        ],
        temperature: 0.4,
      }),
    ]);

    const fragmentTitle = titleResp.choices[0]?.message?.content?.trim() || "Fragment";
    const assistantText = responseResp.choices[0]?.message?.content?.trim() || "Here's what I built.";

    // 9. Get sandbox URL
    let sandboxUrl = "mobile-preview://ready";
    if (!isMobile && sandboxId) {
      const sandbox = await Sandbox.connect(sandboxId);
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      // Force hot reload
      try {
        const existing = await sandbox.files.read('app/page.tsx');
        await sandbox.files.write('app/page.tsx', existing);
      } catch {
        console.log('⚠️ Could not force refresh page.tsx — file may not exist yet');
      }
      const host = sandbox.getHost(3000);
      sandboxUrl = `https://${host}`;
    }

    // 10. Save to database
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
      await prisma.message.deleteMany({
        where: { projectId, content: "BUILDING_CODE" },
      });

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

    console.log('✅ Trigger.dev task completed');

    return {
      success: !isError,
      url: sandboxUrl,
      title: fragmentTitle,
      filesCount: Object.keys(currentFiles).length,
    };
  },
});