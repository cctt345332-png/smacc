"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkInMyAttendance, getMyAttendanceStatus, getMySummary, getMyStock, getMyInvoices } from "@/lib/reps";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";

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
      background: "#FFFEFA", borderRadius: 2,
      padding: "12px 14px", border: "1px solid #C8D0C7",
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
      background: "#FFFEFA", borderRadius: 2,
      padding: "13px 14px", border: "1px solid #C8D0C7",
      cursor: "pointer", transition: "all 0.15s",
      display: "flex", alignItems: "center", gap: 14,
    }}
      onTouchStart={e => { (e.currentTarget as HTMLElement).style.background = color + "0a"; (e.currentTarget as HTMLElement).style.borderColor = color; }}
      onTouchEnd={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = color + "0a"; (e.currentTarget as HTMLElement).style.borderColor = color; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 2, flexShrink: 0,
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
export default function RepDashboard(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const base = `/${locale}`;
  const router = useRouter();
  const { user } = useAuthStore();

  const [summary, setSummary]   = useState<any>(null);
  const [stock, setStock]       = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [checkingIn, setCheckingIn] = useState(false);

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

  useEffect(() => {
    let active = true;
    const loadAttendance = async () => {
      try {
        const response = await getMyAttendanceStatus();
        if (active) setAttendance(response.data);
      } catch {
        // لا نمنع لوحة المندوب عند تعذر الشبكة؛ يعود الفحص تلقائياً في الدقيقة التالية.
      }
    };
    void loadAttendance();
    const timer = window.setInterval(loadAttendance, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const handleCheckIn = async () => {
    if (checkingIn) return;
    setCheckingIn(true);
    try {
      // يستخدم آخر موقع أرسله تتبع المندوب تلقائياً؛ لا تظهر أي رسالة لطلب إذن الموقع هنا.
      await checkInMyAttendance();
      const response = await getMyAttendanceStatus();
      setAttendance(response.data);
    } catch (error: any) {
      alert(error?.response?.data?.detail || error?.message || (ar ? "تعذر تسجيل الحضور، حاول مرة أخرى." : "Could not record attendance. Please try again."));
    } finally {
      setCheckingIn(false);
    }
  };

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
        <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "#3E0865", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
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
          <Link href={`${base}/reps/me/stock`} style={{ fontSize: 12, color: "#D97706", fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>
            {ar ? "عرض" : "View"}
          </Link>
        </div>
      )}

      {/* ── الإحصائيات الكبيرة (2×2) ─────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <StatCard
          label={ar ? "إجمالي مبيعاتي" : "My Total Sales"}
          value={`${fmt(summary?.total_sales)} SAR`}
          color="#3E0865"
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#356B63" }}>
              {Icons.target}
              <span style={{ fontSize: 13, fontWeight: 700 }}>{ar ? "الهدف الشهري" : "Monthly Target"}</span>
            </div>
            <span style={{
              fontSize: 13, fontWeight: 800,
              color: pct >= 100 ? "#059669" : pct >= 70 ? "#D97706" : "#3E0865",
            }}>{pct}%</span>
          </div>
          <div style={{ height: 10, background: "var(--border)", borderRadius: 5, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: 5,
              background: pct >= 100 ? "#059669" : pct >= 70 ? "#D97706" : "#3E0865",
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
            color="#3E0865" href={`${base}/reps/me/invoices/new`} />
          <ActionCard icon={Icons.customers} label={ar ? "عملائي" : "My Customers"}
            desc={ar ? "عرض وإدارة عملائك" : "View and manage your customers"}
            color="#28705D" href={`${base}/reps/me/customers`} />
          <ActionCard icon={Icons.stock} label={ar ? "مخزوني" : "My Stock"}
            desc={ar ? `${stock.length} صنف متاح` : `${stock.length} items available`}
            color="#697A3B" href={`${base}/reps/me/stock`} />
          <ActionCard icon={Icons.receipt} label={ar ? "سندات القبض" : "Receipts"}
            desc={ar ? "سندات القبض من العملاء" : "Customer payment receipts"}
            color="#356B63" href={`${base}/reps/me/payments`} />
          <ActionCard icon={Icons.newCustomer} label={ar ? "عميل جديد" : "New Customer"}
            desc={ar ? "أضف عميلاً جديداً" : "Add a new customer"}
            color="#4D766B" href={`${base}/reps/me/customers?action=new`} />
          <ActionCard icon={Icons.reports} label={ar ? "تقاريري" : "My Reports"}
            desc={ar ? "عرض تقارير أدائك" : "View your performance reports"}
            color="#566A60" href={`${base}/reps/me/reports`} />
        </div>
      </div>

      {/* ── آخر 3 فواتير ─────────────────────────────────────────── */}
      {recentInvoices.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {ar ? "آخر الفواتير" : "Recent Invoices"}
            </div>
            <Link href={`${base}/reps/me/invoices`} style={{ fontSize: 12, color: "#3E0865", fontWeight: 700, textDecoration: "none" }}>
              {ar ? "عرض الكل" : "View all"}
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recentInvoices.map((inv: any) => {
              const statusColors: Record<string, string> = {
                paid: "#059669", confirmed: "#3E0865", partial: "#D97706",
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
                <div key={inv.id} onClick={() => setSelectedInvoice(inv)}
                  style={{ cursor: "pointer" }}>
                  <div style={{
                    background: "var(--surface)", borderRadius: 14, padding: "14px 16px",
                    border: "1px solid var(--border)", display: "flex",
                    alignItems: "center", gap: 12,
                    transition: "border-color 0.15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = sc)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                    onTouchStart={e => (e.currentTarget.style.borderColor = sc)}
                    onTouchEnd={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, background: sc + "18",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: sc, flexShrink: 0,
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.5" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* مسافة نهاية الصفحة */}
      <div style={{ height: 8 }} />
      {/* modal تفاصيل الفاتورة */}
      {attendance?.requires_check_in && (
        <MandatoryAttendanceModal
          locale={locale}
          serverTime={attendance.server_time}
          saving={checkingIn}
          onCheckIn={handleCheckIn}
        />
      )}

      {selectedInvoice && (
        <DashInvoiceModal
          inv={selectedInvoice}
          locale={locale}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}

/* ── مربع الحضور الإلزامي للمندوب ───────────────────────────────── */
function MandatoryAttendanceModal({
  locale,
  serverTime,
  saving,
  onCheckIn,
}: {
  locale: string;
  serverTime?: string;
  saving: boolean;
  onCheckIn: () => void;
}) {
  const ar = locale === "ar";
  const shownTime = serverTime
    ? new Date(serverTime).toLocaleTimeString(ar ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ar ? "تسجيل حضور اليوم" : "Daily attendance check-in"}
      style={{
        position: "fixed", inset: 0, zIndex: 5000,
        background: "rgba(25, 8, 38, 0.62)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 18,
      }}
    >
      <div style={{
        width: "100%", maxWidth: 390, background: "var(--surface)", border: "1px solid #C9B3D7",
        borderRadius: 8, overflow: "hidden", boxShadow: "0 18px 48px rgba(25, 8, 38, 0.34)",
      }}>
        <div style={{ background: "#3E0865", color: "white", padding: "16px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 19, fontWeight: 800 }}>{ar ? "تسجيل حضور اليوم" : "Daily Check-in"}</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>{ar ? "الحضور مطلوب قبل استخدام لوحة المندوب" : "Check-in is required before using the rep dashboard"}</div>
        </div>
        <div style={{ padding: "22px 20px 20px", textAlign: "center" }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", margin: "0 auto 14px", background: "#F4EFF7", color: "#3E0865", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800 }}>✓</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{ar ? "سجّل وقت حضورك الفعلي الآن" : "Record your actual arrival time now"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 7 }}>{ar ? "سيظهر الوقت المسجل في إدارة الحضور والانصراف." : "The recorded time will appear in attendance management."}</div>
          {shownTime && <div style={{ fontFamily: "monospace", fontSize: 13, color: "#3E0865", marginTop: 12, fontWeight: 700 }}>{shownTime}</div>}
          <button
            type="button"
            disabled={saving}
            onClick={onCheckIn}
            style={{ width: "100%", marginTop: 20, padding: "11px 14px", background: "#3E0865", color: "white", border: "none", borderRadius: 3, fontWeight: 800, fontSize: 14, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? (ar ? "جاري تسجيل الحضور..." : "Recording check-in...") : (ar ? "تسجيل حضور اليوم" : "Check in now")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal بسيط لتفاصيل الفاتورة من الداشبورد ──────────────────── */
function DashInvoiceModal({ inv, locale, onClose }: { inv: any; locale: string; onClose: () => void }) {
  const ar = locale === "ar";
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const STATUS: Record<string, { ar: string; color: string; bg: string }> = {
    draft:     { ar: "مسودة",            color: "#6B7280", bg: "#F3F4F6" },
    submitted: { ar: "بانتظار المراجعة", color: "#D97706", bg: "#FEF3C7" },
    approved:  { ar: "موافق عليها",      color: "#3E0865", bg: "#F4EFF7" },
    rejected:  { ar: "مرفوضة",           color: "#DC2626", bg: "#FEF2F2" },
    confirmed: { ar: "مؤكدة",            color: "#059669", bg: "#F0FDF4" },
    paid:      { ar: "مدفوعة",           color: "#059669", bg: "#F0FDF4" },
    partial:   { ar: "جزئي",             color: "#D97706", bg: "#FEF3C7" },
    cancelled: { ar: "ملغاة",            color: "#6B7280", bg: "#F3F4F6" },
  };

  const fmt2 = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
  const fmtD2 = (d: any) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

  useEffect(() => {
    api.get(`/sales/invoices/${inv.id}`)
      .then(r => setDetail(r.data))
      .catch(() => setDetail(inv))
      .finally(() => setLoading(false));
  }, [inv.id]);

  const handlePDF = () => {
    window.open(`/${locale}/reps/me/invoices/${inv.id}/print`, "_blank");
  };

  const st = STATUS[inv.status] || STATUS.draft;
  const d = detail || inv;
  const remaining = Number(d.total || 0) - Number(d.paid_amount || 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 800,
      display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0",
        width: "100%", maxWidth: 580, maxHeight: "92vh", overflowY: "auto", padding: "0 0 32px" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding: "14px 20px 0", textAlign: "center" }}>
          <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 14px" }} />
        </div>

        <div style={{ padding: "0 20px 14px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 17, color: "#3E0865" }}>{inv.invoice_number}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: st.bg, color: st.color }}>{ar ? st.ar : inv.status}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.buyer_name_ar}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["approved","confirmed","paid","partial"].includes(inv.status) && (
              <button onClick={handlePDF} disabled={downloading}
                style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #9BBBAD",
                  background: "#F4EFF7", color: "#3E0865", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                {downloading ? "..." : "PDF"}
              </button>
            )}
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", cursor: "pointer", fontSize: 16, color: "var(--text-muted)" }}>×</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {ar ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : (
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: ar ? "التاريخ" : "Date", value: fmtD2(d.issue_date) },
                { label: ar ? "طريقة الدفع" : "Payment", value: d.payment_type === "cash" ? (ar ? "نقدي" : "Cash") : (ar ? "آجل" : "Credit") },
                { label: ar ? "تاريخ الاستحقاق" : "Due", value: fmtD2(d.due_date) },
                { label: ar ? "العميل" : "Customer", value: d.buyer_name_ar },
              ].map(f => (
                <div key={f.label} style={{ background: "var(--bg)", borderRadius: 10, padding: "9px 12px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.value}</div>
                </div>
              ))}
            </div>

            {d.status === "rejected" && d.rejection_note && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
                <strong>{ar ? "سبب الرفض: " : "Rejected: "}</strong>{d.rejection_note}
              </div>
            )}

            {d.lines?.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {ar ? "الأصناف" : "Items"}
                </div>
                {d.lines.map((line: any, i: number) => (
                  <div key={i} style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 14px",
                    display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{line.description_ar}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {line.quantity} × {fmt2(line.unit_price)} SAR
                        {line.discount_pct > 0 && ` — خصم ${line.discount_pct}%`}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: "#3E0865", flexShrink: 0, marginInlineStart: 12 }}>
                      {fmt2(line.total || line.quantity * line.unit_price)} SAR
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: "var(--bg)", borderRadius: 12, padding: "12px 16px" }}>
              {[
                { label: ar ? "قبل الضريبة" : "Subtotal", value: fmt2(d.subtotal || 0), color: "var(--text-primary)" },
                { label: ar ? "ضريبة 15%" : "VAT 15%", value: fmt2(d.vat_amount || 0), color: "#D97706" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{r.label}</span>
                  <span style={{ fontWeight: 600, color: r.color }}>{r.value} SAR</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", fontWeight: 800, fontSize: 16 }}>
                <span>{ar ? "الإجمالي" : "Total"}</span>
                <span style={{ color: "#3E0865" }}>{fmt2(d.total)} SAR</span>
              </div>
              {Number(d.paid_amount || 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 4 }}>
                  <span style={{ color: "#059669" }}>{ar ? "المدفوع" : "Paid"}</span>
                  <span style={{ fontWeight: 700, color: "#059669" }}>{fmt2(d.paid_amount)} SAR</span>
                </div>
              )}
              {remaining > 0.01 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 4 }}>
                  <span style={{ color: "#DC2626" }}>{ar ? "المتبقي" : "Remaining"}</span>
                  <span style={{ fontWeight: 700, color: "#DC2626" }}>{fmt2(remaining)} SAR</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
