// 最小粘合改动：Router 挂载 001-competitor-tracking Demo
import { useState, useEffect } from "react";
import LoginPage from "../prototypes/001-competitor-tracking/LoginPage.jsx";
import RegisterPage from "../prototypes/001-competitor-tracking/RegisterPage.jsx";
import MonitorPage from "../prototypes/001-competitor-tracking/MonitorPage.jsx";
import CompetitorsPage from "../prototypes/001-competitor-tracking/CompetitorsPage.jsx";
import EmailSettingsPage from "../prototypes/001-competitor-tracking/EmailSettingsPage.jsx";
import FeedbackPage from "../prototypes/001-competitor-tracking/FeedbackPage.jsx";
import InboxPage from "../prototypes/001-competitor-tracking/InboxPage.jsx";

const navStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", background: "#fff", borderBottom: "1px solid #e0e0e0", position: "sticky", top: 0, zIndex: 100 };
const navInner = { display: "flex", gap: "4px" };
const navBtn = { background: "none", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "14px", color: "#555" };
const navBtnActive = { ...navBtn, background: "#e3f2fd", color: "#1565c0", fontWeight: 600 };
const logoutBtn = { background: "none", border: "1px solid #ddd", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", color: "#666" };

function App() {
  const [page, setPage] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setPage("monitor");
      } catch {
        setPage("login");
      }
    } else {
      setPage("login");
    }
  }, []);

  if (!page) return <div style={{ textAlign: "center", padding: "40px" }}>加载中...</div>;

  if (page === "login") {
    return (
      <LoginPage
        onLoginSuccess={(email) => {
          setUser({ email });
          setPage("monitor");
        }}
        onSwitchToRegister={() => setPage("register")}
      />
    );
  }

  if (page === "register") {
    return (
      <RegisterPage
        onRegisterSuccess={() => setPage("login")}
        onSwitchToLogin={() => setPage("login")}
      />
    );
  }

  const navItems = [
    { key: "monitor", label: "监控首页" },
    { key: "competitors", label: "竞对配置" },
    { key: "inbox", label: "收信箱" },
    { key: "email-settings", label: "邮件设置" },
    { key: "feedback", label: "意见反馈" },
  ];

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("tokens");
    setUser(null);
    setPage("login");
  };

  const renderPage = () => {
    switch (page) {
      case "monitor": return <MonitorPage />;
      case "competitors": return <CompetitorsPage onBack={() => setPage("monitor")} />;
      case "email-settings": return <EmailSettingsPage onBack={() => setPage("monitor")} />;
      case "feedback": return <FeedbackPage onBack={() => setPage("monitor")} />;
      case "inbox": return <InboxPage onBack={() => setPage("monitor")} />;
      default: return null;
    }
  };

  return (
    <div>
      <nav style={navStyle}>
        <div style={navInner}>
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              style={page === item.key ? navBtnActive : navBtn}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button onClick={handleLogout} style={logoutBtn}>退出</button>
      </nav>
      {renderPage()}
    </div>
  );
}

export default App;
