// Demo only: 邮件发送配置页（临时演示功能）
import { useState } from "react";
import "./EmailSettings.css";

export default function EmailSettingsPage({ onBack }) {
  const [settings, setSettings] = useState({
    smtpServer: "smtp.gmail.com",
    smtpPort: 587,
    senderEmail: "monitor@company.com",
    recipients: "team@company.com",
    enableNotification: true,
    notifyOnImportant: true,
  });

  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = () => {
    localStorage.setItem("emailSettings", JSON.stringify(settings));
    setMessage("邮件设置已保存");
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <div className="email-settings-page">
      <button className="btn-back" onClick={onBack}>← 返回</button>
      <h1>邮件发送设置（演示）</h1>
      {message && <div className="success-message">{message}</div>}

      <div className="settings-card">
        <h2>SMTP 配置</h2>
        <div className="form-group">
          <label>SMTP 服务器</label>
          <input type="text" name="smtpServer" value={settings.smtpServer} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>SMTP 端口</label>
          <input type="number" name="smtpPort" value={settings.smtpPort} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>发件人邮箱</label>
          <input type="email" name="senderEmail" value={settings.senderEmail} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>收件人邮箱</label>
          <input type="text" name="recipients" value={settings.recipients} onChange={handleChange} placeholder="多个邮箱用逗号分隔" />
        </div>
      </div>

      <div className="settings-card">
        <h2>通知配置</h2>
        <label className="checkbox-label">
          <input type="checkbox" name="enableNotification" checked={settings.enableNotification} onChange={handleChange} />
          启用邮件通知
        </label>
        <label className="checkbox-label">
          <input type="checkbox" name="notifyOnImportant" checked={settings.notifyOnImportant} onChange={handleChange} />
          仅重要变化时通知
        </label>
      </div>

      <button className="btn-save" onClick={handleSave}>保存设置</button>
    </div>
  );
}
