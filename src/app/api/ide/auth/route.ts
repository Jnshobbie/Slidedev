import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { randomBytes } from 'crypto';

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Delete any existing tokens for this user
  await prisma.ideToken.deleteMany({ where: { userId } });

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 5); // 5 min to complete login

  await prisma.ideToken.create({
    data: { token, userId, expiresAt },
  });

  return NextResponse.json({ token });
}