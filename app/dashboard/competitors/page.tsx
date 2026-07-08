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
  createdAt: string;
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
          competitors.map((comp) => (
            <div key={comp.id} className="bg-white p-4 rounded-lg border border-slate-200 flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">{comp.name}</h3>
                <p className="text-sm text-slate-600 truncate">{comp.websiteUrl}</p>
                <div className="mt-2 flex gap-2 text-xs text-slate-500">
                  {comp.industry && <span className="bg-slate-100 px-2 py-1 rounded">{comp.industry}</span>}
                  {comp.notes && <span className="bg-slate-100 px-2 py-1 rounded">{comp.notes}</span>}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Link
                  href={`/dashboard/snapshots/${comp.id}`}
                  className="px-3 py-1 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition"
                >
                  查看历史
                </Link>
                <button
                  onClick={() => handleDelete(comp.id)}
                  className="px-3 py-1 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded transition"
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
