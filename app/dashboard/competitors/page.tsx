'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Competitor {
  id: number;
  userId: number;
  name: string;
  websiteUrl: string;
  industry?: string;
  notes?: string;
  monitoringEnabled: boolean;
  createdAt: string;
}

// AI 推荐面板的候选条结构（与 lib/competitor-suggest.ts 对齐）
interface SuggestedCompetitor {
  name: string;
  websiteUrl: string;
  industry: string;
  notes: string;
  suggestedPaths: string[];
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 暂停/恢复监控的 in-flight id 集合（防止用户连点导致竞态）
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  // —— AI 推荐面板状态 ——
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [productUrl, setProductUrl] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiCandidates, setAiCandidates] = useState<SuggestedCompetitor[]>([]);
  const [aiSelectedIds, setAiSelectedIds] = useState<Set<number>>(new Set());
  const [aiBatchCreating, setAiBatchCreating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [aiSearched, setAiSearched] = useState(false); // 区分"未点过"与"已点但空"

  useEffect(() => {
    fetchCompetitors();
  }, []);

  const fetchCompetitors = async () => {
    try {
      const res = await fetch('/api/competitors');
      if (!res.ok) throw new Error('获取竞对列表失败');
      const data = await res.json();
      setCompetitors(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, websiteUrl, industry, notes }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '添加失败');
      }

      setName('');
      setWebsiteUrl('');
      setIndustry('');
      setNotes('');
      setShowForm(false);
      await fetchCompetitors();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除？')) return;

    try {
      const res = await fetch(`/api/competitors/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      await fetchCompetitors();
    } catch (err) {
      setError(String(err));
    }
  };

  // 暂停 / 恢复监控：只切换 monitoringEnabled，历史 snapshot 保留
  const handleToggleMonitoring = async (id: number, nextEnabled: boolean) => {
    if (togglingIds.has(id)) return; // 已有请求在飞，幂等忽略
    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      const res = await fetch(`/api/competitors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitoringEnabled: nextEnabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '操作失败');
      }
      await fetchCompetitors();
    } catch (err) {
      setError(String(err));
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // —— AI 推荐 ——
  const handleAiSuggest = async () => {
    if (!productUrl.trim() && !productDescription.trim() && !industry.trim()) {
      setAiError('请至少填写产品 URL、产品描述或行业之一');
      return;
    }
    setAiSuggesting(true);
    setAiError('');
    setAiMessage('');
    setAiCandidates([]);
    setAiSelectedIds(new Set());
    setAiSearched(true);
    try {
      const res = await fetch('/api/competitors/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productUrl: productUrl.trim() || undefined,
          productDescription: productDescription.trim() || undefined,
          industry: industry.trim() || undefined,
          count: aiCount,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'AI 推荐失败');
      }
      const data = await res.json();
      const list: SuggestedCompetitor[] = Array.isArray(data.candidates) ? data.candidates : [];
      setAiCandidates(list);
      setAiSelectedIds(new Set(list.map((_, i) => i))); // 默认全选
    } catch (err) {
      setAiError(String(err));
    } finally {
      setAiSuggesting(false);
    }
  };

  const toggleAiOne = (index: number) => {
    setAiSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAiAll = () => {
    if (aiSelectedIds.size === aiCandidates.length) {
      setAiSelectedIds(new Set());
    } else {
      setAiSelectedIds(new Set(aiCandidates.map((_, i) => i)));
    }
  };

  // —— 批量入库 ——
  const handleAiBatchCreate = async () => {
    const chosen = aiCandidates
      .filter((_, i) => aiSelectedIds.has(i))
      .map((c) => ({
        name: c.name,
        websiteUrl: c.websiteUrl,
        industry: c.industry,
        notes: c.notes,
      })); // ← suggestedPaths 不入库（V1 仅展示）
    if (chosen.length === 0) return;
    if (!confirm(`确认添加 ${chosen.length} 个竟对?`)) return;

    setAiBatchCreating(true);
    setAiError('');
    try {
      const res = await fetch('/api/competitors/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitors: chosen }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '批量添加失败');
      }
      const data = await res.json();
      setAiCandidates([]);
      setAiSelectedIds(new Set());
      setProductUrl('');
      setProductDescription('');
      // 成功后行业保留（与"产品 URL/描述不持久化、仅一次性使用"的决策一致——行业下次仍可复用，但 URL/描述清空避免误用）
      const skipNote = Array.isArray(data.skipped) && data.skipped.length > 0 ? ` (跳过 ${data.skipped.length} 条重复)` : '';
      setAiMessage(`已添加 ${data.created} 条${skipNote}`);
      await fetchCompetitors();
    } catch (err) {
      setAiError(String(err));
    } finally {
      setAiBatchCreating(false);
    }
  };

  const aiHasAnyInput = !!(productUrl.trim() || productDescription.trim() || industry.trim());

  if (loading) {
    return <div className="text-slate-600">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">竞对管理</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          {showForm ? '取消' : '添加竞对'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* —— AI 智能推荐面板 —— */}
      <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAiPanel(!showAiPanel)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
        >
          <div>
            <div className="font-semibold text-slate-900">AI 智能推荐 — 按我的产品</div>
            <div className="text-xs text-slate-500 mt-0.5">
              输入你的产品上下文，AI 推荐潜在竞品与可监控范围
            </div>
          </div>
          <span className="text-slate-500 text-sm">{showAiPanel ? '收起 ▴' : '展开 ▾'}</span>
        </button>

        {showAiPanel && (
          <div className="px-6 pb-6 space-y-4 border-t border-slate-200 pt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                我的产品 URL <span className="text-slate-400 text-xs">（可选，用于爬取主页）</span>
              </label>
              <input
                type="url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://myapp.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                我的产品描述 <span className="text-slate-400 text-xs">（可选，如"我们做 X，服务 Y，差异化 Z"）</span>
              </label>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                rows={3}
                placeholder="我们做项目管理 SaaS，主打团队 OKR 与周报自动化，服务 50-500 人团队"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  兜底行业 <span className="text-slate-400 text-xs">（可选）</span>
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="SaaS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">推荐数量</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={aiCount}
                  onChange={(e) => setAiCount(Math.max(1, Math.min(10, Number(e.target.value) || 5)))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {aiError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {aiError}
              </div>
            )}
            {aiMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {aiMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handleAiSuggest}
              disabled={!aiHasAnyInput || aiSuggesting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg transition"
            >
              {aiSuggesting ? 'AI 推荐中（可能含爬取）...' : '生成候选'}
            </button>

            {/* —— 候选列表 —— */}
            {aiCandidates.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-sm text-slate-700">
                  <div>
                    <button
                      type="button"
                      onClick={toggleAiAll}
                      className="text-blue-600 hover:underline"
                    >
                      {aiSelectedIds.size === aiCandidates.length ? '取消全选' : '全选'}
                    </button>
                    <span className="ml-3 text-slate-500">已选 {aiSelectedIds.size} / {aiCandidates.length} 条</span>
                  </div>
                </div>
                <ul className="space-y-2">
                  {aiCandidates.map((c, i) => (
                    <li
                      key={`${c.websiteUrl}-${i}`}
                      className={`flex items-start gap-3 px-3 py-3 rounded-lg border ${
                        aiSelectedIds.has(i)
                          ? 'border-blue-300 bg-blue-50/40'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={aiSelectedIds.has(i)}
                        onChange={() => toggleAiOne(i)}
                        className="mt-1 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{c.name}</span>
                          {c.industry && (
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                              {c.industry}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 truncate">{c.websiteUrl}</div>
                        {c.notes && (
                          <div className="text-xs text-slate-500 mt-1">备注：{c.notes}</div>
                        )}
                        {c.suggestedPaths.length > 0 && (
                          <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1 flex-wrap">
                            <span>建议监控:</span>
                            {c.suggestedPaths.map((p) => (
                              <span
                                key={p}
                                className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        )}
                        {c.suggestedPaths.length === 0 && (
                          <div className="text-xs text-slate-400 mt-1.5">AI 未给出监控路径建议</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={handleAiBatchCreate}
                  disabled={aiSelectedIds.size === 0 || aiBatchCreating}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg transition"
                >
                  {aiBatchCreating ? '添加中...' : `添加选中的 ${aiSelectedIds.size} 条`}
                </button>
              </div>
            )}

            {/* 未搜过：提示用户输入；搜过但空：明确告诉用户 AI 没找到 */}
            {!aiSuggesting && aiCandidates.length === 0 && !aiMessage && !aiError && !aiSearched && (
              <div className="text-xs text-slate-400">填写后点击"生成候选"，AI 会推荐潜在竞品。</div>
            )}
            {!aiSuggesting && aiCandidates.length === 0 && !aiMessage && !aiError && aiSearched && (
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                AI 暂未匹配到结果。可换更详细的描述或行业再试，或手动添加。
              </div>
            )}
          </div>
        )}
      </section>

      {showForm && (
        <form onSubmit={handleAddCompetitor} className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">名称 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">网址 *</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">行业</label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white rounded-lg transition"
          >
            {submitting ? '添加中...' : '确认添加'}
          </button>
        </form>
      )}

      <div className="grid gap-4">
        {competitors.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-white rounded-lg border border-slate-200">
            暂无竞对，
            <button
              onClick={() => setShowForm(true)}
              className="text-blue-600 hover:underline"
            >
              添加一个
            </button>
          </div>
        ) : (
          competitors.map((comp) => {
            const isMonitoring = comp.monitoringEnabled !== false; // 老数据无字段时按"监控中"兜底
            const isToggling = togglingIds.has(comp.id);
            return (
              <div
                key={comp.id}
                className={`bg-white p-4 rounded-lg border flex justify-between items-start ${
                  isMonitoring ? 'border-slate-200' : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-semibold ${isMonitoring ? 'text-slate-900' : 'text-slate-500'}`}>
                      {comp.name}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        isMonitoring
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                      title={isMonitoring ? '已开启自动监控' : '已暂停监控（历史保留）'}
                    >
                      {isMonitoring ? '监控中' : '已暂停'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 truncate">{comp.websiteUrl}</p>
                  <div className="mt-2 flex gap-2 text-xs text-slate-500">
                    {comp.industry && <span className="bg-slate-100 px-2 py-1 rounded">{comp.industry}</span>}
                    {comp.notes && <span className="bg-slate-100 px-2 py-1 rounded">{comp.notes}</span>}
                  </div>
                </div>
                <div className="flex gap-2 ml-4 flex-shrink-0">
                  <Link
                    href={`/dashboard/snapshots/${comp.id}`}
                    className="px-3 py-1 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition"
                  >
                    查看历史
                  </Link>
                  <button
                    onClick={() => handleToggleMonitoring(comp.id, !isMonitoring)}
                    disabled={isToggling}
                    className={`px-3 py-1 text-sm rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${
                      isMonitoring
                        ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    {isToggling ? '处理中…' : isMonitoring ? '暂停监控' : '恢复监控'}
                  </button>
                  <button
                    onClick={() => handleDelete(comp.id)}
                    className="px-3 py-1 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded transition"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
