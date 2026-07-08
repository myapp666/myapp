import { prisma } from './db';
import { fetchHtml, diffHtml } from './scraper';
import { analyzeChange } from './llm';

async function collectCompetitor(competitorId: number): Promise<void> {
  const competitor = await prisma.competitor.findUnique({ where: { id: competitorId } });
  if (!competitor) return;

  let newHtml: string;
  try {
    newHtml = await fetchHtml(competitor.websiteUrl);
  } catch (err) {
    console.error(`采集失败 competitor_id=${competitorId} url=${competitor.websiteUrl}`, err);
    return;
  }

  const latest = await prisma.snapshot.findFirst({
    where: { competitorId },
    orderBy: { crawledAt: 'desc' },
    select: { htmlContent: true },
  });

  const oldHtml = latest?.htmlContent ?? '';
  const diff = diffHtml(oldHtml, newHtml);
  if (!diff) {
    console.debug(`无变化 competitor_id=${competitorId}`);
    return;
  }

  const analysis = await analyzeChange(competitor.websiteUrl, diff);
  await prisma.snapshot.create({
    data: {
      competitorId,
      userId: competitor.userId,
      htmlContent: newHtml,
      changeType: analysis.change_type,
      summary: analysis.summary,
      importance: analysis.importance,
    },
  });
  console.info(`已保存变更 competitor_id=${competitorId} change_type=${analysis.change_type}`);
}

export async function collectAll(): Promise<void> {
  const competitors = await prisma.competitor.findMany({ select: { id: true } });
  await Promise.allSettled(competitors.map((c) => collectCompetitor(c.id)));
}
