import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const competitors = await prisma.competitor.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(competitors);
}

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await request.json();
  const { name, websiteUrl, industry, notes } = body as {
    name?: string;
    websiteUrl?: string;
    industry?: string;
    notes?: string;
  };

  if (!name || !websiteUrl) {
    return NextResponse.json({ error: 'name 和 websiteUrl 不能为空' }, { status: 400 });
  }

  try {
    new URL(websiteUrl);
  } catch {
    return NextResponse.json({ error: 'websiteUrl 格式无效' }, { status: 400 });
  }

  try {
    const competitor = await prisma.competitor.create({
      data: { userId, name, websiteUrl, industry, notes },
    });
    return NextResponse.json(competitor, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: '该 URL 已添加' }, { status: 409 });
    }
    throw err;
  }
}
