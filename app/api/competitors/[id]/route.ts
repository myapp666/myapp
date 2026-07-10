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
  const { name, websiteUrl, industry, notes, monitoringEnabled } = body as {
    name?: string;
    websiteUrl?: string;
    industry?: string;
    notes?: string;
    monitoringEnabled?: boolean;
  };

  if (websiteUrl) {
    try { new URL(websiteUrl); } catch {
      return NextResponse.json({ error: 'websiteUrl 格式无效' }, { status: 400 });
    }
  }

  // 仅在调用方明确传了 monitoringEnabled（布尔）时才更新，避免被 undefined 覆盖
  const data: {
    name?: string;
    websiteUrl?: string;
    industry?: string;
    notes?: string;
    monitoringEnabled?: boolean;
  } = {};
  if (name !== undefined) data.name = name;
  if (websiteUrl !== undefined) data.websiteUrl = websiteUrl;
  if (industry !== undefined) data.industry = industry;
  if (notes !== undefined) data.notes = notes;
  if (typeof monitoringEnabled === 'boolean') data.monitoringEnabled = monitoringEnabled;

  try {
    const updated = await prisma.competitor.update({
      where: { id: Number(id) },
      data,
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
