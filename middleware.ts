import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function middleware(request: NextRequest) {
  const token =
    request.cookies.get('access_token')?.value ??
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== 'access' || !payload.sub) {
      return NextResponse.json({ error: 'token 无效' }, { status: 401 });
    }
    const response = NextResponse.next();
    response.headers.set('x-user-id', String(payload.sub));
    return response;
  } catch {
    return NextResponse.json({ error: 'token 无效或已过期' }, { status: 401 });
  }
}

export const config = {
  matcher: ['/api/competitors/:path*', '/api/snapshots/:path*'],
};
