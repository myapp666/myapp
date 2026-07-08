import { NextRequest, NextResponse } from 'next/server';
import { collectAll } from '@/lib/collect';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await collectAll();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('collectAll 失败', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
