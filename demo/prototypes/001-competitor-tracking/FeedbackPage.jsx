// Demo only: 意见反馈页（临时演示功能）
import { useState } from "react";
import "./Feedback.css";

export default function FeedbackPage({ onBack }) {
  const [feedback, setFeedback] = useState({
    type: "suggestion",
    title: "",
    description: "",
    email: "",
    attachScreenshot: false,
  });

  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFeedback((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!feedback.title || !feedback.description) {
      alert("请填写标题和描述");
      return;
    }
    const feedbackList = JSON.parse(localStorage.getItem("feedbackList") || "[]");
    feedbackList.push({
      ...feedback,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("feedbackList", JSON.stringify(feedbackList));
    setSubmitted(true);
    setTimeout(() => {
      setFeedback({ type: "suggestion", title: "", description: "", email: "", attachScreenshot: false });
      setSubmitted(false);
    }, 2000);
  };

  if (submitted) {
    return (
      <div className="feedback-page">
        <div className="success-banner">
          <h2>✓ 感谢您的反馈！</h2>
          <p>我们已收到您的意见，会尽快跟进。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-page">
      <button className="btn-back" onClick={onBack}>← 返回</button>
      <h1>意见反馈（演示）</h1>

      <form className="feedback-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>反馈类型</label>
          <select name="type" value={feedback.type} onChange={handleChange}>
            <option value="suggestion">建议</option>
            <option value="bug">问题报告</option>
            <option value="feature">功能请求</option>
            <option value="other">其他</option>
          </select>
        </div>

        <div className="form-group">
          <label>标题 *</label>
          <input
            type="text"
            name="title"
            value={feedback.title}
            onChange={handleChange}
            placeholder="简要描述您的反馈"
            maxLength={100}
          />
          <span className="char-count">{feedback.title.length}/100</span>
        </div>

        <div className="form-group">
          <label>详细描述 *</label>
          <textarea
            name="description"
            value={feedback.description}
            onChange={handleChange}
            placeholder="请详细说明您的意见..."
            rows={6}
            maxLength={1000}
          />
          <span className="char-count">{feedback.description.length}/1000</span>
        </div>

        <div className="form-group">
          <label>联系邮箱</label>
          <input
            type="email"
            name="email"
            value={feedback.email}
            onChange={handleChange}
            placeholder="选填：便于我们联系您"
          />
        </div>

        <label className="checkbox-label">
          <input
            type="checkbox"
            name="attachScreenshot"
            checked={feedback.attachScreenshot}
            onChange={handleChange}
          />
          附加截图（演示）
        </label>

        <button type="submit" className="btn-submit">提交反馈</button>
      </form>

      <div className="feedback-stats">
        <p>已收到反馈数：{JSON.parse(localStorage.getItem("feedbackList") || "[]").length}</p>
      </div>
    </div>
  );
}
