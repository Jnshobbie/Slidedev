import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SONNET_FREE_LIMIT = 50_000;
const SONNET_IDE_LIMIT = 1_000_000;
const OPUS_IDE_LIMIT = 200_000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-ide-token',
};

function getPeriodBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const ideToken = req.headers.get('x-ide-token');
  if (!ideToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tokenRecord = await prisma.ideToken.findUnique({ where: { token: ideToken } });
  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // Refresh token sliding expiry
  await prisma.ideToken.update({
    where: { token: ideToken },
    data: { expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
  });

  const userId = tokenRecord.userId;

  // Get subscription
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const isIde = subscription?.plan === 'ide' && subscription?.status === 'active';

  // Get or create IdeUsage for current period
  const { start, end } = getPeriodBounds();
  let usage = await prisma.ideUsage.findUnique({ where: { userId } });

  if (!usage || usage.periodEnd < new Date()) {
    // New period — reset
    usage = await prisma.ideUsage.upsert({
      where: { userId },
      update: { sonnetTokensUsed: 0, opusTokensUsed: 0, periodStart: start, periodEnd: end },
      create: { userId, sonnetTokensUsed: 0, opusTokensUsed: 0, periodStart: start, periodEnd: end },
    });
  }

  const { messages, files, model: requestedModel } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[];
    files: { path: string; content: string }[];
    model: string;
  };

  // Decide model
  const useOpus = isIde && requestedModel === 'claude-opus-4-6';
  const model = useOpus ? 'claude-opus-4-6' : 'claude-sonnet-4-6';

  // Check limits before calling Claude
  if (useOpus) {
    if (usage.opusTokensUsed >= OPUS_IDE_LIMIT) {
      return NextResponse.json(
        { error: 'opus_limit_reached', message: 'Monthly Opus token limit reached. Switch to Sonnet or upgrade.' },
        { status: 429, headers: CORS_HEADERS }
      );
    }
  } else {
    const sonnetLimit = isIde ? SONNET_IDE_LIMIT : SONNET_FREE_LIMIT;
    if (usage.sonnetTokensUsed >= sonnetLimit) {
      return NextResponse.json(
        { error: 'sonnet_limit_reached', message: isIde ? 'Monthly Sonnet token limit reached.' : 'Free token limit reached. Upgrade to IDE Premium.' },
        { status: 429, headers: CORS_HEADERS }
      );
    }
  }

  const systemPrompt = `You are an expert coding assistant inside SlideDevAI IDE. 
You have access to the user's codebase files listed below.
When modifying files, always respond with the FULL updated file content wrapped in:
<file path="FILEPATH">
...full file content...
</file>
The user will review your changes before applying them.

Current files in context:
${files.map(f => `\`\`\`\n// ${f.path}\n${f.content}\n\`\`\``).join('\n\n')}`;

  // Stream response and capture usage
  const stream = await anthropic.messages.stream({
    model,
    max_tokens: 8096,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  let inputTokens = 0;
  let outputTokens = 0;

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
        // Capture final usage from stream
        if (chunk.type === 'message_delta' && chunk.usage) {
          outputTokens = chunk.usage.output_tokens ?? 0;
        }
        if (chunk.type === 'message_start' && chunk.message.usage) {
          inputTokens = chunk.message.usage.input_tokens ?? 0;
        }
      }

      // Record tokens after stream completes
      const totalTokens = inputTokens + outputTokens;
      if (useOpus) {
        await prisma.ideUsage.update({
          where: { userId },
          data: { opusTokensUsed: { increment: totalTokens } },
        });
      } else {
        await prisma.ideUsage.update({
          where: { userId },
          data: { sonnetTokensUsed: { increment: totalTokens } },
        });
      }

      controller.close();
    },
  });

  // Calculate % remaining to send in headers
  const sonnetLimit = isIde ? SONNET_IDE_LIMIT : SONNET_FREE_LIMIT;
  const sonnetPct = Math.max(0, Math.round((1 - usage.sonnetTokensUsed / sonnetLimit) * 100));
  const opusPct = isIde ? Math.max(0, Math.round((1 - usage.opusTokensUsed / OPUS_IDE_LIMIT) * 100)) : 0;

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      ...CORS_HEADERS,
      'X-Sonnet-Remaining': String(sonnetPct),
      'X-Opus-Remaining': String(opusPct),
      'X-Is-Ide': String(isIde),
    },
  });
}