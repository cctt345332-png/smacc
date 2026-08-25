"use client";
import { useEffect, useState, use } from "react";
import { getSupervisorSummary, getSupervisorReps } from "@/lib/reps";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function SupervisorDashboard(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const base = `/${locale}`;
  const { user } = useAuthStore();
  const [summary, setSummary] = useState<any>(null);
  const [reps, setReps]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSupervisorSummary().catch(() => ({ data: null })),
      getSupervisorReps().catch(() => ({ data: [] })),
    ]).then(([s, r]) => {
      setSummary(s.data);
      setReps(Array.isArray(r.data) ? r.data : []);
    }).finally(() => setLoading(false));
  }, []);

  const firstName = ((user as any)?.fullName || "").split(" ")[0];

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ترحيب */}
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{ar ? "مرحباً،" : "Welcome,"}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>
          {firstName || (ar ? "المشرف" : "Supervisor")}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {new Date().toLocaleDateString(ar ? "ar-SA" : "en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* إحصائيات */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: ar ? "عدد المناديب" : "My Reps",        value: String(summary?.rep_count || 0),    color: "#65707E" },
          { label: ar ? "إجمالي المبيعات" : "Total Sales", value: fmt(summary?.total_sales) + " SAR", color: "#485668" },
          { label: ar ? "المقبوض" : "Collected",           value: fmt(summary?.total_collected) + " SAR", color: "#059669" },
          { label: ar ? "المستحق" : "Outstanding",         value: fmt(summary?.outstanding) + " SAR", color: Number(summary?.outstanding) > 0 ? "#DC2626" : "#059669" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--surface)", borderRadius: 16,
            padding: "16px 18px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* إجراءات سريعة */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {ar ? "الإجراءات السريعة" : "Quick Actions"}
        </div>
        {[
          { label: ar ? "فواتير مناديبي" : "Invoices",   desc: ar ? "عرض فواتير مناديبي" : "View rep invoices", href: `${base}/supervisor/invoices`, color: "#485668" },
          { label: ar ? "التقارير" : "Reports",           desc: ar ? "تقارير الأداء" : "Performance reports",  href: `${base}/supervisor/reports`,  color: "#65707E" },
          { label: ar ? "مناديبي" : "My Reps",            desc: ar ? `${reps.length} مندوب` : `${reps.length} reps`, href: `${base}/supervisor/reps`, color: "#059669" },
        ].map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration: "none" }}>
            <div style={{ background: "var(--surface)", borderRadius: 16, padding: "16px 18px",
              border: "1.5px solid var(--border)", display: "flex", alignItems: "center", gap: 14,
              cursor: "pointer" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: a.color + "18",
                display: "flex", alignItems: "center", justifyContent: "center", color: a.color, fontSize: 22 }}>
                ◆
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{a.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{a.desc}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" style={{ marginInlineStart: "auto", color: "var(--text-muted)" }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </Link>
        ))}
      </div>

      {/* قائمة المناديب */}
      {reps.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase" }}>
            {ar ? "مناديبي" : "My Reps"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reps.map((rep: any) => (
              <div key={rep.id} style={{ background: "var(--surface)", borderRadius: 14,
                padding: "12px 16px", border: "1px solid var(--border)",
                display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#65707E18",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#65707E", fontWeight: 800, fontSize: 12 }}>
                  {rep.full_name?.charAt(0) || "R"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{rep.full_name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {rep.rep_code} {rep.zone ? `· ${rep.zone}` : ""}
                  </div>
                </div>
                <span style={{ marginInlineStart: "auto", fontSize: 11, fontWeight: 600,
                  padding: "2px 8px", borderRadius: 20,
                  background: rep.is_active ? "#D1FAE5" : "#FEE2E2",
                  color: rep.is_active ? "#059669" : "#DC2626" }}>
                  {rep.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
