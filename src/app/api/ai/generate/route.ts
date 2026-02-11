// src/app/api/ai/generate/route.ts
import { NextResponse } from "next/server";
import { runCodeAgentJob } from "@/lib/code-agent-runner";

export async function POST(req: Request) {
  try {
    console.log('📥 API Route: Received GPT-5.2 generation request');
    
    const body = await req.json();
    const { projectId, value, projectType, attachments, figmaData } = body;

    console.log('📋 API Route: Request params:', {
      projectId,
      hasValue: !!value,
      hasAttachments: !!attachments,
      hasFigmaData: !!figmaData,
      openaiKeyExists: !!process.env.OPENAI_API_KEY,
    });

    if (!projectId || !value) {
      console.error('❌ API Route: Missing required params');
      return NextResponse.json(
        { error: 'Missing projectId or value' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ API Route: OPENAI_API_KEY not set');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    console.log('🚀 API Route: Starting runCodeAgentJob...');
    
    // You can ignore projectType here if runCodeAgentJob looks it up from DB
    const result = await runCodeAgentJob({
      projectId,
      value,
      attachments,
      figmaData,
    });

    console.log('✅ API Route: runCodeAgentJob completed successfully');
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ API Route: Error in POST handler:', error);
    console.error('❌ API Route: Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}