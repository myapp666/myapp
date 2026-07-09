import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

// 归档 / 取消归档单条 snapshot。
// Body: { archived: boolean }
// - archived=true   -> set archivedAt = now()
// - archived=false  -> set archivedAt = null  (取消归档)
export async function POST(request: NextRequest, { params }: Params) {
  const userId = getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { id } = await params;
  const snapshotId = Number(id);
  if (!Number.isInteger(snapshotId) || snapshotId <= 0) {
    return NextResponse.json({ error: '无效的 id' }, { status: 400 });
  }

  let body: { archived?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是 JSON' }, { status: 400 });
  }
  if (typeof body.archived !== 'boolean') {
    return NextResponse.json({ error: 'archived 必须是 boolean' }, { status: 400 });
  }

  // 校验所有权，避免越权改别人数据
  const existing = await prisma.snapshot.findFirst({
    where: { id: snapshotId, userId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: '未找到' }, { status: 404 });
  }

  const updated = await prisma.snapshot.update({
    where: { id: snapshotId },
    data: { archivedAt: body.archived ? new Date() : null },
    select: { id: true, archivedAt: true },
  });

  return NextResponse.json({
    id: updated.id,
    archived: updated.archivedAt !== null,
    archivedAt: updated.archivedAt?.toISOString() ?? null,
  });
}