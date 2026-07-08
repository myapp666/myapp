import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

async function getCompetitor(id: number, userId: number) {
  return prisma.competitor.findFirst({ where: { id, userId } });
}

export async function GET(request: NextRequest, { params }: Params) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;
  const competitor = await getCompetitor(Number(id), userId);
  if (!competitor) return NextResponse.json({ error: '未找到' }, { status: 404 });
  return NextResponse.json(competitor);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;
  const existing = await getCompetitor(Number(id), userId);
  if (!existing) return NextResponse.json({ error: '未找到' }, { status: 404 });

  const body = await request.json();
  const { name, websiteUrl, industry, notes } = body as {
    name?: string;
    websiteUrl?: string;
    industry?: string;
    notes?: string;
  };

  if (websiteUrl) {
    try { new URL(websiteUrl); } catch {
      return NextResponse.json({ error: 'websiteUrl 格式无效' }, { status: 400 });
    }
  }

  try {
    const updated = await prisma.competitor.update({
      where: { id: Number(id) },
      data: { name, websiteUrl, industry, notes },
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: '该 URL 已添加' }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;
  const existing = await getCompetitor(Number(id), userId);
  if (!existing) return NextResponse.json({ error: '未找到' }, { status: 404 });

  await prisma.competitor.delete({ where: { id: Number(id) } });
  return new NextResponse(null, { status: 204 });
}
