import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { meLimiter, rateLimitResponse } from '@/lib/ide-rate-limit';
import { isBlocked, recordFailedAttempt } from '@/lib/token-guard';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-ide-token',
};

const SONNET_FREE_LIMIT = 50_000;
const SONNET_IDE_LIMIT = 1_000_000;
const OPUS_IDE_LIMIT = 200_000;

function getPeriodBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const ideToken = req.headers.get('x-ide-token');
  if (!ideToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Block IPs with too many failed attempts
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isBlocked(ip)) {
    return NextResponse.json({ error: 'Too many failed attempts' }, { status: 429 });
  }

  const tokenRecord = await prisma.ideToken.findUnique({ where: { token: ideToken } });
  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    recordFailedAttempt(ip);
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // userId is now defined — safe to rate limit per user
  const userId = tokenRecord.userId;
  const { allowed, retryAfter } = meLimiter(userId);
  if (!allowed) return rateLimitResponse(retryAfter!);

  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const isIde = subscription?.plan === 'ide' && subscription?.status === 'active';

  const { start, end } = getPeriodBounds();
  let usage = await prisma.ideUsage.findUnique({ where: { userId } });
  if (!usage || usage.periodEnd < new Date()) {
    usage = await prisma.ideUsage.upsert({
      where: { userId },
      update: { sonnetTokensUsed: 0, opusTokensUsed: 0, periodStart: start, periodEnd: end },
      create: { userId, sonnetTokensUsed: 0, opusTokensUsed: 0, periodStart: start, periodEnd: end },
    });
  }

  const sonnetLimit = isIde ? SONNET_IDE_LIMIT : SONNET_FREE_LIMIT;
  const sonnetPct = Math.max(0, Math.round((1 - usage.sonnetTokensUsed / sonnetLimit) * 100));
  const opusPct = isIde ? Math.max(0, Math.round((1 - usage.opusTokensUsed / OPUS_IDE_LIMIT) * 100)) : 0;

  return NextResponse.json({
    isIde,
    sonnetRemaining: sonnetPct,
    opusRemaining: opusPct,
    periodEnd: usage.periodEnd,
  }, { headers: CORS_HEADERS });
}