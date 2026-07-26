"use client";
import { useState, useEffect } from "react";
import { usePOSStore } from "@/store/posStore";
import api from "@/lib/api";

export default function LoginPage() {
  const { serverUrl, setAuth, setServerUrl, loadFromElectron } = usePOSStore();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  // تحميل الإعدادات من Electron عند فتح الصفحة
  useEffect(() => {
    loadFromElectron();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("أدخل البريد الإلكتروني وكلمة المرور"); return; }

    setLoading(true);
    setError("");

    try {
      // تسجيل الدخول
      const loginRes = await api.post("/auth/login", { email, password });
      const { access_token } = loginRes.data;

      // جلب بيانات المستخدم
      const meRes = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const user = meRes.data;

      // التحقق من الصلاحية — يجب أن يكون cashier أو أعلى
      const allowedRoles = ["cashier", "manager", "admin", "super_admin", "accountant", "sales"];
      if (!allowedRoles.includes(user.role)) {
        setError("ليس لديك صلاحية الوصول لنقطة البيع. تواصل مع المدير.");
        setLoading(false);
        return;
      }

      await setAuth(access_token, {
        id: user.id,
        email: user.email,
        full_name: user.full_name || user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_name: user.tenant_name,
      });

      // تأكد من الحفظ قبل التنقل
      if (typeof window !== "undefined" && (window as any).electronAPI) {
        await (window as any).electronAPI.saveConfig({
          token: access_token,
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name || user.email,
            role: user.role,
            tenant_id: user.tenant_id,
            tenant_name: user.tenant_name,
          }
        });
        // انتظر قليلاً ثم انتقل
        setTimeout(() => {
          (window as any).electronAPI.navigate("cashier");
        }, 200);
      } else {
        window.location.href = "/ar/pos-app/cashier/";
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail;
      if (typeof msg === "string") {
        setError(msg);
      } else {
        setError("بيانات الدخول غير صحيحة أو تعذّر الاتصال بالسيرفر");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F8FAFC", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "white", borderRadius: 20, padding: 40, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>Masar POS</h1>
          <p style={{ fontSize: 13, color: "#64748B" }}>تسجيل الدخول لنقطة البيع</p>

          {/* Server indicator */}
          <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 20, padding: "4px 12px", fontSize: 11, color: "#166534" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
            <span dir="ltr" style={{ fontFamily: "monospace", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {serverUrl}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#DC2626", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cashier@company.com"
              dir="ltr"
              autoComplete="email"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
              background: loading ? "#93C5FD" : "#2563EB",
              fontSize: 15, fontWeight: 700, color: "white",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                جاري الدخول...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                تسجيل الدخول
              </>
            )}
          </button>
        </form>

        {/* Change server */}
        <button
          onClick={() => {
        setServerUrl("");
        if (typeof window !== "undefined" && (window as any).electronAPI?.navigate) {
          (window as any).electronAPI.saveConfig({ serverUrl: "" }).then(() => {
            (window as any).electronAPI.navigate("setup");
          });
        } else {
          window.location.href = "/ar/pos-app/setup/";
        }
      }}
          style={{ width: "100%", marginTop: 12, padding: "9px 0", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "white", fontSize: 13, color: "#64748B", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
          تغيير السيرفر
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
