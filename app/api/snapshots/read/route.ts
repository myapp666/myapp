import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

// 批量标记 / 取消已读。
// Body: { ids: number[], read: boolean }
// 一次最多 200 条；只动属于当前用户的 snapshot。
export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let body: { ids?: unknown; read?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是 JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.ids) || typeof body.read !== 'boolean') {
    return NextResponse.json(
      { error: 'ids 必须是 number[]，read 必须是 boolean' },
      { status: 400 },
    );
  }

  const ids = body.ids
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids 不能为空' }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: '一次最多 200 条' }, { status: 400 });
  }

  const result = await prisma.snapshot.updateMany({
    where: { id: { in: ids }, userId },
    data: { readAt: body.read ? new Date() : null },
  });

  return NextResponse.json({
    requested: ids.length,
    updated: result.count,
    read: body.read,
  });
}