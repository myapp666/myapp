import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token =
    request.cookies.get('access_token')?.value ??
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const userId = await verifyAccessToken(token);
  if (!userId) {
    return NextResponse.json({ error: 'token 无效或已过期' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true },
  });
  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 401 });
  }

  return NextResponse.json(user);
}
