import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  verifyRefreshToken,
  createAccessToken,
  createRefreshToken,
  tokenCookieOptions,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const refreshToken =
    (body as { refresh_token?: string }).refresh_token ??
    request.cookies.get('refresh_token')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'refresh token 缺失' }, { status: 401 });
  }

  const userId = await verifyRefreshToken(refreshToken);
  if (!userId) {
    return NextResponse.json({ error: 'refresh token 无效或已过期' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 401 });
  }

  const [accessToken, newRefreshToken] = await Promise.all([
    createAccessToken(user.id),
    createRefreshToken(user.id),
  ]);

  const response = NextResponse.json({ access_token: accessToken, refresh_token: newRefreshToken, token_type: 'bearer' });
  response.cookies.set('access_token', accessToken, tokenCookieOptions(24 * 3600));
  response.cookies.set('refresh_token', newRefreshToken, tokenCookieOptions(7 * 24 * 3600));
  return response;
}
