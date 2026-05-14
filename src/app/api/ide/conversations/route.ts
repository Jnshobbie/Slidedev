import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { conversationsLimiter, rateLimitResponse } from '@/lib/ide-rate-limit';
import { isBlocked, recordFailedAttempt } from '@/lib/token-guard';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-ide-token',
};

async function validateToken(req: NextRequest) {
  const token = req.headers.get('x-ide-token');
  if (!token) return null;
  const record = await prisma.ideToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) return null;
  return record.userId;
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

// GET — list recent conversations
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isBlocked(ip)) {
    return NextResponse.json({ error: 'Too many failed attempts' }, { status: 429 });
  }

  const userId = await validateToken(req);
  if (!userId) {
    recordFailedAttempt(ip);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, retryAfter } = conversationsLimiter(userId);
  if (!allowed) return rateLimitResponse(retryAfter!);

  const conversations = await prisma.ideConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      folderPath: true,
      updatedAt: true,
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { content: true, role: true },
      },
    },
  });

  return NextResponse.json(conversations, { headers: CORS });
}

// POST — create new conversation
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isBlocked(ip)) {
    return NextResponse.json({ error: 'Too many failed attempts' }, { status: 429 });
  }

  const userId = await validateToken(req);
  if (!userId) {
    recordFailedAttempt(ip);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { allowed, retryAfter } = conversationsLimiter(userId);
  if (!allowed) return rateLimitResponse(retryAfter!);

  const { firstMessage, folderPath } = await req.json() as {
    firstMessage: string;
    folderPath?: string;
  };

  // Sanitize input
  if (!firstMessage || typeof firstMessage !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const sanitizedMessage = firstMessage.slice(0, 500);

  const title = sanitizedMessage.length > 50
    ? sanitizedMessage.slice(0, 47) + '...'
    : sanitizedMessage;

  const conversation = await prisma.ideConversation.create({
    data: { userId, title, folderPath: folderPath ?? null },
  });

  return NextResponse.json(conversation, { headers: CORS });
}