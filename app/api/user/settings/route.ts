import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

async function getUserIdFromRequest(request: NextRequest): Promise<number | null> {
  const token =
    request.cookies.get('access_token')?.value ??
    request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifyAccessToken(token);
}

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, emailNotifyEnabled: true, createdAt: true },
  });
  if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

  return NextResponse.json(user);
}

export async function PATCH(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { emailNotifyEnabled } = body as { emailNotifyEnabled?: boolean };

  if (typeof emailNotifyEnabled !== 'boolean') {
    return NextResponse.json({ error: 'emailNotifyEnabled 必须为 boolean' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailNotifyEnabled },
    select: { id: true, email: true, username: true, emailNotifyEnabled: true, createdAt: true },
  });

  return NextResponse.json(user);
}