"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PAYMENT_LABELS: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  cash:        { ar: "نقدي",           en: "Cash",        color: "#059669", bg: "#ECFDF5" },
  mada:        { ar: "مدى",            en: "Mada",        color: "#2563EB", bg: "#EFF6FF" },
  credit_card: { ar: "بطاقة ائتمان",  en: "Credit Card", color: "#7C3AED", bg: "#F5F3FF" },
  stc_pay:     { ar: "STC Pay",        en: "STC Pay",     color: "#D97706", bg: "#FFFBEB" },
  split:       { ar: "مقسّم",          en: "Split",       color: "#64748B", bg: "#F1F5F9" },
};

export default function POSPaymentsReportPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const sar = ar ? "ر.س" : "SAR";
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = async () => {
    setLoading(true);
    try { const r = await api.get("/pos/sessions", { params: { limit: 200 } }); setSessions(r.data || []); }
    catch { setSessions([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = sessions.filter(s => { const d = s.opened_at?.slice(0, 10); return d >= dateFrom && d <= dateTo; });
  const totalSales = filtered.reduce((s, x) => s + Number(x.total_sales || 0), 0);
  const totalCash  = filtered.reduce((s, x) => s + Number(x.total_cash  || 0), 0);
  const totalCard  = filtered.reduce((s, x) => s + Number(x.total_card  || 0), 0);

  const byMethod = [
    { key: "cash",        amount: totalCash,              label: PAYMENT_LABELS.cash },
    { key: "card",        amount: totalCard,              label: { ar: "بطاقة (مدى/ائتمان/STC)", en: "Card (Mada/Credit/STC)", color: "#2563EB", bg: "#EFF6FF" } },
    { key: "split",       amount: totalSales - totalCash - totalCard > 0 ? totalSales - totalCash - totalCard : 0, label: PAYMENT_LABELS.split },
  ].filter(m => m.amount > 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/reports/pos`}>POS</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "طرق الدفع" : "Payment Methods"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقرير طرق الدفع" : "Payment Methods Report"}</h1>
        </div>
        <button className="btn btn-secondary" onClick={() => window.print()}><Icon name="print" size={15} />{ar ? "طباعة" : "Print"}</button>
      </div>

      <div className="card" style={{ padding: "14px 20px", marginBottom: 20, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{ar ? "من" : "From"}</label>
          <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{ar ? "إلى" : "To"}</label>
          <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={load}><Icon name="search" size={15} />{ar ? "تحديث" : "Refresh"}</button>
      </div>

      {/* بطاقات طرق الدفع */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {byMethod.map(m => (
          <div key={m.key} className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: m.label.bg, display: "flex", alignItems: "center", justifyContent: "center", color: m.label.color }}>
                <Icon name={m.key === "cash" ? "cash" : "card"} size={22} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{ar ? m.label.ar : m.label.en}</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: m.label.color, marginBottom: 4 }}>
              {fmt(m.amount)} {sar}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {totalSales > 0 ? ((m.amount / totalSales) * 100).toFixed(1) : 0}% {ar ? "من الإجمالي" : "of total"}
            </div>
            {/* شريط النسبة */}
            <div style={{ marginTop: 10, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${totalSales > 0 ? (m.amount / totalSales) * 100 : 0}%`, background: m.label.color, borderRadius: 3, transition: "width 0.5s" }} />
            </div>
          </div>
        ))}
      </div>

      {/* ملخص */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title"><Icon name="chart" size={16} />{ar ? "ملخص الفترة" : "Period Summary"}</h3>
        </div>
        <div style={{ padding: 20 }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: ar ? "إجمالي المبيعات" : "Total Sales",  value: `${fmt(totalSales)} ${sar}`, color: "var(--success)", bold: true },
                { label: ar ? "إجمالي النقد"    : "Total Cash",   value: `${fmt(totalCash)} ${sar}`,  color: "var(--text-primary)" },
                { label: ar ? "إجمالي البطاقة"  : "Total Card",   value: `${fmt(totalCard)} ${sar}`,  color: "var(--text-primary)" },
                { label: ar ? "عدد الجلسات"     : "Sessions",     value: String(filtered.length),     color: "var(--text-muted)" },
              ].map(({ label, value, color, bold }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
                  <span style={{ fontWeight: bold ? 800 : 600, fontSize: bold ? 16 : 14, color }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
