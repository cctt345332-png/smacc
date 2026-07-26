"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePOSStore } from "@/store/posStore";
import axios from "axios";

export default function SetupPage() {
  const router = useRouter();
  const { setServerUrl } = usePOSStore();
  const [url, setUrl] = useState("https://");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleTest = async () => {
    const clean = url.trim().replace(/\/$/, "");
    if (!clean || clean === "https://") {
      setError("أدخل رابط السيرفر");
      return;
    }
    setTesting(true);
    setError("");
    setSuccess(false);
    try {
      await axios.get(`${clean}/health`, { timeout: 8000 });
      setSuccess(true);
    } catch {
      setError("تعذّر الاتصال بالسيرفر. تحقق من الرابط واتصال الإنترنت.");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const clean = url.trim().replace(/\/$/, "");
    if (!success) {
      await handleTest();
      return;
    }
    await setServerUrl(clean);
    if (typeof window !== "undefined" && (window as any).electronAPI?.navigate) {
      await (window as any).electronAPI.navigate("login");
    } else {
      window.location.href = "/ar/pos-app/login/";
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F8FAFC", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 460, background: "white", borderRadius: 20, padding: 40, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>إعداد الاتصال</h1>
          <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6 }}>
            أدخل رابط سيرفر النظام الخاص بشركتك
          </p>
        </div>

        {/* URL Input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
            رابط السيرفر
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setSuccess(false); setError(""); }}
            placeholder="https://api.yourcompany.com"
            dir="ltr"
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: `1.5px solid ${error ? "#EF4444" : success ? "#10B981" : "#E2E8F0"}`,
              fontSize: 14, outline: "none", fontFamily: "monospace",
              background: success ? "#F0FDF4" : "white",
              boxSizing: "border-box",
            }}
            onKeyDown={(e) => e.key === "Enter" && handleTest()}
          />
          {error && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#EF4444", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}
          {success && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#10B981", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              تم الاتصال بالسيرفر بنجاح
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleTest}
            disabled={testing}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 10, border: "1.5px solid #E2E8F0",
              background: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
              color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {testing ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                جاري الاختبار...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                اختبار الاتصال
              </>
            )}
          </button>
          <button
            onClick={handleSave}
            disabled={!success}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
              background: success ? "#2563EB" : "#CBD5E1",
              fontSize: 14, fontWeight: 700, cursor: success ? "pointer" : "not-allowed",
              color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            متابعة
          </button>
        </div>

        {/* Help */}
        <div style={{ marginTop: 24, padding: "12px 16px", background: "#F8FAFC", borderRadius: 10, fontSize: 12, color: "#64748B", lineHeight: 1.7 }}>
          <strong style={{ color: "#374151" }}>مثال:</strong><br />
          <span dir="ltr" style={{ fontFamily: "monospace" }}>https://api.yourcompany.com</span><br />
          تواصل مع مدير النظام للحصول على الرابط الصحيح.
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
