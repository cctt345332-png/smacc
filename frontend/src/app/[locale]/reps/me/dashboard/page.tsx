"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMySummary, getMyStock, getMyInvoices } from "@/lib/reps";
import { useAuthStore } from "@/store/authStore";

const fmt = (n: any) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

/* ── بطاقة إحصائية ──────────────────────────────────────────────── */
function StatCard({
  label, value, color, sub,
}: {
  label: string; value: string; color: string; sub?: string;
}) {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 16,
      padding: "16px 18px", border: "1px solid var(--border)",
      flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* ── بطاقة إجراء سريع ───────────────────────────────────────────── */
function ActionCard({
  icon, label, desc, color, href, onClick,
}: {
  icon: React.ReactNode; label: string; desc: string;
  color: string; href?: string; onClick?: () => void;
}) {
  const inner = (
    <div style={{
      background: "var(--surface)", borderRadius: 16,
      padding: "18px 16px", border: "1.5px solid var(--border)",
      cursor: "pointer", transition: "all 0.15s",
      display: "flex", alignItems: "center", gap: 14,
    }}
      onTouchStart={e => { (e.currentTarget as HTMLElement).style.background = color + "0a"; (e.currentTarget as HTMLElement).style.borderColor = color; }}
      onTouchEnd={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = color + "0a"; (e.currentTarget as HTMLElement).style.borderColor = color; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
    >
      <div style={{
        width: 50, height: 50, borderRadius: 14, flexShrink: 0,
        background: color + "18", display: "flex",
        alignItems: "center", justifyContent: "center", color,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ marginInlineStart: "auto", color: "var(--text-muted)", flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  );
  if (href) return <Link href={href} style={{ textDecoration: "none" }}>{inner}</Link>;
  return <div onClick={onClick}>{inner}</div>;
}

/* ── أيقونات SVG ────────────────────────────────────────────────── */
const Icons = {
  invoice: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  newInvoice: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
  customers: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  stock: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  receipt: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  newCustomer: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  reports: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  target: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>,
  alert: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

/* ══════════════════════════════════════════════════════════════════ */
export default function RepDashboard({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const base = `/${locale}`;
  const router = useRouter();
  const { user } = useAuthStore();

  const [summary, setSummary]   = useState<any>(null);
  const [stock, setStock]       = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      getMySummary().catch(() => ({ data: null })),
      getMyStock().catch(() => ({ data: [] })),
      getMyInvoices().catch(() => ({ data: [] })),
    ]).then(([sumRes, stockRes, invRes]) => {
      setSummary(sumRes.data);
      setStock(Array.isArray(stockRes.data) ? stockRes.data : []);
      setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
    }).finally(() => setLoading(false));
  }, []);

  const firstName = ((user as any)?.fullName || "").split(" ")[0];
  const pct = summary?.target_monthly > 0
    ? Math.min(100, Math.round((Number(summary.total_sales || 0) / Number(summary.target_monthly)) * 100))
    : null;

  /* آخر 3 فواتير */
  const recentInvoices = invoices
    .sort((a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime())
    .slice(0, 3);

  /* عناصر مخزون منخفض */
  const lowStock = stock.filter((s: any) => Number(s.quantity || s.available_qty || 0) <= 3);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, flexDirection: "column", gap: 12 }}>
        <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── ترحيب ────────────────────────────────────────────────── */}
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {ar ? "مرحباً،" : "Welcome back,"}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>
          {firstName || (ar ? "المندوب" : "Rep")}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {new Date().toLocaleDateString(ar ? "ar-SA" : "en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      {/* ── تنبيه مخزون منخفض ────────────────────────────────────── */}
      {lowStock.length > 0 && (
        <div style={{
          background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 14,
          padding: "12px 14px", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ color: "#D97706", flexShrink: 0 }}>{Icons.alert}</span>
          <div style={{ fontSize: 13, color: "#92400E", flex: 1 }}>
            <strong>{lowStock.length}</strong> {ar ? " صنف مخزونه منخفض" : " items low in stock"}
          </div>
          <Link href={`${base}/reps/stock`} style={{ fontSize: 12, color: "#D97706", fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>
            {ar ? "عرض" : "View"}
          </Link>
        </div>
      )}

      {/* ── الإحصائيات الكبيرة (2×2) ─────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard
          label={ar ? "إجمالي مبيعاتي" : "My Total Sales"}
          value={`${fmt(summary?.total_sales)} SAR`}
          color="#2563EB"
        />
        <StatCard
          label={ar ? "المقبوض" : "Collected"}
          value={`${fmt(summary?.total_collected)} SAR`}
          color="#059669"
        />
        <StatCard
          label={ar ? "المستحق" : "Outstanding"}
          value={`${fmt(summary?.outstanding)} SAR`}
          color={Number(summary?.outstanding) > 0 ? "#DC2626" : "#059669"}
        />
        <StatCard
          label={ar ? "رصيد المخزون" : "Stock Items"}
          value={Number(summary?.stock_qty || 0).toLocaleString("en-US")}
          color="#D97706"
          sub={ar ? "قطعة" : "units"}
        />
      </div>

      {/* ── شريط الهدف الشهري ────────────────────────────────────── */}
      {pct !== null && (
        <div style={{ background: "var(--surface)", borderRadius: 16, padding: "16px 18px", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#7C3AED" }}>
              {Icons.target}
              <span style={{ fontSize: 13, fontWeight: 700 }}>{ar ? "الهدف الشهري" : "Monthly Target"}</span>
            </div>
            <span style={{
              fontSize: 13, fontWeight: 800,
              color: pct >= 100 ? "#059669" : pct >= 70 ? "#D97706" : "#2563EB",
            }}>{pct}%</span>
          </div>
          <div style={{ height: 10, background: "var(--border)", borderRadius: 5, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: 5,
              background: pct >= 100 ? "#059669" : pct >= 70 ? "#D97706" : "#2563EB",
              transition: "width 0.6s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
            <span>{fmt(summary?.total_sales)} SAR</span>
            <span>{fmt(summary?.target_monthly)} SAR</span>
          </div>
        </div>
      )}

      {/* ── الإجراءات السريعة ─────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {ar ? "الإجراءات السريعة" : "Quick Actions"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ActionCard icon={Icons.newInvoice} label={ar ? "فاتورة جديدة" : "New Invoice"}
            desc={ar ? "اصدر فاتورة مبيعات جديدة" : "Create a new sales invoice"}
            color="#2563EB" href={`${base}/reps/invoices/new`} />
          <ActionCard icon={Icons.customers} label={ar ? "عملائي" : "My Customers"}
            desc={ar ? "عرض وإدارة عملائك" : "View and manage your customers"}
            color="#059669" href={`${base}/reps/customers`} />
          <ActionCard icon={Icons.stock} label={ar ? "مخزوني" : "My Stock"}
            desc={ar ? `${stock.length} صنف متاح` : `${stock.length} items available`}
            color="#D97706" href={`${base}/reps/stock`} />
          <ActionCard icon={Icons.receipt} label={ar ? "سندات القبض" : "Receipts"}
            desc={ar ? "سندات القبض من العملاء" : "Customer payment receipts"}
            color="#7C3AED" href={`${base}/reps/payments`} />
          <ActionCard icon={Icons.newCustomer} label={ar ? "عميل جديد" : "New Customer"}
            desc={ar ? "أضف عميلاً جديداً" : "Add a new customer"}
            color="#0891B2" href={`${base}/reps/customers?action=new`} />
          <ActionCard icon={Icons.reports} label={ar ? "تقاريري" : "My Reports"}
            desc={ar ? "عرض تقارير أدائك" : "View your performance reports"}
            color="#DC2626" href={`${base}/reps/reports`} />
        </div>
      </div>

      {/* ── آخر 3 فواتير ─────────────────────────────────────────── */}
      {recentInvoices.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {ar ? "آخر الفواتير" : "Recent Invoices"}
            </div>
            <Link href={`${base}/reps/invoices`} style={{ fontSize: 12, color: "#2563EB", fontWeight: 700, textDecoration: "none" }}>
              {ar ? "عرض الكل" : "View all"}
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentInvoices.map((inv: any) => {
              const statusColors: Record<string, string> = {
                paid: "#059669", confirmed: "#2563EB", partial: "#D97706",
                overdue: "#DC2626", draft: "#94A3B8", cancelled: "#6B7280",
              };
              const statusLabels: Record<string, { ar: string; en: string }> = {
                paid: { ar: "مدفوعة", en: "Paid" }, confirmed: { ar: "مؤكدة", en: "Confirmed" },
                partial: { ar: "جزئي", en: "Partial" }, overdue: { ar: "متأخرة", en: "Overdue" },
                draft: { ar: "مسودة", en: "Draft" }, cancelled: { ar: "ملغاة", en: "Cancelled" },
                submitted: { ar: "بانتظار المراجعة", en: "Pending" },
              };
              const sc = statusColors[inv.status] || "#94A3B8";
              const sl = statusLabels[inv.status] || { ar: inv.status, en: inv.status };
              return (
                <Link key={inv.id} href={`${base}/sales/invoices/${inv.id}`}
                  style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "var(--surface)", borderRadius: 14, padding: "14px 16px",
                    border: "1px solid var(--border)", display: "flex",
                    alignItems: "center", gap: 12,
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, background: sc + "18",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: sc, flexShrink: 0, fontSize: 20,
                    }}>{Icons.invoice}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, fontFamily: "monospace" }}>
                        {inv.invoice_number}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {inv.buyer_name_ar} · {fmtDate(inv.issue_date)}
                      </div>
                    </div>
                    <div style={{ textAlign: "end", flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{fmt(inv.total)} SAR</div>
                      <div style={{ fontSize: 11, color: sc, fontWeight: 600, marginTop: 2 }}>
                        {ar ? sl.ar : sl.en}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* مسافة نهاية الصفحة */}
      <div style={{ height: 8 }} />
    </div>
  );
}
