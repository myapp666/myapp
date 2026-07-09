import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { suggestCompetitors } from '@/lib/competitor-suggest';

// POST /api/competitors/suggest
// Body: { productUrl?: string, productDescription?: string, industry?: string, count?: number }
// 三个文本 hint 至少一个非空（否则 400）。
// 直接调 LLM 让它根据 hint 推荐 N 条潜在竞品,不爬任何 URL。
export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: {
    productUrl?: unknown;
    productDescription?: unknown;
    industry?: unknown;
    count?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是 JSON' }, { status: 400 });
  }

  const productUrl = typeof body.productUrl === 'string' ? body.productUrl.trim() : '';
  const productDescription =
    typeof body.productDescription === 'string' ? body.productDescription.trim() : '';
  const industry = typeof body.industry === 'string' ? body.industry.trim() : '';

  let count = 5;
  if (typeof body.count === 'number') {
    count = body.count;
  } else if (typeof body.count === 'string') {
    const n = Number(body.count);
    if (Number.isFinite(n)) count = n;
  }
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    return NextResponse.json({ error: 'count 必须在 1-10 之间' }, { status: 400 });
  }

  if (!productUrl && !productDescription && !industry) {
    return NextResponse.json(
      { error: '请至少提供产品 URL、产品描述或行业之一' },
      { status: 400 },
    );
  }

  const out = await suggestCompetitors({
    productUrl: productUrl || undefined,
    productDescription: productDescription || undefined,
    industry: industry || undefined,
    count,
  });

  return NextResponse.json({ candidates: out.candidates, count, industry });
}
