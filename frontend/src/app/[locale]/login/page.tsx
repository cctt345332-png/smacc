"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { jwtDecode } from "jwt-decode";

export default function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("common");
  const ta = useTranslations("auth");
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      const decoded: any = jwtDecode(data.access_token);
      setAuth(data.access_token, {
        id: decoded.sub,
        tenantId: decoded.tenant_id,
        role: decoded.role,
      });
      router.push(`/${locale}/dashboard`);
    } catch {
      setError(locale === "ar" ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Left panel */}
      <div className="auth-left">
        <div style={{ maxWidth: 420, color: "white", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 24 }}>📊</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16, lineHeight: 1.3 }}>
            {locale === "ar" ? "نظام ERP متكامل للشركات السعودية" : "Complete ERP for Saudi Companies"}
          </h1>
          <p style={{ fontSize: 16, opacity: 0.7, lineHeight: 1.8 }}>
            {locale === "ar"
              ? "محاسبة • مبيعات • مشتريات • مخزون • موارد بشرية\nمتوافق مع متطلبات هيئة الزكاة والضريبة والجمارك"
              : "Accounting • Sales • Purchases • Inventory • HR\nZATCA compliant for Saudi Arabia"}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}>
            {["ZATCA", "VAT 15%", "e-Invoice", "GOSI"].map(tag => (
              <span key={tag} style={{
                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600
              }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-logo">
            <img src="/logo-ha.png" alt="Logo" style={{ height: 52, maxWidth: 200, objectFit: "contain" }} />
          </div>

          <h1 className="auth-title">{ta("loginTitle")}</h1>
          <p className="auth-subtitle">{ta("loginSubtitle")}</p>

          {error && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8,
              padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 16
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t("email")}</label>
              <input
                type="email"
                className="form-input"
                placeholder={locale === "ar" ? "example@company.com" : "example@company.com"}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>{t("password")}</label>
                <a href="#" style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none" }}>
                  {ta("forgotPassword")}
                </a>
              </div>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 8, padding: "11px 16px", fontSize: 14 }}
              disabled={loading}
            >
              {loading ? t("loading") : t("login")}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)", marginTop: 20 }}>
            {ta("noAccount")}{" "}
            <Link href={`/${locale}/register`} style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
              {t("register")}
            </Link>
          </p>

          {/* Language switch */}
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Link
              href={locale === "ar" ? "/en/login" : "/ar/login"}
              style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              🌐 {locale === "ar" ? "English" : "العربية"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
