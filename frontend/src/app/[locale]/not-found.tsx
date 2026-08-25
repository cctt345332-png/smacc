import Link from "next/link";

export default function NotFound({ params }: { params?: { locale?: string } }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", flexDirection: "column", gap: 16, padding: 24, textAlign: "center"
    }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#587795" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
          هذه الصفحة قيد التطوير
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
          This module is coming soon
        </p>
        <Link href="/ar/dashboard" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "9px 20px", background: "var(--primary)", color: "white",
          borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600
        }}>
          العودة للرئيسية / Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
