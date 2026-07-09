'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ImportanceFilter,
  IMPORTANCE_LEVELS,
  matchesImportanceFilter,
  useImportanceFilter,
  type Importance,
} from './_components/ImportanceFilter';

interface User {
  id: number;
  email: string;
  username: string;
}

interface Competitor {
  id: number;
  name: string;
  websiteUrl: string;
  industry?: string;
  createdAt: string;
}

interface Snapshot {
  id: number;
  competitorId: number;
  crawledAt: string;
  changeType?: string | null;
  summary?: string | null;
  importance?: string | null;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>('all');
  const [recent, setRecent] = useState<Snapshot[]>([]);
  const [monitorInterval, setMonitorInterval] = useState<number>(60);
  const [loading, setLoading] = useState(true);
  const [importanceFilter, setImportanceFilter] = useImportanceFilter();

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, compRes, cfgRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/competitors'),
          fetch('/api/config'),
        ]);
        if (meRes.ok) setUser(await meRes.json());
        if (compRes.ok) setCompetitors(await compRes.json());
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          if (typeof cfg.monitorIntervalMinutes === 'number') {
            setMonitorInterval(cfg.monitorIntervalMinutes);
          }
        }
      } catch (err) {
        console.error('加载失败', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const url =
          selectedCompetitorId === 'all'
            ? '/api/snapshots?limit=100'
            : `/api/snapshots?competitor_id=${selectedCompetitorId}&limit=100`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('加载记录失败');
        setRecent(await res.json());
      } catch (err) {
        console.error(err);
        setRecent([]);
      }
    };
    load();
  }, [selectedCompetitorId]);

  const importanceColor = (i?: string | null) => {
    const map: Record<string, string> = {
      高: 'bg-red-100 text-red-700',
      中: 'bg-yellow-100 text-yellow-700',
      低: 'bg-green-100 text-green-700',
    };
    return map[i || ''] || 'bg-gray-100 text-gray-700';
  };

  const selectedName =
    selectedCompetitorId === 'all'
      ? '全部'
      : competitors.find((c) => String(c.id) === selectedCompetitorId)?.name || '未知';

  const competitorNameById = new Map(competitors.map((c) => [c.id, c.name]));

  // 当前 dataset 内的重要度计数（用于药丸上的数字角标）
  const importanceCounts = useMemo(() => {
    const counts: Partial<Record<Importance, number>> = {};
    for (const s of recent) {
      const imp = s.importance;
      if (imp && (IMPORTANCE_LEVELS as readonly string[]).includes(imp)) {
        const k = imp as Importance;
        counts[k] = (counts[k] ?? 0) + 1;
      }
    }
    return counts;
  }, [recent]);

  // 客户端筛选：null/未知 重要度一律保留显示
  const filteredRecent = useMemo(
    () => recent.filter((s) => matchesImportanceFilter(s.importance, importanceFilter)),
    [recent, importanceFilter],
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">欢迎回来，{user?.username || user?.email}</h2>
        <p className="text-sm text-slate-500 mt-1">这里是竞争情报监控的总览</p>
      </div>

      {/* 数据概览 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="text-sm text-slate-500">监控竞对</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{competitors.length}</div>
          <Link href="/dashboard/competitors" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
            管理竞对 →
          </Link>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="text-sm text-slate-500">最近记录</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{filteredRecent.length}</div>
          <div className="text-xs text-slate-400 mt-2">
            当前筛选下的记录数{recent.length !== filteredRecent.length && (
              <span className="text-slate-400">（共 {recent.length} 条）</span>
            )}
          </div>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="text-sm text-slate-500">采集频率</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{monitorInterval} min</div>
          <div className="text-xs text-slate-400 mt-2">来自 .env MONITOR_INTERVAL</div>
        </div>
      </div>

      {/* 展开选择 + 近期变化 */}
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">近期变化</h3>
            <p className="text-xs text-slate-500 mt-1">
              当前筛选：<span className="font-medium text-slate-700">{selectedName}</span>
              {' · '}
              <span>
                显示 <span className="font-medium text-slate-700">{filteredRecent.length}</span> /{' '}
                {recent.length} 条
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="competitor-select" className="text-sm text-slate-600 whitespace-nowrap">
              选择竞对：
            </label>
            <select
              id="competitor-select"
              value={selectedCompetitorId}
              onChange={(e) => setSelectedCompetitorId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
            >
              <option value="all">全部竞对</option>
              {competitors.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 重要度筛选器（独立一行，便于在移动端自然换行） */}
        <div className="bg-white px-4 py-3 rounded-lg border border-slate-200">
          <ImportanceFilter
            value={importanceFilter}
            onChange={setImportanceFilter}
            counts={importanceCounts}
          />
        </div>

        {loading ? (
          <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500 text-sm">
            加载中...
          </div>
        ) : recent.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500 text-sm">
            {selectedCompetitorId === 'all'
              ? '暂无采集记录。'
              : `「${selectedName}」暂无采集记录。`}
            {competitors.length === 0 && (
              <Link href="/dashboard/competitors" className="text-blue-600 hover:underline ml-1">
                添加竞对
              </Link>
            )}
          </div>
        ) : filteredRecent.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500 text-sm">
            当前重要度筛选下没有匹配的记录。
            <button
              type="button"
              onClick={() => setImportanceFilter(new Set(IMPORTANCE_LEVELS))}
              className="text-blue-600 hover:underline ml-1"
            >
              显示全部重要度
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRecent.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/snapshots/${s.competitorId}/${s.id}`}
                className="block bg-white p-4 rounded-lg border border-slate-200 hover:shadow-md hover:border-blue-300 transition"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      {selectedCompetitorId === 'all' && competitorNameById.has(s.competitorId) && (
                        <span className="font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                          {competitorNameById.get(s.competitorId)}
                        </span>
                      )}
                      <span>{new Date(s.crawledAt).toLocaleString('zh-CN')}</span>
                    </div>
                    <div className="font-medium text-slate-900 mt-1">
                      {s.changeType || '未分类'}
                    </div>
                    <div className="text-sm text-slate-600 mt-1 line-clamp-2">
                      {s.summary || '（无摘要）'}
                    </div>
                  </div>
                  {s.importance && (
                    <span
                      className={`ml-3 px-3 py-1 text-xs rounded-full whitespace-nowrap ${importanceColor(
                        s.importance,
                      )}`}
                    >
                      {s.importance}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 快速开始 */}
      {competitors.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 p-5 rounded-lg">
          <h4 className="font-semibold text-slate-900 mb-2">快速开始</h4>
          <ol className="text-sm text-slate-700 space-y-1 list-decimal list-inside">
            <li>点击左侧"添加竞对"录入要监控的网站 URL</li>
            <li>系统将在下一个采集周期自动开始监控</li>
            <li>有内容变化时，AI 会自动生成解读摘要</li>
            <li>回到主页查看最近变化，或在"添加竞对"页点击"查看历史"</li>
          </ol>
        </div>
      )}
    </div>
  );
}