import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const competitorId = searchParams.get('competitor_id');
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 100);

  const where: { userId: number; competitorId?: number } = { userId };
  if (competitorId) {
    const competitor = await prisma.competitor.findFirst({
      where: { id: Number(competitorId), userId },
    });
    if (!competitor) return NextResponse.json({ error: '未找到竞对' }, { status: 404 });
    where.competitorId = Number(competitorId);
  }

  const snapshots = await prisma.snapshot.findMany({
    where,
    orderBy: { crawledAt: 'desc' },
    take: limit,
    select: {
      id: true,
      competitorId: true,
      crawledAt: true,
      changeType: true,
      summary: true,
      importance: true,
    },
  });

  return NextResponse.json(snapshots);
}
