import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fetchHtml, diffHtml } from '@/lib/scraper';
import { analyzeChange } from '@/lib/llm';

interface TestCrawlRequest {
  userId: number;
  websiteUrl: string;
  competitorName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TestCrawlRequest;
    const { userId, websiteUrl, competitorName } = body;

    if (!userId || !websiteUrl) {
      return NextResponse.json(
        { error: '缺少必要参数: userId 或 websiteUrl' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    let competitor = await prisma.competitor.findFirst({
      where: { userId, websiteUrl },
    });

    if (!competitor) {
      competitor = await prisma.competitor.create({
        data: {
          userId,
          websiteUrl,
          name: competitorName || new URL(websiteUrl).hostname,
        },
      });
    }

    console.log(`开始爬取: ${websiteUrl}`);
    const newHtml = await fetchHtml(websiteUrl);

    const latest = await prisma.snapshot.findFirst({
      where: { competitorId: competitor.id },
      orderBy: { crawledAt: 'desc' },
      select: { htmlContent: true },
    });

    const oldHtml = latest?.htmlContent ?? '';
    const diff = diffHtml(oldHtml, newHtml);

    let snapshot;
    if (diff) {
      console.log(`检测到网站变化，正在分析...`);
      const analysis = await analyzeChange(websiteUrl, diff);
      snapshot = await prisma.snapshot.create({
        data: {
          competitorId: competitor.id,
          userId,
          htmlContent: newHtml,
          changeType: analysis.change_type,
          summary: analysis.summary,
          importance: analysis.importance,
        },
      });
    } else {
      snapshot = await prisma.snapshot.create({
        data: {
          competitorId: competitor.id,
          userId,
          htmlContent: newHtml,
          changeType: 'no_change',
          summary: '网站内容无变化',
          importance: 'low',
        },
      });
    }

    return NextResponse.json({
      success: true,
      competitor: {
        id: competitor.id,
        name: competitor.name,
        websiteUrl: competitor.websiteUrl,
      },
      snapshot: {
        id: snapshot.id,
        crawledAt: snapshot.crawledAt,
        changeType: snapshot.changeType,
        summary: snapshot.summary,
        importance: snapshot.importance,
      },
    });
  } catch (err) {
    console.error('爬取失败:', err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const competitorId = searchParams.get('competitorId');

    if (!userId || !competitorId) {
      return NextResponse.json(
        { error: '缺少必要参数: userId 或 competitorId' },
        { status: 400 }
      );
    }

    const snapshots = await prisma.snapshot.findMany({
      where: {
        userId: parseInt(userId),
        competitorId: parseInt(competitorId),
      },
      orderBy: { crawledAt: 'desc' },
      take: 10,
      select: {
        id: true,
        crawledAt: true,
        changeType: true,
        summary: true,
        importance: true,
      },
    });

    return NextResponse.json({
      success: true,
      snapshots,
    });
  } catch (err) {
    console.error('获取快照失败:', err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
