import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// 标记 / 取消已读单条 snapshot。
// Body: { read: boolean }
// - read=true   -> set readAt = now()
// - read=false  -> set readAt = null  (重置成未读)
export async function POST(request: NextRequest, { params }: Params) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;
  const snapshotId = Number(id);
  if (!Number.isInteger(snapshotId) || snapshotId <= 0) {
    return NextResponse.json({ error: '无效的 id' }, { status: 400 });
  }

  let body: { read?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是 JSON' }, { status: 400 });
  }
  if (typeof body.read !== 'boolean') {
    return NextResponse.json({ error: 'read 必须是 boolean' }, { status: 400 });
  }

  // 校验所有权
  const existing = await prisma.snapshot.findFirst({
    where: { id: snapshotId, userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: '未找到' }, { status: 404 });
  }

  const updated = await prisma.snapshot.update({
    where: { id: snapshotId },
    data: { readAt: body.read ? new Date() : null },
    select: { id: true, readAt: true },
  });

  return NextResponse.json({
    id: updated.id,
    read: updated.readAt !== null,
    readAt: updated.readAt?.toISOString() ?? null,
  });
}