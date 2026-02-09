import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/db';
import { getPromptForProjectType } from '@/prompt';
import { Sandbox } from '@e2b/code-interpreter';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, value, projectType } = body;

    console.log('🚀 Direct GPT-5.2 call starting');

    const isMobile = projectType === 'mobile';
    const systemPrompt = getPromptForProjectType(projectType);

    // Simple direct call - no agent loop for now
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
        content: 'GPT-5.2 test response',
        role: 'ASSISTANT',
        type: 'RESULT',
      }
    });

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('❌ GPT-5.2 error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}