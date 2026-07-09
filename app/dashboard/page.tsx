'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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
  archivedAt?: string | null;
}

// 视图模式：只显示未归档 / 只显示已归档 / 全部
type ArchiveView = 'active' | 'archived' | 'all';

const ARCHIVE_VIEW_PARAMS: Record<ArchiveView, string> = {
  active: 'false',
  archived: 'true',
  all: 'all',
};

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string>('all');
  const [recent, setRecent] = useState<Snapshot[]>([]);
  const [monitorInterval, setMonitorInterval] = useState<number>(60);
  const [loading, setLoading] = useState(true);

  // 归档视图与多选状态
  const [archiveView, setArchiveView] = useState<ArchiveView>('active');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // 用来强制重新拉取列表（执行批量操作后用）
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // 初次加载 user / competitors / 配置
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

  // 加载 snapshots（按 竞对 + 归档视图 筛选）
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', '100');
        params.set('archived', ARCHIVE_VIEW_PARAMS[archiveView]);
        if (selectedCompetitorId !== 'all') {
          params.set('competitor_id', selectedCompetitorId);
        }
        const res = await fetch(`/api/snapshots?${params.toString()}`);
        if (!res.ok) throw new Error('加载记录失败');
        setRecent(await res.json());
        // 切换视图或竞对时清空多选
        setSelectedIds(new Set());
      } catch (err) {
        console.error(err);
        setRecent([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedCompetitorId, archiveView, refreshKey]);

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

  // 多选 helper
  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(recent.map((s) => s.id)));
  };
  const allVisibleChecked = recent.length > 0 && selectedIds.size === recent.length;
  const someVisibleChecked = selectedIds.size > 0 && selectedIds.size < recent.length;

  // 批量归档 / 取消归档
  const bulkArchive = async (archived: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/snapshots/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds], archived }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`操作失败：${data.error ?? res.statusText}`);
        return;
      }
      // 重新拉取，保证与服务端一致
      triggerRefresh();
    } finally {
      setBulkBusy(false);
    }
  };

  // 视图切换器（按钮组）
  const viewOptions: { key: ArchiveView; label: string }[] = useMemo(
    () => [
      { key: 'active', label: '未归档' },
      { key: 'archived', label: '已归档' },
      { key: 'all', label: '全部' },
    ],
    [],
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
          <div className="text-sm text-slate-500">当前视图</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{recent.length}</div>
          <div className="text-xs text-slate-400 mt-2">
            {archiveView === 'active' ? '未归档条目' : archiveView === 'archived' ? '已归档条目' : '全部条目'}
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
              <span>共 <span className="font-medium text-slate-700">{recent.length}</span> 条</span>
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs">
              {viewOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setArchiveView(opt.key)}
                  className={`px-3 py-1.5 rounded-md transition ${
                    archiveView === opt.key
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="competitor-select" className="text-sm text-slate-600 whitespace-nowrap">
                竞对：
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
        </div>

        {/* 批量操作工具条（仅当选中至少 1 项时显示） */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg text-sm">
            <span className="text-blue-900 font-medium">已选 {selectedIds.size} 条</span>
            <button
              type="button"
              onClick={() => bulkArchive(true)}
              disabled={bulkBusy}
              className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {archiveView === 'archived' ? '再归档' : '归档'}
            </button>
            <button
              type="button"
              onClick={() => bulkArchive(false)}
              disabled={bulkBusy}
              className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              取消归档
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkBusy}
              className="px-2 py-1 text-blue-700 hover:underline"
            >
              清空选择
            </button>
            {bulkBusy && <span className="text-slate-500 text-xs">处理中…</span>}
          </div>
        )}

        {loading ? (
          <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500 text-sm">
            加载中...
          </div>
        ) : recent.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500 text-sm">
            {selectedCompetitorId === 'all' && archiveView === 'active' && competitors.length > 0
              ? '当前没有未处理的变更。切换到"已归档"查看历史。'
              : selectedCompetitorId === 'all'
                ? '暂无采集记录。'
                : `「${selectedName}」暂无采集记录。`}
            {competitors.length === 0 && (
              <Link href="/dashboard/competitors" className="text-blue-600 hover:underline ml-1">
                添加竞对
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* 表头：全选 */}
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={allVisibleChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someVisibleChecked;
                }}
                onChange={(e) => toggleAllVisible(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                aria-label="全选当前视图"
              />
              <span>
                {selectedIds.size > 0
                  ? `已选 ${selectedIds.size} / ${recent.length}`
                  : `共 ${recent.length} 条`}
              </span>
            </div>

            {recent.map((s) => {
              const isArchived = !!s.archivedAt;
              const archivedDays = isArchived ? daysSince(s.archivedAt) : null;
              return (
                <div
                  key={s.id}
                  className={`flex items-stretch gap-3 bg-white p-4 rounded-lg border transition ${
                    isArchived
                      ? 'border-slate-200 bg-slate-50/60'
                      : 'border-slate-200 hover:shadow-md hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center pt-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleOne(s.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`选择 ${s.id}`}
                    />
                  </div>
                  <Link
                    href={`/dashboard/snapshots/${s.competitorId}/${s.id}`}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className={`flex-1 min-w-0 ${isArchived ? 'opacity-60' : ''}`}>
                        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          {selectedCompetitorId === 'all' && competitorNameById.has(s.competitorId) && (
                            <span className="font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                              {competitorNameById.get(s.competitorId)}
                            </span>
                          )}
                          <span>{new Date(s.crawledAt).toLocaleString('zh-CN')}</span>
                          {isArchived && archivedDays !== null && (
                            <span className="text-slate-400">
                              · 已归档 {archivedDays === 0 ? '今天' : `${archivedDays} 天前`}
                            </span>
                          )}
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
                </div>
              );
            })}
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