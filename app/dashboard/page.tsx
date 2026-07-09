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
  readAt?: string | null;
}

// 视图模式：只显示未归档 / 只显示已归档 / 全部
type ArchiveView = 'active' | 'archived' | 'all';

const ARCHIVE_VIEW_PARAMS: Record<ArchiveView, string> = {
  active: 'false',
  archived: 'true',
  all: 'all',
};

// 重要度筛选
const IMPORTANCE_LEVELS = ['高', '中', '低'] as const;
type ImportanceLevel = (typeof IMPORTANCE_LEVELS)[number];

const DEFAULT_SELECTED_IMPORTANCE: ReadonlySet<ImportanceLevel> = new Set(['高', '中']);
const IMPORTANCE_FILTER_KEY = 'dashboard:filter:importance';

const IMPORTANCE_CHIP_ACTIVE: Record<ImportanceLevel, string> = {
  高: 'bg-red-100 text-red-700 border-red-200',
  中: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  低: 'bg-green-100 text-green-700 border-green-200',
};

function isImportanceLevel(s: unknown): s is ImportanceLevel {
  return typeof s === 'string' && (IMPORTANCE_LEVELS as readonly string[]).includes(s);
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

// summary 分段解析：识别 【变更】【意图】【行动】【理由】四类标签
// 返回结构化的段列表，按出现顺序渲染
type SummarySection = { key: 'change' | 'intent' | 'action' | 'reason' | 'plain'; text: string };

const SECTION_KEY_MAP: Record<string, SummarySection['key']> = {
  变更: 'change',
  意图: 'intent',
  行动: 'action',
  理由: 'reason',
};

function parseSummarySections(summary: string): SummarySection[] {
  const pattern = /【(变更|意图|行动|理由)】/g;
  const out: SummarySection[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(summary)) !== null) {
    if (m.index > lastIndex) {
      const leading = summary.slice(lastIndex, m.index).trim();
      if (leading) out.push({ key: 'plain', text: leading });
    }
    const key = SECTION_KEY_MAP[m[1]] ?? 'plain';
    lastIndex = pattern.lastIndex;
    // 找到下一个段头位置
    const rest = summary.slice(lastIndex);
    const nextMatch = rest.match(/【(变更|意图|行动|理由)】/);
    const segEnd = nextMatch ? nextMatch.index ?? rest.length : rest.length;
    out.push({ key, text: rest.slice(0, segEnd).trim() });
    lastIndex += segEnd;
    // 重置 lastIndex 因为我们用 slice 处理
  }
  if (lastIndex < summary.length) {
    const trailing = summary.slice(lastIndex).trim();
    if (trailing) out.push({ key: 'plain', text: trailing });
  }
  if (out.length === 0 && summary) out.push({ key: 'plain', text: summary });
  return out;
}

const SECTION_STYLES: Record<SummarySection['key'], { label: string; bg: string; text: string; ring: string }> = {
  change: { label: '变更', bg: 'bg-blue-50',    text: 'text-blue-900',    ring: 'ring-blue-200' },
  intent: { label: '意图', bg: 'bg-purple-50',  text: 'text-purple-900',  ring: 'ring-purple-200' },
  action: { label: '行动', bg: 'bg-orange-50',  text: 'text-orange-900',  ring: 'ring-orange-200' },
  reason: { label: '理由', bg: 'bg-emerald-50', text: 'text-emerald-900', ring: 'ring-emerald-200' },
  plain:  { label: '',    bg: 'bg-slate-50',   text: 'text-slate-800',   ring: 'ring-slate-200' },
};

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

  // 重要度筛选：默认 ['高', '中']（隐藏低），从 localStorage 恢复用户偏好
  const [selectedImportance, setSelectedImportance] = useState<Set<ImportanceLevel>>(
    () => new Set<ImportanceLevel>(DEFAULT_SELECTED_IMPORTANCE),
  );
  const [importanceHydrated, setImportanceHydrated] = useState(false);

  // 分页：每页 100 条；切换 filter 时自动回到第 1 页
  const PAGE_SIZE = 100;
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  // 用来强制重新拉取列表（执行批量操作后用）
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // 详情弹窗：当前打开的 snapshot id（null = 未打开）
  const [openSnapshotId, setOpenSnapshotId] = useState<number | null>(null);
  const closeModal = useCallback(() => setOpenSnapshotId(null), []);

  // ESC 键关闭弹窗
  useEffect(() => {
    if (openSnapshotId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSnapshotId, closeModal]);

  // 弹窗打开时锁滚动
  useEffect(() => {
    if (openSnapshotId === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openSnapshotId]);

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

  // 加载 snapshots（按 竞对 + 归档视图 + 分页 筛选）
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('archived', ARCHIVE_VIEW_PARAMS[archiveView]);
        params.set('page', String(page));
        params.set('pageSize', String(PAGE_SIZE));
        if (selectedCompetitorId !== 'all') {
          params.set('competitor_id', selectedCompetitorId);
        }
        const res = await fetch(`/api/snapshots?${params.toString()}`);
        if (!res.ok) throw new Error('加载记录失败');
        const totalHeader = res.headers.get('X-Total-Count');
        setTotal(totalHeader ? Number(totalHeader) : 0);
        setRecent(await res.json());
        // 切换视图或竞对时清空多选
        setSelectedIds(new Set());
      } catch (err) {
        console.error(err);
        setRecent([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedCompetitorId, archiveView, page, refreshKey]);

  // 任何 filter 变化都把 page 重置到 1（但 page 自身变化不触发）
  useEffect(() => {
    setPage(1);
  }, [selectedCompetitorId, archiveView]);

  // 从 localStorage 恢复用户上次选中的重要度（仅客户端，避免 SSR hydration 不匹配）
  useEffect(() => {
    try {
      const saved = localStorage.getItem(IMPORTANCE_FILTER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(isImportanceLevel);
          if (valid.length > 0) {
            setSelectedImportance(new Set(valid));
          }
        }
      }
    } catch {}
    setImportanceHydrated(true);
  }, []);

  // 用户改变后持久化；hydration 前的默认状态不写回（避免覆盖已有偏好）
  useEffect(() => {
    if (!importanceHydrated) return;
    try {
      localStorage.setItem(IMPORTANCE_FILTER_KEY, JSON.stringify([...selectedImportance]));
    } catch {}
  }, [selectedImportance, importanceHydrated]);

  const importanceColor = (i?: string | null) => {
    const map: Record<string, string> = {
      高: 'bg-red-100 text-red-700',
      中: 'bg-yellow-100 text-yellow-700',
      低: 'bg-green-100 text-green-700',
    };
    return map[i || ''] || 'bg-gray-100 text-gray-700';
  };

  // 重要度筛选派生值
  const toggleImportance = (level: ImportanceLevel) => {
    setSelectedImportance((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };
  const resetImportanceFilter = () => {
    setSelectedImportance(new Set(DEFAULT_SELECTED_IMPORTANCE));
  };

  // 全部 recent 里的各重要度计数（用来在 chip 上展示）
  const importanceCounts = useMemo(() => {
    const counts: Record<string, number> = { 高: 0, 中: 0, 低: 0, '': 0 };
    for (const s of recent) {
      const key = s.importance ?? '';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [recent]);

  // 应用重要度筛选后的列表；
  // 空/未分类的 importance 永远保留（AI 解读失败的情况不应被隐藏）
  const filteredRecent = useMemo(() => {
    return recent.filter((s) => {
      const imp = s.importance ?? '';
      if (!imp) return true;
      return selectedImportance.has(imp as ImportanceLevel);
    });
  }, [recent, selectedImportance]);

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
    setSelectedIds(new Set(filteredRecent.map((s) => s.id)));
  };
  const allVisibleChecked =
    filteredRecent.length > 0 && selectedIds.size === filteredRecent.length;
  const someVisibleChecked =
    selectedIds.size > 0 && selectedIds.size < filteredRecent.length;

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

  // 单条标为已读（fire-and-forget + 本地乐观更新）
  const markRead = useCallback((id: number, read: boolean) => {
    const next = new Date().toISOString();
    setRecent((prev) =>
      prev.map((s) => (s.id === id ? { ...s, readAt: read ? next : null } : s)),
    );
    fetch(`/api/snapshots/${id}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read }),
    }).catch((err) => console.error('mark-read failed', err));
  }, []);

  // 批量标已读 / 取消已读
  const bulkRead = async (read: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/snapshots/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds], read }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`操作失败：${data.error ?? res.statusText}`);
        return;
      }
      triggerRefresh();
    } finally {
      setBulkBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;

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
            <h3 className="text-lg font-semibold text-slate-900">情报收集箱</h3>
            <p className="text-xs text-slate-500 mt-1">
              当前筛选：<span className="font-medium text-slate-700">{selectedName}</span>
              {' · '}
              <span>
                第 <span className="font-medium text-slate-700">{page}</span> / {totalPages} 页 · 共
                <span className="font-medium text-slate-700"> {total} </span>条
              </span>
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

        {/* 重要度筛选 chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 whitespace-nowrap">重要度：</span>
          {IMPORTANCE_LEVELS.map((level) => {
            const active = selectedImportance.has(level);
            const count = importanceCounts[level] ?? 0;
            return (
              <button
                key={level}
                type="button"
                onClick={() => toggleImportance(level)}
                aria-pressed={active}
                className={`px-3 py-1 text-xs rounded-full border transition ${
                  active
                    ? IMPORTANCE_CHIP_ACTIVE[level]
                    : 'bg-white text-slate-400 border-slate-200'
                }`}
              >
                <span className={active ? 'font-medium' : 'line-through'}>{level}</span>
                <span className="ml-1.5 opacity-70">{count}</span>
              </button>
            );
          })}
          {importanceCounts[''] ? (
            <span className="ml-1 px-2 py-1 text-xs rounded-full border border-dashed border-slate-200 text-slate-400">
              未分类 {importanceCounts['']}
            </span>
          ) : null}
          <button
            type="button"
            onClick={resetImportanceFilter}
            className="ml-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
          >
            重置
          </button>
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
            <span className="w-px h-5 bg-blue-200" aria-hidden />
            <button
              type="button"
              onClick={() => bulkRead(true)}
              disabled={bulkBusy}
              className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              标为已读
            </button>
            <button
              type="button"
              onClick={() => bulkRead(false)}
              disabled={bulkBusy}
              className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              标为未读
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
        ) : filteredRecent.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500 text-sm">
            当前重要度筛选下没有匹配项。点
            <button
              type="button"
              onClick={resetImportanceFilter}
              className="mx-1 text-blue-600 hover:underline"
            >
              重置
            </button>
            看全部。
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
                  ? `已选 ${selectedIds.size} / ${filteredRecent.length}`
                  : `共 ${filteredRecent.length} 条`}
              </span>
            </div>

            {filteredRecent.map((s) => {
              const isArchived = !!s.archivedAt;
              const archivedDays = isArchived ? daysSince(s.archivedAt) : null;
              const isUnread = !s.readAt;
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
                    onClick={(e) => {
                      // 阻止跳转，就地打开弹窗；只对未读项触发标记
                      e.preventDefault();
                      if (isUnread) markRead(s.id, true);
                      setOpenSnapshotId(s.id);
                    }}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className={`flex-1 min-w-0 ${isArchived ? 'opacity-60' : ''}`}>
                        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          {isUnread && (
                            <span
                              className="inline-block w-2 h-2 rounded-full bg-blue-500"
                              aria-label="未读"
                              title="未读"
                            />
                          )}
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
                        <div className={`mt-1 font-medium text-slate-900`}>
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

            {/* 分页控件 */}
            {total > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!canPrev || loading}
                  className="px-3 py-1.5 text-sm rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← 上一页
                </button>
                <div className="text-xs text-slate-500">
                  第 <span className="font-medium text-slate-700">{page}</span> / {totalPages} 页 · 每页 {PAGE_SIZE} 条
                </div>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={!canNext || loading}
                  className="px-3 py-1.5 text-sm rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  下一页 →
                </button>
              </div>
            )}
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

      {/* 详情弹窗 */}
      {openSnapshotId !== null &&
        (() => {
          const snap = recent.find((s) => s.id === openSnapshotId);
          if (!snap) {
            // 列表已刷新/该项被过滤掉了，安全关闭
            return (
              <div
                className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
                onClick={closeModal}
              >
                <div className="bg-white rounded-lg p-6 text-slate-600 text-sm">
                  该记录已不可见（可能被过滤），点击任意处关闭。
                </div>
              </div>
            );
          }
          const comp = competitorNameById.get(snap.competitorId);
          const sections = parseSummarySections(snap.summary ?? '');
          const isUnread = !snap.readAt;
          const isArchived = !!snap.archivedAt;
          const modalBusy = bulkBusy; // 复用 busy 状态
          return (
            <div
              className="fixed inset-0 z-50 overflow-y-auto"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={closeModal}
                aria-hidden="true"
              />
              <div className="relative min-h-screen flex items-start justify-center p-4 sm:p-8">
                <div
                  className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl ring-1 ring-slate-200 my-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-100">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {comp && (
                          <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">
                            {comp}
                          </span>
                        )}
                        {isArchived && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-500">
                            已归档
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {new Date(snap.crawledAt).toLocaleString('zh-CN')}
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 mt-2">
                        {snap.changeType || '未分类'}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {snap.importance && (
                        <span
                          className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${importanceColor(
                            snap.importance,
                          )}`}
                        >
                          重要度 · {snap.importance}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={closeModal}
                        aria-label="关闭"
                        className="w-8 h-8 inline-flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      >
                        <span className="text-xl leading-none">×</span>
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-3">
                    {sections.length === 0 || !snap.summary ? (
                      <div className="text-sm text-slate-400 italic">（无摘要）</div>
                    ) : (
                      sections.map((sec, idx) => {
                        const style = SECTION_STYLES[sec.key];
                        return (
                          <div
                            key={idx}
                            className={`rounded-lg p-4 ring-1 ${style.bg} ${style.ring}`}
                          >
                            {style.label && (
                              <div
                                className={`text-xs font-semibold mb-1 ${style.text}`}
                              >
                                {style.label}
                              </div>
                            )}
                            <div
                              className={`text-sm leading-relaxed whitespace-pre-wrap ${style.text}`}
                            >
                              {sec.text}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50/60 rounded-b-xl">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setBulkBusy(true);
                          try {
                            const res = await fetch(
                              `/api/snapshots/${snap.id}/read`,
                              {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ read: !isUnread }),
                              },
                            );
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}));
                              alert(`操作失败：${data.error ?? res.statusText}`);
                              return;
                            }
                            markRead(snap.id, !isUnread);
                          } finally {
                            setBulkBusy(false);
                          }
                        }}
                        disabled={modalBusy}
                        className={`px-3 py-1.5 text-sm rounded border transition disabled:opacity-50 ${
                          isUnread
                            ? 'bg-white border-blue-300 text-blue-700 hover:bg-blue-50'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {isUnread ? '标为已读' : '标为未读'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setBulkBusy(true);
                          try {
                            const res = await fetch(
                              `/api/snapshots/${snap.id}/archive`,
                              {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ archived: !isArchived }),
                              },
                            );
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}));
                              alert(`操作失败：${data.error ?? res.statusText}`);
                              return;
                            }
                            triggerRefresh();
                          } finally {
                            setBulkBusy(false);
                          }
                        }}
                        disabled={modalBusy}
                        className={`px-3 py-1.5 text-sm rounded border transition disabled:opacity-50 ${
                          isArchived
                            ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {isArchived ? '取消归档' : '归档'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-1.5 text-sm rounded bg-slate-900 text-white hover:bg-slate-700 transition"
                    >
                      关闭
                    </button>
                  </div>

                  <div className="px-5 pb-3 text-xs text-slate-400">记录 ID: {snap.id}</div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}