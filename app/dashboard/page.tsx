'use client';

import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">欢迎回来</h2>

      <div className="grid md:grid-cols-2 gap-6">
        <Link
          href="/dashboard/competitors"
          className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border-2 border-blue-200 hover:shadow-lg transition cursor-pointer"
        >
          <h3 className="text-lg font-semibold text-slate-900 mb-2">竞对管理</h3>
          <p className="text-slate-600">添加、修改或删除监控的竞对网站</p>
        </Link>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-lg border-2 border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">系统状态</h3>
          <p className="text-slate-600 text-sm">定时采集每小时运行一次，自动监控所有竞对网站的变化</p>
          <p className="text-slate-500 text-xs mt-4">下一次采集时间待更新</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h4 className="font-semibold text-slate-900 mb-2">快速开始</h4>
        <ol className="text-sm text-slate-700 space-y-1 list-decimal list-inside">
          <li>点击"竞对管理"添加要监控的网站 URL</li>
          <li>系统将在下一个采集周期自动开始监控</li>
          <li>有内容变化时，AI 会自动生成解读摘要</li>
          <li>点击竞对的"查看历史"查看所有变化记录</li>
        </ol>
      </div>
    </div>
  );
}
