import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '竞争情报监控',
  description: '自动化竞对网站变更监控与 AI 解读',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
