"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSuperAdminStore } from "@/store/superAdminStore";
import adminApi from "@/lib/adminApi";

const IcShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IcEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const IcEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

export default function SuperAdminLogin() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";
  const router = useRouter();
  const setAuth = useSuperAdminStore((s) => s.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.post("/auth/super-admin/login", { email, password });
      setAuth(res.data.access_token, res.data.user);
      router.push(`/${locale}/super-admin/dashboard`);
    } catch (err: any) {
      setError(err.response?.data?.detail || (ar ? "بيانات الدخول غير صحيحة" : "Invalid credentials"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div dir={ar ? "rtl" : "ltr"} className="auth-page" style={{ fontFamily: "'Alexandria', sans-serif" }}>

      {/* Left promo panel */}
      <div className="auth-left">
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: "#60A5FA" }}>
            <IcShield />
          </div>
          <h2 style={{ color: "white", fontSize: 26, fontWeight: 800, marginBottom: 12 }}>
            {ar ? "لوحة المدير العام" : "Super Admin Panel"}
          </h2>
          <p style={{ color: "#94A3B8", fontSize: 14, lineHeight: 1.7 }}>
            {ar
              ? "تحكم كامل في الشركات، الباقات، الأنشطة، وصفحة الهبوط من مكان واحد."
              : "Full control over companies, plans, activities, and landing page from one place."}
          </p>
          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              ar ? "إدارة جميع الشركات المشتركة" : "Manage all subscribed companies",
              ar ? "تعديل الباقات والأسعار" : "Edit plans and pricing",
              ar ? "التحكم في صفحة الهبوط" : "Control the landing page",
              ar ? "إدارة الأنشطة التجارية" : "Manage business activities",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, color: "#CBD5E1", fontSize: 13 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(37,99,235,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="auth-right">
        <div className="auth-card">
          {/* Logo */}
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <IcShield />
            </div>
            <span className="auth-logo-name">
              {ar ? "المدير العام" : "Super Admin"}
            </span>
          </div>

          <h1 className="auth-title">{ar ? "تسجيل الدخول" : "Sign In"}</h1>
          <p className="auth-subtitle">
            {ar ? "الوصول مقيد بالمدير العام فقط" : "Restricted to super admin only"}
          </p>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Email */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{ar ? "البريد الإلكتروني" : "Email"}</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="form-input"
                placeholder="admin@example.com"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{ar ? "كلمة المرور" : "Password"}</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)} required
                  className="form-input"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  style={{ paddingInlineEnd: 40 }}
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", [ar ? "left" : "right"]: 12, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
                  {showPass ? <IcEyeOff /> : <IcEye />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--danger)" }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 4 }}>
              {loading ? (ar ? "جاري الدخول..." : "Signing in...") : (ar ? "دخول" : "Sign In")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
