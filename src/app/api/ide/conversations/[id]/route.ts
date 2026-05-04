import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
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

// GET — load all messages for a conversation
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await validateToken(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const conversation = await prisma.ideConversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!conversation || conversation.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(conversation, { headers: CORS });
}

// PATCH — append messages to conversation
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await validateToken(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const conversation = await prisma.ideConversation.findUnique({ where: { id } });
  if (!conversation || conversation.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { messages } = await req.json() as {
    messages: { role: string; content: string }[];
  };

  await prisma.ideMessage.createMany({
    data: messages.map(m => ({
      conversationId: id,
      role: m.role,
      content: m.content,
    })),
  });

  // Update conversation updatedAt
  await prisma.ideConversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ success: true }, { headers: CORS });
}

// DELETE — delete a conversation
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await validateToken(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const conversation = await prisma.ideConversation.findUnique({ where: { id } });
  if (!conversation || conversation.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.ideConversation.delete({ where: { id } });
  return NextResponse.json({ success: true }, { headers: CORS });
}