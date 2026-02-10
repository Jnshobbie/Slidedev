import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { getPromptForProjectType } from '@/prompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, value, projectType } = body;

    console.log('🚀 GPT-5.2 responses.create() starting');
    console.log('📋 Project type:', projectType);

    const systemPrompt = getPromptForProjectType(projectType);

    // ✅ Use responses.create() with correct message format
    const response = await openai.responses.create({
      model: 'gpt-5.2',
      input: [
        {
          type: 'message',
          role: 'system',
          content: systemPrompt
        },
        {
          type: 'message',
          role: 'user',
          content: value
        }
      ],
      reasoning: {
        effort: 'medium'
      },
      temperature: 0.1,
    });

    console.log('📦 Response output items:', response.output.length);

    // Parse the response.output array - look for message type
    let summary = '';

    for (const item of response.output) {
      if (item.type === 'message' && 'content' in item) {
        // content is an array of ResponseOutputText | ResponseOutputRefusal
        const textContent = item.content.find(c => c.type === 'output_text');
        if (textContent && 'text' in textContent) {
          summary = textContent.text;
          console.log('✅ GPT-5.2 responded:', summary.substring(0, 100));
          break;
        }
      }
    }

    if (!summary) {
      console.log('⚠️ No message found, dumping full output:', JSON.stringify(response.output, null, 2));
      throw new Error('No text response in output');
    }

    // Save to database
    await prisma.message.create({
      data: {
        projectId,
        content: summary,
        role: 'ASSISTANT',
        type: 'RESULT',
      }
    });

    console.log('💾 Saved to database');

    return NextResponse.json({ 
      success: true, 
      summary,
      model: response.model
    });

  } catch (error) {
    console.error('❌ GPT-5.2 error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json({ 
      error: errorMessage,
    }, { status: 500 });
  }
}