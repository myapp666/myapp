'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Snapshot {
  id: number;
  competitorId: number;
  crawledAt: string;
  htmlContent?: string | null;
  changeType?: string | null;
  summary?: string | null;
  importance?: string | null;
}

interface Competitor {
  id: number;
  name: string;
}

export default function SnapshotDetailPage() {
  const params = useParams();
  const competitorId = params.competitorId as string;
  const snapshotId = params.id as string;

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [snapRes, compRes] = await Promise.all([
          fetch(`/api/snapshots/${snapshotId}`),
          fetch(`/api/competitors`),
        ]);
        if (!snapRes.ok) throw new Error('记录加载失败');
        const snapData = await snapRes.json();
        setSnapshot(snapData);
        const compData = compRes.ok ? await compRes.json() : [];
        const found = compData.find((c: Competitor) => String(c.id) === competitorId);
        if (found) setCompetitor(found);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [competitorId, snapshotId]);

  const importanceColor = (i?: string | null) => {
    const map: Record<string, string> = {
      高: 'bg-red-100 text-red-700',
      中: 'bg-yellow-100 text-yellow-700',
      低: 'bg-green-100 text-green-700',
    };
    return map[i || ''] || 'bg-gray-100 text-gray-700';
  };

  if (loading) return <div className="text-slate-600">加载中...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!snapshot) return <div className="text-slate-600">记录不存在</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/snapshots/${competitorId}`} className="text-blue-600 hover:underline text-sm">
          ← 返回历史记录
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">
              {competitor?.name ? `${competitor.name} · ` : ''}
              {new Date(snapshot.crawledAt).toLocaleString('zh-CN')}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mt-1">
              {snapshot.changeType || '未分类'}
            </h2>
          </div>
          {snapshot.importance && (
            <span className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${importanceColor(snapshot.importance)}`}>
              重要度：{snapshot.importance}
            </span>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">AI 解读</h3>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-800 whitespace-pre-wrap">
            {snapshot.summary || '（无摘要）'}
          </div>
        </div>

        <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
          记录 ID: {snapshot.id}
        </div>
      </div>
    </div>
  );
}