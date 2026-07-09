import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import type { Prisma } from '@prisma/client';

// archived query 取值：
//   缺省 / "false" / "0" / "no"   → 只返回未归档（archivedAt = null）
//   "true"  / "1" / "yes"         → 只返回已归档（archivedAt != null）
//   "all"   / "*"                 → 全部（不限）
function parseArchivedFilter(raw: string | null): Prisma.DateTimeNullableFilter<'Snapshot'> | undefined {
  const v = (raw ?? '').toLowerCase();
  if (['all', '*'].includes(v)) return undefined;
  if (['true', '1', 'yes'].includes(v)) return { not: null };
  return { equals: null }; // 缺省 + 其它值：仅未归档
}

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const competitorId = searchParams.get('competitor_id');
  const archivedRaw = searchParams.get('archived');
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 100);

  const where: Prisma.SnapshotWhereInput = { userId };
  if (competitorId) {
    const competitor = await prisma.competitor.findFirst({
      where: { id: Number(competitorId), userId },
    });
    if (!competitor) return NextResponse.json({ error: '未找到竞对' }, { status: 404 });
    where.competitorId = Number(competitorId);
  }
  const archivedClause = parseArchivedFilter(archivedRaw);
  if (archivedClause !== undefined) {
    where.archivedAt = archivedClause;
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
      archivedAt: true,
    },
  });

  return NextResponse.json(snapshots);
}