import { useState } from "react";
import "./AuthPages.css";

export default function LoginPage({ onLoginSuccess, onSwitchToRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("请输入邮箱");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("邮箱格式不正确");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || '登录失败');
        return;
      }

      const data = await response.json();
      localStorage.setItem('tokens', JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      }));
      localStorage.setItem('user', JSON.stringify({ email }));
      onLoginSuccess(email);
    } catch (err) {
      setError(err.message || '网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>登录</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-email">邮箱</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@example.com"
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">密码</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password123"
              disabled={loading}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        <div className="auth-footer">
          <p>
            还没有账号？
            <button type="button" className="link-btn" onClick={onSwitchToRegister} disabled={loading}>
              前往注册
            </button>
          </p>
          <p style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>演示账号：test@example.com / password123</p>
        </div>
      </div>
    </div>
  );
}
