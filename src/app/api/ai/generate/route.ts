import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { getPromptForProjectType } from '@/prompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    console.log('🎯 /api/ai/generate ENDPOINT HIT');
    
    const body = await request.json();
    console.log('📦 Request body:', { projectId: body.projectId, projectType: body.projectType });
    
    const { projectId, value, projectType } = body;

    const systemPrompt = getPromptForProjectType(projectType);

    console.log('🚀 Calling GPT-5.2 via chat.completions');

    // ✅ Use Chat Completions API (officially supported for GPT-5.2)
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: value }
      ],
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
      error: errorMessage,
    }, { status: 500 });
  }
}