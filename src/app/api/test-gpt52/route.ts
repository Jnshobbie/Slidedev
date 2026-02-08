import OpenAI from 'openai';
import { NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  try {
    console.log('🧪 Testing GPT-5.2...');
    console.log('🔑 API Key exists:', !!process.env.OPENAI_API_KEY);

    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'user', content: 'Say hello in one word' }
      ],
      temperature: 0.1,
    });

    const message = response.choices[0].message.content;
    
    console.log('✅ GPT-5.2 response:', message);

    return NextResponse.json({ 
      success: true, 
      model: 'gpt-5.2',
      message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ GPT-5.2 test failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}