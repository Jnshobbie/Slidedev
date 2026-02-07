import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GPT5Message {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
      detail?: 'low' | 'high' | 'auto';
    };
  }>;
}

export interface GPT5AgentContext {
  projectType: 'web' | 'mobile';
  messages: GPT5Message[];
  systemPrompt: string;
  currentFiles: Record<string, string>;
  sandboxId?: string;
}

export interface GPT5ToolCall {
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface GPT5AgentResult {
  summary: string;
  files: Record<string, string>;
  toolCalls: GPT5ToolCall[];
  rawResponse: string;
}

/**
 * GPT-5.2 Agent with vision and tool calling capabilities
 * This agent handles all code generation with access to images
 */
export async function runGPT5Agent(
  context: GPT5AgentContext,
  onToolCall?: (toolName: string, args: Record<string, unknown>) => Promise<string>
): Promise<GPT5AgentResult> {
  const { projectType, messages, systemPrompt, currentFiles } = context;
  const isMobile = projectType === 'mobile';

  // Define tools based on project type
  const tools: ChatCompletionTool[] = isMobile ? [
    {
      type: 'function',
      function: {
        name: 'createOrUpdateFiles',
        description: 'Create or update React Native files for the mobile app',
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
      type: 'function',
      function: {
        name: 'terminal',
        description: 'Use the terminal to run commands',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string' }
          },
          required: ['command']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'createOrUpdateFiles',
        description: 'Create or update files in the Next.js sandbox',
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
      type: 'function',
      function: {
        name: 'readFiles',
        description: 'Read files from the Next.js sandbox',
        parameters: {
          type: 'object',
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          required: ['files']
        }
      }
    }
  ];

  // Prepare messages for GPT-5.2
  const gpt5Messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: systemPrompt
    },
    ...messages.map(msg => ({
      role: msg.role,
      content: msg.content
    } as ChatCompletionMessageParam))
  ];

  const files = { ...currentFiles };
  let iterations = 0;
  const maxIterations = 15;
  let finalSummary = '';

  console.log(`🤖 Starting GPT-5.2 agent (${isMobile ? 'mobile' : 'web'} mode)`);

  while (iterations < maxIterations) {
    iterations++;
    console.log(`🔄 GPT-5.2 iteration ${iterations}/${maxIterations}`);

    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: gpt5Messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.1,
    });

    const choice = response.choices[0];
    const message = choice.message;

    // Add assistant response to conversation
    gpt5Messages.push(message);

    // Check if task is complete (has <task_summary>)
    if (message.content && message.content.includes('<task_summary>')) {
      console.log('✅ GPT-5.2 task complete');
      finalSummary = message.content;
      break;
    }

    // Handle tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`🔧 Processing ${message.tool_calls.length} tool call(s)`);

      for (const toolCall of message.tool_calls) {
        // Type guard: ensure it's a function tool call
        if (toolCall.type !== 'function') continue;

        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`   → ${functionName}:`, functionArgs);

        let toolResult: string;

        // Execute tool via callback (to use Inngest's step.run)
        if (onToolCall) {
          toolResult = await onToolCall(functionName, functionArgs);
        } else {
          // Fallback: handle tools locally
          if (functionName === 'createOrUpdateFiles' && functionArgs.files) {
            for (const file of functionArgs.files as Array<{ path: string; content: string }>) {
              files[file.path] = file.content;
              console.log(`     ✓ File created/updated: ${file.path}`);
            }
            toolResult = 'Files created successfully';
          } else {
            toolResult = 'Tool execution not available';
          }
        }

        // Add tool result to conversation
        gpt5Messages.push({
          role: 'tool',
          content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
          tool_call_id: toolCall.id
        });
      }
    } else {
      // No tool calls and no summary = agent needs to continue
      console.log('⚠️ No tool calls, prompting agent to continue...');
      gpt5Messages.push({
        role: 'user',
        content: 'Continue with the task. Use the available tools to complete the implementation.'
      });
    }

    // Safety check: if no progress, break
    if (choice.finish_reason === 'stop' && !message.tool_calls) {
      console.log('⚠️ Agent stopped without completing task');
      break;
    }
  }

  console.log(`📊 GPT-5.2 completed in ${iterations} iterations`);
  console.log(`📁 Files created: ${Object.keys(files).length}`);

  return {
    summary: finalSummary,
    files,
    toolCalls: [],
    rawResponse: gpt5Messages[gpt5Messages.length - 1]?.content?.toString() || ''
  };
}

/**
 * Helper to format messages with images for GPT-5.2
 */
export function formatMessagesForGPT5(
  messages: Array<{
    role: string;
    content: string;
    attachments?: Array<{ url: string; type: string }>;
  }>
): GPT5Message[] {
  return messages.map(msg => {
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
}