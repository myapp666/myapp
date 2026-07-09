import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// 公共读取端点：无需鉴权。
// 用法：
//   GET /api/changes
//   GET /api/changes?url=https://picpi-iota.vercel.app/
//   GET /api/changes?url=...&limit=50
// 说明：
//   - 默认过滤竞对 websiteUrl = https://picpi-iota.vercel.app/
//   - 同一 URL 多用户监控时，collect.ts 共享 oldHtml 后会在同一时间落 N 条内容相同的 snapshot。
//     此端点按 (URL 归一化, 秒级 crawledAt) 去重，每个变更事件只返回一条。
//   - competitorCount = 同一事件被多少个 competitor（用户监控行）记录
//   - limit 语义是"去重后的事件数"（默认 50，最多 200）。
//     多用户场景下要去重足够多的事件，SQL 层多拉行；硬上限 5000 行防大表 OOM。
//   - 由于不带鉴权，仅暴露给内部可信网络使用；外网部署请加 API Key 或 IP 白名单

const DEFAULT_URL = 'https://picpi-iota.vercel.app/';
const HARD_FETCH_LIMIT = 5000;

// 去掉结尾的 /，用来兼容 DB 里 https://x 和 https://x/ 两种写法
function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, '');
}

// 去重 key：URL 归一化 + 秒级 crawledAt。
// 用秒级而不是毫秒精度，规避 PostgreSQL now() 微秒差异造成的漏去重；
// 对新老数据都安全。
function dedupeKey(url: string, crawledAt: Date): string {
  const sec = Math.floor(crawledAt.getTime() / 1000);
  return `${stripTrailingSlash(url)}|${sec}`;
}

interface ChangeEntry {
  id: number;
  competitorName: string | null;
  competitorUrl: string | null;
  competitorCount: number;
  changeType: string | null;
  summary: string | null;
  importance: string | null;
  crawledAt: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawUrl = searchParams.get('url') ?? DEFAULT_URL;
  const targetUrl = stripTrailingSlash(rawUrl);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '50'), 1), 200);

  // 通过竞对 URL 反查竞对（兼容尾部斜杠）
  const competitors = await prisma.competitor.findMany({
    where: {
      OR: [
        { websiteUrl: targetUrl },
        { websiteUrl: `${targetUrl}/` },
      ],
    },
    select: { id: true, name: true, websiteUrl: true },
  });

  if (competitors.length === 0) {
    return NextResponse.json([]);
  }

  const competitorIds = competitors.map((c) => c.id);
  const competitorById = new Map(competitors.map((c) => [c.id, c]));

  // 多拉些以保证去重后还能凑齐 limit 条事件；硬上限避免大表 OOM
  const snapshots = await prisma.snapshot.findMany({
    where: { competitorId: { in: competitorIds } },
    orderBy: { crawledAt: 'desc' },
    take: HARD_FETCH_LIMIT,
    select: {
      id: true,
      competitorId: true,
      crawledAt: true,
      changeType: true,
      summary: true,
      importance: true,
    },
  });

  // 第一遍：按 (URL, 秒级 crawledAt) 计数（同一事件被多少 competitor 落库）
  const counts = new Map<string, number>();
  for (const s of snapshots) {
    const c = competitorById.get(s.competitorId);
    const url = c?.websiteUrl ?? '';
    const key = dedupeKey(url, s.crawledAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // 第二遍：去重 + 取前 limit 条
  const seen = new Set<string>();
  const result: ChangeEntry[] = [];

  for (const s of snapshots) {
    const c = competitorById.get(s.competitorId);
    const url = c?.websiteUrl ?? '';
    const key = dedupeKey(url, s.crawledAt);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: s.id,
      competitorName: c?.name ?? null,
      competitorUrl: c?.websiteUrl ?? null,
      competitorCount: counts.get(key) ?? 1,
      changeType: s.changeType ?? null,
      summary: s.summary ?? null,
      importance: s.importance ?? null,
      crawledAt: s.crawledAt.toISOString(),
    });
    if (result.length >= limit) break;
  }

  return NextResponse.json(result);
}