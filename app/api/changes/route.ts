import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractChangeContent, extractIntentAnalysis } from '@/lib/summary';

// 公共读取端点：无需鉴权。
// 用法：
//   GET /api/changes
//   GET /api/changes?url=https://picpi-iota.vercel.app/
//   GET /api/changes?url=...&limit=50
// 响应结构（按时间倒序）：
//   [
//     {
//       competitorName:     竞品名,
//       changeContent:      变化的前后内容（AI summary 的【变更】段）,
//       intentAnalysis:     意图分析结果（【意图】+【行动】+【理由】三段拼接）,
//     }
//   ]
// 说明：
//   - 默认过滤竞对 websiteUrl = https://picpi-iota.vercel.app/
//   - 同一 URL 多用户监控时，collect.ts 共享 oldHtml 后会在同一时间落 N 条内容相同的 snapshot。
//     此端点按 (URL 归一化, 秒级 crawledAt) 去重，每个变更事件只返回一条。
//   - limit 是"去重后的事件数"（默认 50，最多 200）。
//     SQL 层多拉行以保证凑齐；硬上限 5000 行防大表 OOM。
//   - 由于不带鉴权，仅暴露给内部可信网络使用；外网部署请加 API Key 或 IP 白名单

const DEFAULT_URL = 'https://picpi-iota.vercel.app/';
const HARD_FETCH_LIMIT = 5000;

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, '');
}

function dedupeKey(url: string, crawledAt: Date): string {
  const sec = Math.floor(crawledAt.getTime() / 1000);
  return `${stripTrailingSlash(url)}|${sec}`;
}

interface ChangeEntry {
  competitorName: string;
  changeContent: string;
  intentAnalysis: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawUrl = searchParams.get('url') ?? DEFAULT_URL;
  const targetUrl = stripTrailingSlash(rawUrl);
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? '50'), 1), 200);

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

  const competitorById = new Map(competitors.map((c) => [c.id, c]));

  const snapshots = await prisma.snapshot.findMany({
    where: { competitorId: { in: competitors.map((c) => c.id) } },
    orderBy: { crawledAt: 'desc' },
    take: HARD_FETCH_LIMIT,
    select: {
      competitorId: true,
      crawledAt: true,
      summary: true,
    },
  });

  const seen = new Set<string>();
  const result: ChangeEntry[] = [];

  for (const s of snapshots) {
    const c = competitorById.get(s.competitorId);
    const url = c?.websiteUrl ?? '';
    const key = dedupeKey(url, s.crawledAt);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      competitorName: c?.name ?? '',
      changeContent: extractChangeContent(s.summary),
      intentAnalysis: extractIntentAnalysis(s.summary),
    });
    if (result.length >= limit) break;
  }

  return NextResponse.json(result);
}