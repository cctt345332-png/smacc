import Link from "next/link";

export default async function Page(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const {
    locale
  } = params;

  const ar = locale === "ar";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#587795" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>تقارير الرواتب</h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>Payroll Reports — Coming Soon</p>
        <Link href={`/${locale}/dashboard`} className="btn btn-primary btn-sm">{ar ? "العودة للرئيسية" : "Back to Dashboard"}</Link>
      </div>
    </div>
  );
}
