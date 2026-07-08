import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  tokenCookieOptions,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
  }

  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(user.id),
    createRefreshToken(user.id),
  ]);

  const response = NextResponse.json({ access_token: accessToken, refresh_token: refreshToken, token_type: 'bearer' });
  response.cookies.set('access_token', accessToken, tokenCookieOptions(24 * 3600));
  response.cookies.set('refresh_token', refreshToken, tokenCookieOptions(7 * 24 * 3600));
  return response;
}
