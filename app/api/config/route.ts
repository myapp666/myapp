import { NextResponse } from 'next/server';

export async function GET() {
  const minutes = Number(process.env.MONITOR_INTERVAL ?? 60);
  return NextResponse.json({
    monitorIntervalMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : 60,
  });
}