import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: NextRequest) {
  const ideToken = req.headers.get('x-ide-token');
  if (!ideToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tokenRecord = await prisma.ideToken.findUnique({ where: { token: ideToken } });
  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // Refresh token expiry on each use (sliding expiration - 7 days)
  await prisma.ideToken.update({
    where: { token: ideToken },
    data: { expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
  });

  const subscription = await prisma.subscription.findUnique({ 
    where: { userId: tokenRecord.userId } 
  });
  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active';

  const { messages, files, model: requestedModel } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[];
    files: { path: string; content: string }[];
    model: string;
  };

  // Free users get Sonnet, Pro users can request Opus
  const model = isPro && requestedModel === 'claude-opus-4-6'
    ? 'claude-opus-4-6'
    : 'claude-sonnet-4-6';

  const systemPrompt = `You are an expert coding assistant inside SlideDevAI IDE. 
You have access to the user's codebase files listed below.
When modifying files, always respond with the FULL updated file content wrapped in:
<file path="FILEPATH">
...full file content...
</file>
The user will review your changes before applying them.

Current files in context:
${files.map(f => `\`\`\`\n// ${f.path}\n${f.content}\n\`\`\``).join('\n\n')}`;

  const stream = await anthropic.messages.stream({
    model,
    max_tokens: 8096,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}