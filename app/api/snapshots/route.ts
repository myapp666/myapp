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

// read query 取值同 archived。
function parseReadFilter(raw: string | null): Prisma.DateTimeNullableFilter<'Snapshot'> | undefined {
  const v = (raw ?? '').toLowerCase();
  if (['', 'all', '*'].includes(v)) return undefined;
  if (['true', '1', 'yes'].includes(v)) return { not: null };
  if (['false', '0', 'no', 'unread'].includes(v)) return { equals: null };
  return undefined;
}

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const competitorId = searchParams.get('competitor_id');
  const archivedRaw = searchParams.get('archived');
  const readRaw = searchParams.get('read');

  // 分页：page 1-indexed；pageSize 默认 100，最大 200（防止大表 OOM）
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(Math.max(1, Number(searchParams.get('pageSize') ?? '100') || 100), 200);
  const skip = (page - 1) * pageSize;

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
  const readClause = parseReadFilter(readRaw);
  if (readClause !== undefined) {
    where.readAt = readClause;
  }

  // 用 Promise.all 并发跑：分页数据 + 总数
  const [total, snapshots] = await Promise.all([
    prisma.snapshot.count({ where }),
    prisma.snapshot.findMany({
      where,
      orderBy: { crawledAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        competitorId: true,
        crawledAt: true,
        changeType: true,
        summary: true,
        importance: true,
        archivedAt: true,
        readAt: true,
      },
    }),
  ]);

  // 总数放响应头，不动 body（向后兼容）
  return NextResponse.json(snapshots, {
    headers: {
      'X-Total-Count': String(total),
      'X-Page': String(page),
      'X-Page-Size': String(pageSize),
    },
  });
}