import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// 公共读取端点：无需鉴权。
// 用法：
//   GET /api/changes
//   GET /api/changes?url=https://picpi-iota.vercel.app/
//   GET /api/changes?url=...&limit=50
// 说明：
//   - 默认过滤竞对 websiteUrl = https://picpi-iota.vercel.app/
//   - 同一 URL 可能被多个用户添加，所以会跨用户聚合所有快照
//   - 返回按 crawledAt DESC 排序，默认 50 条，最多 200 条
//   - 由于不带鉴权，仅暴露给内部可信网络使用；外网部署请加 API Key 或 IP 白名单

const DEFAULT_URL = 'https://picpi-iota.vercel.app/';

// 去掉结尾的 /，用来兼容 DB 里 https://x 和 https://x/ 两种写法
function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, '');
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawUrl = searchParams.get('url') ?? DEFAULT_URL;
  const targetUrl = stripTrailingSlash(rawUrl);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '50'), 1), 200);

  // 通过竞对 URL 反查竞对，再取出其所有快照。
  // 同一 URL 可能被多个用户添加，所以用 OR 兼容 / 后缀差异。
  const competitors = await prisma.competitor.findMany({
    where: {
      OR: [
        { websiteUrl: targetUrl },
        { websiteUrl: `${targetUrl}/` },
      ],
    },
    select: { id: true, name: true, websiteUrl: true },
  });

  const competitorIds = competitors.map((c) => c.id);
  const nameByCompetitorId = new Map(competitors.map((c) => [c.id, c]));

  const snapshots = await prisma.snapshot.findMany({
    where: { competitorId: { in: competitorIds } },
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

  return NextResponse.json(
    snapshots.map((s) => {
      const c = nameByCompetitorId.get(s.competitorId);
      return {
        id: s.id,
        competitorId: s.competitorId,
        competitorName: c?.name ?? null,
        competitorUrl: c?.websiteUrl ?? null,
        changeType: s.changeType ?? null,
        summary: s.summary ?? null,
        importance: s.importance ?? null,
        crawledAt: s.crawledAt.toISOString(),
      };
    }),
  );
}