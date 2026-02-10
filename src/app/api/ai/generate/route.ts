import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { getPromptForProjectType } from '@/prompt';
import type { ChatCompletionMessageParam, ChatCompletionContentPart } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Make this route publicly accessible (no Clerk middleware)
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    console.log('🎯 /api/ai/generate ENDPOINT HIT');
    
    const body = await request.json();
    console.log('📦 Request body:', { projectId: body.projectId, projectType: body.projectType });
    
    const { projectId, value, projectType, attachments } = body;

    if (!projectId || !value || !projectType) {
      console.error('❌ Missing required fields');
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    const systemPrompt = getPromptForProjectType(projectType);

    console.log('🚀 Calling GPT-5.2 via chat.completions');
    console.log('🔑 API Key exists:', !!process.env.OPENAI_API_KEY);

    // Format messages with proper types
    const messages: ChatCompletionMessageParam[] = [
      { 
        role: 'system', 
        content: systemPrompt 
      }
    ];

    // Add user message with images if attachments exist
    if (attachments && attachments.length > 0) {
      const imageUrls = attachments
        .filter((a: { type: string }) => a.type.startsWith('image/'))
        .map((a: { url: string }) => a.url);

      if (imageUrls.length > 0) {
        const content: ChatCompletionContentPart[] = [
          { type: 'text', text: value },
          ...imageUrls.map((url: string) => ({
            type: 'image_url' as const,
            image_url: { url }
          }))
        ];

        messages.push({
          role: 'user',
          content
        });
      } else {
        messages.push({ 
          role: 'user', 
          content: value 
        });
      }
    } else {
      messages.push({ 
        role: 'user', 
        content: value 
      });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages,
      temperature: 0.1,
    });

    const summary = response.choices[0].message.content || '';
    
    console.log('✅ GPT-5.2 responded:', summary.substring(0, 100));

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
    console.error('❌ Error in /api/ai/generate:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json({ 
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}