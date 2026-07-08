'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Snapshot {
  id: number;
  competitorId: number;
  crawledAt: string;
  changeType?: string;
  summary?: string;
  importance?: string;
}

export default function SnapshotsPage() {
  const params = useParams();
  const competitorId = params.competitorId as string;
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSnapshots = async () => {
      try {
        const res = await fetch(`/api/snapshots?competitor_id=${competitorId}&limit=20`);
        if (!res.ok) throw new Error('获取记录失败');
        const data = await res.json();
        setSnapshots(data);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchSnapshots();
  }, [competitorId]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const getImportanceColor = (importance?: string) => {
    const map: Record<string, string> = {
      高: 'bg-red-100 text-red-700',
      中: 'bg-yellow-100 text-yellow-700',
      低: 'bg-green-100 text-green-700',
    };
    return map[importance || ''] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return <div className="text-slate-600">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/competitors" className="text-blue-600 hover:underline text-sm">
          ← 返回竞对列表
        </Link>
        <h2 className="text-2xl font-bold text-slate-900">历史记录</h2>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {snapshots.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-white rounded-lg border border-slate-200">
            暂无采集记录
          </div>
        ) : (
          snapshots.map((snap) => (
            <Link
              key={snap.id}
              href={`/dashboard/snapshots/${competitorId}/${snap.id}`}
              className="block bg-white p-4 rounded-lg border border-slate-200 hover:shadow-md hover:border-blue-300 transition cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-sm text-slate-500">{formatDate(snap.crawledAt)}</p>
                  <h3 className="font-semibold text-slate-900 mt-1">{snap.changeType || '未分类'}</h3>
                  <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                    {snap.summary || '（无摘要）'}
                  </p>
                </div>
                {snap.importance && (
                  <span className={`ml-4 px-3 py-1 text-sm font-medium rounded-full ${getImportanceColor(snap.importance)}`}>
                    {snap.importance}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
