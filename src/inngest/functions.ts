import { z } from "zod"; 
import { Sandbox } from "@e2b/code-interpreter"; 
import { openai, createAgent, createTool, createNetwork, type Tool, type Message, createState } from "@inngest/agent-kit"; 

import { FRAGMENT_TITLE_PROMPT, RESPONSE_PROMPT, getPromptForProjectType } from "@/prompt";
import { prisma } from "@/lib/db"; 

import { inngest } from "./client";
import { getSandbox, lastAssistantTextMessageContent, parseAgentOutput } from "./utils";
import { SANDBOX_TIMEOUT } from "./types"; 

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

    // Only create E2B sandbox for web projects
    const sandboxId = !isMobile ? await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("slide-nextjs-test-1"); 
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      return sandbox.sandboxId; 
    }) : null;

    const previousMessages = await step.run("get-previous-messages", async () => {
      const formattedMessages: Message[] = [];

      const messages = await prisma.message.findMany({
        where: {
          projectId: event.data.projectId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      });

      for (const message of messages) {
        // Parse attachments from JSON
        const attachments = message.attachments as Array<{
          url: string;
          name: string;
          size: number;
          type: string;
        }> | null;

        // Filter for images only
        const imageUrls = attachments?.filter(a => a.type.startsWith('image/')).map(a => a.url) || [];

        if (imageUrls.length > 0) {
          // Message with images - format for GPT-4 vision
          console.log(`📸 Message ${message.id} has ${imageUrls.length} image(s)`);
          
          formattedMessages.push({
            type: "text",
            role: message.role === "ASSISTANT" ? "assistant" : "user",
            content: [
              { 
                type: "text", 
                text: message.content 
              },
              ...imageUrls.map(url => ({
                type: "image_url" as const,
                image_url: { 
                  url,
                  detail: "high" as const // Use "high" for better image analysis
                }
              }))
            ]
          } as Message);
        } else {
          // Regular text message (no images)
          formattedMessages.push({
            type: "text",
            role: message.role === "ASSISTANT" ? "assistant" : "user",
            content: message.content,
          });
        }
      }

      return formattedMessages.reverse();
    });

    const state = createState<AgentState>(
      {
        summary: "",
        files: {}, 
      },
      {
        messages: previousMessages,
      },
    );

    // 🎯 NEW: Pass user message for smart prompt detection
    const userMessage = event.data.value;
    const systemPrompt = getPromptForProjectType(projectType, userMessage);
    
    // Log which style is being used
    if (projectType === 'web') {
      const isLandingPage = userMessage.toLowerCase().includes('landing') || 
                           userMessage.toLowerCase().includes('homepage') ||
                           userMessage.toLowerCase().includes('marketing');
      const isDashboard = userMessage.toLowerCase().includes('dashboard') || 
                         userMessage.toLowerCase().includes('admin') ||
                         userMessage.toLowerCase().includes('workspace');
      
      if (isLandingPage) {
        console.log('🎨 Using MARKETING/LANDING PAGE patterns (gradients, flashy)');
      } else if (isDashboard) {
        console.log('💼 Using WORKSPACE/DASHBOARD patterns (professional, neutral)');
      } else {
        console.log('💼 Using default WORKSPACE patterns');
      }
    } else {
      console.log('📱 Using MOBILE patterns (clean, no gradients)');
    }

    const codeAgent = createAgent<AgentState>({
      name: isMobile ? "mobile-code-agent" : "code-agent",
      description: isMobile ? "An expert mobile app coding agent" : "An expert coding agent",
      system: systemPrompt,
      model: openai({ 
        model: "gpt-4o", // Changed from gpt-4.1 to support vision
        defaultParameters: {
          temperature: 0.1, 
        }, 
      }),
      tools: isMobile ? [
        // Mobile: Only file creation (no E2B sandbox)
        createTool({
          name: "createOrUpdateFiles", 
          description: "Create or update React Native files for the mobile app", 
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(), 
                content: z.string(), 
              }),
            ),
          }),
          handler: async (
            { files }, 
            { step, network }: Tool.Options<AgentState>
          ) => {
            const updatedFiles = await step?.run("createOrUpdateFiles", async () => {
              const currentFiles = network.state.data.files || {};
              for (const file of files) {
                console.log(`📱 Creating mobile file: ${file.path}`);
                currentFiles[file.path] = file.content;
              }
              return currentFiles;
            });
            
            // CRITICAL: Update the network state with the new files
            if (updatedFiles && typeof updatedFiles === "object") {
              network.state.data.files = updatedFiles;
            }
          }
        }),
      ] : [
        // Web: Full E2B tools (terminal, file operations)
        createTool({
          name: "terminal", 
          description: "Use the terminal to run commands", 
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = { stdout: "", stderr: ""};

              try {
                const sandbox = await getSandbox(sandboxId!);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data;
                  }
                });
                return result.stdout;
              } catch (e) {
                console.error( 
                  `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`,
                );
                return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
              }
            });
          },
        }),
        createTool({
          name: "createOrUpdateFiles", 
          description: "Create or update files in the Next.js sandbox", 
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(), 
                content: z.string(), 
              }),
            ),
          }),
          handler: async (
            { files }, 
            { step, network}: Tool.Options<AgentState>
          ) =>  {
            const newFiles = await step?.run("createOrUpdateFiles", async() => {
              try {
                const updatedFiles = network.state.data.files || {};
                const sandbox = await getSandbox(sandboxId!);
                for (const file of files) {
                  await sandbox.files.write(file.path, file.content); 
                  updatedFiles[file.path] = file.content;
                } 

                return updatedFiles;
              } catch (e) {
                return "Error: " + e;
              }
            });

            if (typeof newFiles === "object") {
              network.state.data.files = newFiles;
            }
          }
        }),
        createTool({
          name: "readFiles", 
          description: "Read files from the Next.js sandbox", 
          parameters: z.object({
            files: z.array(z.string()), 
          }), 
          handler: async ({ files }, { step }) => {
            return await step?.run("readFiles", async () => {
              try {
                const sandbox = await getSandbox(sandboxId!);
                const contents = [];
                for (const file of files) {
                  const content = await sandbox.files.read(file); 
                  contents.push({ path: file, content });
                }
                return JSON.stringify(contents);
              } catch (e) {
                return "Error: " + e;
              }
            }) 
          },
        })
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText = 
          lastAssistantTextMessageContent(result); 

          if (lastAssistantMessageText && network) {
            if (lastAssistantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantMessageText;
            }
          }

          return result;
        },
      }, 
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network", 
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state,
      router: async ({ network }) => {
        const summary = network.state.data.summary; 

        if (summary) {
          return;
        }

        return codeAgent;
      },
    });

    const result = await network.run(event.data.value, { state }); 

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: openai({ 
        model: "gpt-4o", 
      }),
    })

    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: openai({ 
        model: "gpt-4o", 
      }),
    })

    const { 
      output: fragmentTitleOutput 
    } = await fragmentTitleGenerator.run(result.state.data.summary);
    const { 
      output: responseOutput 
    } = await responseGenerator.run(result.state.data.summary);

    const isError = 
      !result.state.data.summary || 
      Object.keys(result.state.data.files || {}).length === 0; 

    // Get sandbox URL based on project type
    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      if (isMobile) {
        // For mobile: Just return a marker indicating it's a mobile project
        // The frontend will create the Snack client-side
        console.log("📱 Mobile project - code will be handled client-side");
        return "mobile-preview://ready";
      } else {
        // Web project - use E2B sandbox
        console.log("🌐 Creating E2B sandbox URL...");
        const sandbox = await getSandbox(sandboxId!); 
        const host = sandbox.getHost(3000);
        return `https://${host}`;
      }
    });

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
      
      // Extract dependencies from summary (for mobile projects)
      const dependencies = isMobile ? extractDependencies(result.state.data.summary) : null;
      
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
              files: result.state.data.files,
              dependencies: dependencies || undefined, // Save dependencies for mobile
            }
          }
        },
      })
    });
 
    return { 
      url: sandboxUrl,
      title: "Fragment", 
      files: result.state.data.files, 
      summary: result.state.data.summary,  
    };
  },
);