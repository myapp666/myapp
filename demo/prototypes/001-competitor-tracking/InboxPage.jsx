import { useState } from "react";
import "./Inbox.css";

const MOCK_EMAILS = [
  {
    id: 1,
    subject: "[高] example.com 产品定价页面重大更新",
    from: "monitor@company.com",
    time: "2026-07-07 14:35",
    read: false,
    summary: "检测到 example.com 产品定价页面新增 Enterprise 套餐入口，价格策略改为\"联系销售\"模式。",
    detail: "变化详情：\n- 新增 Enterprise 套餐卡片\n- 原 Pro 套餐价格保持 ¥299/月 不变\n- Enterprise 套餐强调在线客服、SLA 承诺等增值服务\n- 页面底部新增\"联系销售\"CTA 按钮\n\n建议关注：竞对可能在向企业级市场扩展。",
  },
  {
    id: 2,
    subject: "[高] competitor-b.com 发布新版本 v3.0",
    from: "monitor@company.com",
    time: "2026-07-07 18:50",
    read: false,
    summary: "competitor-b.com 发布新版本 v3.0，含 AI 助手功能和新的集成选项。",
    detail: "变化详情：\n- 新增 AI 助手功能（基于 GPT-4）\n- 新增 Slack / Teams 集成\n- 改版定价页，新增 AI 附加包 ¥99/月\n- 更新产品截图和演示视频\n\n建议关注：AI 功能可能对我们的核心用户产生吸引力。",
  },
  {
    id: 3,
    subject: "[中] example.com 首页 banner 更换",
    from: "monitor@company.com",
    time: "2026-07-06 09:20",
    read: true,
    summary: "首页 banner 更换为新的夏季促销活动，配图和文案已更新。",
    detail: "变化详情：\n- Banner 主题：夏季限时优惠\n- 优惠内容：年付 8 折\n- 活动截止：2026-08-31\n- 新增倒计时组件\n\n影响评估：常规营销活动，优先级中等。",
  },
  {
    id: 4,
    subject: "[低] example.com 页脚版权年份更新",
    from: "monitor@company.com",
    time: "2026-07-05 22:05",
    read: true,
    summary: "页脚版权年份更新为 2026，无实质内容变化。",
    detail: "变化详情：\n- 版权声明从 © 2025 更新为 © 2026\n- 无其他变化\n\n影响评估：例行更新，无需关注。",
  },
];

export default function InboxPage({ onBack }) {
  const [emails, setEmails] = useState(() => {
    const readIds = JSON.parse(localStorage.getItem("inbox_read") || "[]");
    return MOCK_EMAILS.map((e) => ({ ...e, read: readIds.includes(e.id) || e.read }));
  });
  const [expandedId, setExpandedId] = useState(null);

  const unreadCount = emails.filter((e) => !e.read).length;

  const markAsRead = (id) => {
    const updated = emails.map((e) => (e.id === id ? { ...e, read: true } : e));
    setEmails(updated);
    const readIds = updated.filter((e) => e.read).map((e) => e.id);
    localStorage.setItem("inbox_read", JSON.stringify(readIds));
  };

  const markAllRead = () => {
    const updated = emails.map((e) => ({ ...e, read: true }));
    setEmails(updated);
    localStorage.setItem("inbox_read", JSON.stringify(updated.map((e) => e.id)));
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
    markAsRead(id);
  };

  const getImportanceFromSubject = (subject) => {
    if (subject.startsWith("[高]")) return "high";
    if (subject.startsWith("[中]")) return "medium";
    return "low";
  };

  return (
    <div className="inbox-page">
      <button className="btn-back" onClick={onBack}>← 返回</button>
      <div className="inbox-header">
        <h1>收信箱</h1>
        <div className="inbox-actions">
          <span className="unread-badge">{unreadCount} 封未读</span>
          {unreadCount > 0 && (
            <button className="btn-mark-all" onClick={markAllRead}>全部标为已读</button>
          )}
        </div>
      </div>

      <div className="email-list">
        {emails.map((email) => (
          <div
            key={email.id}
            className={`email-item ${!email.read ? "unread" : ""} ${expandedId === email.id ? "expanded" : ""}`}
            onClick={() => toggleExpand(email.id)}
          >
            <div className="email-row">
              <span className={`importance-dot ${getImportanceFromSubject(email.subject)}`} />
              <div className="email-content">
                <div className="email-subject">{email.subject}</div>
                <div className="email-summary">{email.summary}</div>
              </div>
              <div className="email-meta">
                <span className="email-time">{email.time}</span>
                {!email.read && <span className="dot-unread" />}
              </div>
            </div>
            {expandedId === email.id && (
              <div className="email-detail">
                <div className="detail-from">发件人：{email.from}</div>
                <pre className="detail-body">{email.detail}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
