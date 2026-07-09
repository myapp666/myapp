import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

// POST /api/competitors/batch
// Body: { competitors: [{ name, websiteUrl, industry?, notes? }, ...] }
// 一次最多 200 条；按竞品逐条 create，重复 (P2002) 自动跳过；返回 { requested, created, skipped }
// 注意：suggestedPaths 等 UI 字段不入库（V1 不持久化监控范围）

type ItemIn = {
  name?: unknown;
  websiteUrl?: unknown;
  industry?: unknown;
  notes?: unknown;
};

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: { competitors?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是 JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.competitors)) {
    return NextResponse.json({ error: 'competitors 必须是数组' }, { status: 400 });
  }
  if (body.competitors.length === 0) {
    return NextResponse.json({ error: 'competitors 不能为空' }, { status: 400 });
  }
  if (body.competitors.length > 200) {
    return NextResponse.json({ error: '一次最多 200 条' }, { status: 400 });
  }

  const created: { id: number; name: string; websiteUrl: string }[] = [];
  const skipped: { index: number; websiteUrl: string; reason: string }[] = [];

  for (let i = 0; i < body.competitors.length; i++) {
    const raw = body.competitors[i] as ItemIn;
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const websiteUrl = typeof raw.websiteUrl === 'string' ? raw.websiteUrl.trim() : '';
    const industry = typeof raw.industry === 'string' ? raw.industry.trim() : '';
    const notes = typeof raw.notes === 'string' ? raw.notes.trim() : '';

    if (!name || !websiteUrl) {
      return NextResponse.json(
        { error: `第 ${i + 1} 条缺少 name 或 websiteUrl`, index: i },
        { status: 400 },
      );
    }
    try {
      new URL(websiteUrl);
    } catch {
      return NextResponse.json(
        { error: `第 ${i + 1} 条 websiteUrl 格式无效`, index: i },
        { status: 400 },
      );
    }

    try {
      const c = await prisma.competitor.create({
        data: { userId, name, websiteUrl, industry: industry || null, notes: notes || null },
      });
      created.push({ id: c.id, name: c.name, websiteUrl: c.websiteUrl });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002') {
        skipped.push({ index: i, websiteUrl, reason: '已存在' });
      } else {
        // 非重复错误直接抛出，让外层 try/catch 转 500
        throw err;
      }
    }
  }

  return NextResponse.json({
    requested: body.competitors.length,
    created: created.length,
    skipped,
  });
}
