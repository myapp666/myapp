'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Settings {
  id: number;
  email: string;
  username: string;
  emailNotifyEnabled: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/user/settings');
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        if (!res.ok) throw new Error('加载设置失败');
        const data = await res.json();
        setSettings(data);
      } catch (err) {
        setMessage({ type: 'error', text: String(err) });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const handleToggleNotify = async (next: boolean) => {
    if (!settings || saving) return;
    setSaving(true);
    setMessage(null);
    const previous = settings.emailNotifyEnabled;
    setSettings({ ...settings, emailNotifyEnabled: next });
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailNotifyEnabled: next }),
      });
      if (!res.ok) throw new Error('保存失败');
      const data = await res.json();
      setSettings(data);
      setMessage({ type: 'success', text: next ? '已开启邮件通知' : '已关闭邮件通知' });
    } catch (err) {
      setSettings({ ...settings, emailNotifyEnabled: previous });
      setMessage({ type: 'error', text: String(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return <div className="text-slate-600">加载中...</div>;
  }

  if (!settings) {
    return <div className="text-red-600">无法加载设置</div>;
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">设置</h2>
        <p className="text-sm text-slate-500 mt-1">管理账号信息与通知偏好</p>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 账号信息 */}
      <section className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">账号信息</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">用户名</dt>
            <dd className="text-slate-900 font-medium">{settings.username}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">邮箱</dt>
            <dd className="text-slate-900 font-medium">{settings.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">注册时间</dt>
            <dd className="text-slate-900">{new Date(settings.createdAt).toLocaleString('zh-CN')}</dd>
          </div>
        </dl>
      </section>

      {/* 通知设置 */}
      <section className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">通知设置</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-900">启动邮件通知</div>
            <p className="text-xs text-slate-500 mt-1">开启后，竞对发生变更时会发送邮件提醒</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.emailNotifyEnabled}
            disabled={saving}
            onClick={() => handleToggleNotify(!settings.emailNotifyEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              settings.emailNotifyEnabled ? 'bg-blue-600' : 'bg-slate-300'
            } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                settings.emailNotifyEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

      {/* 退出登录 */}
      <section className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">会话</h3>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition"
        >
          退出登录
        </button>
      </section>
    </div>
  );
}