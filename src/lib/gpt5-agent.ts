import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { APIError } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Model name configuration for GPT-5 family
// Available models: 'gpt-5.2', 'gpt-5.2-pro', 'gpt-5.2-codex', 'gpt-5.1', 'gpt-5-mini', 'gpt-5-nano'
// Default: 'gpt-5.2' - best for complex reasoning, broad world knowledge, and code-heavy tasks
const GPT_MODEL = process.env.OPENAI_MODEL || 'gpt-5.2';

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

    console.log(`📡 GPT-5.2: Making API call with model '${GPT_MODEL}'`);
    console.log(`📡 GPT-5.2: Messages count: ${gpt5Messages.length}`);
    console.log(`📡 GPT-5.2: Tools count: ${tools.length}`);
    console.log(`📡 GPT-5.2: OpenAI key exists: ${!!process.env.OPENAI_API_KEY}`);

    // GPT-5.2 with Chat Completions API
    // Note: According to docs, reasoning_effort and verbosity are only supported with reasoning_effort: "none"
    // For other reasoning levels, use reasoning.effort in Responses API
    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: gpt5Messages,
      tools,
      tool_choice: 'auto',
      reasoning_effort: 'none', // GPT-5.2 parameter - 'none' is default and allows temperature
      verbosity: 'medium', // GPT-5.2 parameter - controls output token count
      temperature: 0.1, // Only works with reasoning_effort: 'none'
    }).catch((error) => {
      console.error('❌ GPT-5.2 API Error:', error);
      
      if (error instanceof APIError) {
        console.error('❌ GPT-5.2 API Error details:', {
          message: error.message,
          status: error.status,
          code: error.code,
          type: error.type,
          error: error.error,
        });
        
        // If it's a parameter error, try without the new parameters
        if (error.status === 400 || error.code === 'invalid_request_error') {
          console.log('⚠️ Retrying without GPT-5.2 specific parameters...');
          return openai.chat.completions.create({
            model: GPT_MODEL,
            messages: gpt5Messages,
            tools,
            tool_choice: 'auto',
            temperature: 0.1,
          });
        }
      } else if (error instanceof Error) {
        console.error('❌ GPT-5.2 API Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
      } else {
        console.error('❌ GPT-5.2 API Error: Unknown error type', error);
      }
      
      throw error; //Re-throw to stop execution
    });

    console.log(`✅ GPT-5.2: API call successful, finish_reason: ${response.choices[0]?.finish_reason}`);


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