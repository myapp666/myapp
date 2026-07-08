import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;
  const snapshot = await prisma.snapshot.findFirst({
    where: { id: Number(id), userId },
  });
  if (!snapshot) return NextResponse.json({ error: '未找到' }, { status: 404 });
  return NextResponse.json(snapshot);
}
