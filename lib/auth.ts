import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

const IS_PROD = process.env.NODE_ENV === 'production';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

async function signToken(payload: Record<string, unknown>, expiresIn: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export function createAccessToken(userId: number): Promise<string> {
  return signToken({ sub: String(userId), type: 'access' }, '24h');
}

export function createRefreshToken(userId: number): Promise<string> {
  return signToken({ sub: String(userId), type: 'refresh' }, '7d');
}

async function verifyToken(token: string, type: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== type || !payload.sub) return null;
    return Number(payload.sub);
  } catch {
    return null;
  }
}

export function verifyAccessToken(token: string): Promise<number | null> {
  return verifyToken(token, 'access');
}

export function verifyRefreshToken(token: string): Promise<number | null> {
  return verifyToken(token, 'refresh');
}

export function getUserIdFromRequest(request: NextRequest): number | null {
  const id = request.headers.get('x-user-id');
  return id ? Number(id) : null;
}

export function tokenCookieOptions(maxAge: number): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    maxAge,
    sameSite: IS_PROD ? 'none' : 'lax',
    secure: IS_PROD,
    path: '/',
  };
}
