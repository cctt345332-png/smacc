"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي", mada: "مدى", credit_card: "بطاقة ائتمان", stc_pay: "STC Pay", split: "مقسّم",
};

export default function POSSalesReportPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const sar = ar ? "ر.س" : "SAR";

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/pos/sessions", { params: { limit: 200 } });
      setSessions(r.data || []);
    } catch { setSessions([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // فلترة حسب التاريخ
  const filtered = sessions.filter(s => {
    const d = s.opened_at?.slice(0, 10);
    return d >= dateFrom && d <= dateTo;
  });

  // إجماليات
  const totalSales = filtered.reduce((s, x) => s + Number(x.total_sales || 0), 0);
  const totalCash  = filtered.reduce((s, x) => s + Number(x.total_cash  || 0), 0);
  const totalCard  = filtered.reduce((s, x) => s + Number(x.total_card  || 0), 0);
  const totalVat   = filtered.reduce((s, x) => s + Number(x.total_vat   || 0), 0);
  const totalTxns  = filtered.reduce((s, x) => s + Number(x.transaction_count || 0), 0);

  // مبيعات يومية
  const byDay: Record<string, number> = {};
  filtered.forEach(s => {
    const day = s.opened_at?.slice(0, 10) || "";
    byDay[day] = (byDay[day] || 0) + Number(s.total_sales || 0);
  });
  const days = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "مبيعات نقطة البيع" : "POS Sales"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقرير مبيعات نقطة البيع" : "POS Sales Report"}</h1>
        </div>
        <StructuredReportPrintButton locale={locale} title={ar ? "تقرير مبيعات نقطة البيع" : "POS Sales Report"} subtitle={ar ? "المبيعات اليومية والجلسات وطرق التحصيل" : "Daily sales, sessions and collections"} period={`${dateFrom} — ${dateTo}`} reportCode={`POS-SALES-${dateTo.replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "إجمالي المبيعات" : "Total sales", value: `${fmt(totalSales)} ${sar}`, tone: "green" }, { label: ar ? "إجمالي النقد" : "Cash", value: `${fmt(totalCash)} ${sar}`, tone: "blue" }, { label: ar ? "إجمالي البطاقة" : "Card", value: `${fmt(totalCard)} ${sar}`, tone: "blue" }, { label: ar ? "ضريبة القيمة المضافة" : "VAT", value: `${fmt(totalVat)} ${sar}`, tone: "amber" }, { label: ar ? "المعاملات" : "Transactions", value: String(totalTxns), tone: "green" }]} tables={[{ title: ar ? "المبيعات اليومية" : "Daily sales", headers: [ar ? "التاريخ" : "Date", ar ? "المبيعات" : "Sales", ar ? "النسبة" : "Share"], rows: days.map(([day, amount]) => [new Date(day).toLocaleDateString(ar ? "ar-SA" : "en-US"), `${fmt(amount)} ${sar}`, `${totalSales > 0 ? ((amount / totalSales) * 100).toFixed(1) : "0.0"}%`]), totals: [ar ? "الإجمالي" : "TOTAL", `${fmt(totalSales)} ${sar}`, "100.0%"] }, { title: ar ? "ملخص الجلسات" : "Session summary", headers: [ar ? "التاريخ" : "Date", ar ? "المبيعات" : "Sales", ar ? "نقدي" : "Cash", ar ? "بطاقة" : "Card", ar ? "الضريبة" : "VAT", ar ? "المعاملات" : "Txns", ar ? "الحالة" : "Status"], rows: filtered.map(s => [new Date(s.opened_at).toLocaleString(ar ? "ar-SA" : "en-US"), `${fmt(Number(s.total_sales || 0))} ${sar}`, `${fmt(Number(s.total_cash || 0))} ${sar}`, `${fmt(Number(s.total_card || 0))} ${sar}`, `${fmt(Number(s.total_vat || 0))} ${sar}`, String(s.transaction_count || 0), s.status === "open" ? (ar ? "مفتوحة" : "Open") : (ar ? "مغلقة" : "Closed")]) }]} />
      </div>

      {/* فلتر التاريخ */}
      <div className="card" style={{ padding: "14px 20px", marginBottom: 20, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{ar ? "من" : "From"}</label>
          <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{ar ? "إلى" : "To"}</label>
          <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={load}>
          <Icon name="search" size={15} />{ar ? "تحديث" : "Refresh"}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: ar ? "إجمالي المبيعات"       : "Total Sales",    value: `${fmt(totalSales)} ${sar}`, icon: "revenue" as const, color: "#059669", bg: "#ECFDF5" },
          { label: ar ? "إجمالي النقد"           : "Cash",           value: `${fmt(totalCash)} ${sar}`,  icon: "cash"    as const, color: "#2563EB", bg: "#EFF6FF" },
          { label: ar ? "إجمالي البطاقة"         : "Card",           value: `${fmt(totalCard)} ${sar}`,  icon: "card"    as const, color: "#7C3AED", bg: "#F5F3FF" },
          { label: ar ? "ضريبة القيمة المضافة"   : "VAT",            value: `${fmt(totalVat)} ${sar}`,   icon: "tax"     as const, color: "#D97706", bg: "#FFFBEB" },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}><Icon name={s.icon} size={20} /></div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* مبيعات يومية */}
      {days.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 className="card-title"><Icon name="chart" size={16} />{ar ? "المبيعات اليومية" : "Daily Sales"}</h3>
            <span className="badge badge-gray">{totalTxns} {ar ? "معاملة" : "txns"}</span>
          </div>
          <div className="table-wrapper" style={{ border: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "المبيعات" : "Sales"}</th>
                  <th>{ar ? "النسبة" : "%"}</th>
                </tr>
              </thead>
              <tbody>
                {days.map(([day, amount]) => (
                  <tr key={day}>
                    <td style={{ fontWeight: 600 }}>{new Date(day).toLocaleDateString(ar ? "ar-SA" : "en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</td>
                    <td style={{ fontWeight: 700, color: "var(--success)" }}>{fmt(amount)} {sar}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${totalSales > 0 ? (amount / totalSales) * 100 : 0}%`, background: "#059669", borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 36 }}>
                          {totalSales > 0 ? ((amount / totalSales) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* الجلسات */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title"><Icon name="session" size={16} />{ar ? "الجلسات" : "Sessions"}</h3>
          <span className="badge badge-gray">{filtered.length}</span>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد بيانات" : "No data"}</div></div>
        ) : (
          <div className="table-wrapper" style={{ border: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "المبيعات" : "Sales"}</th>
                  <th>{ar ? "نقدي" : "Cash"}</th>
                  <th>{ar ? "بطاقة" : "Card"}</th>
                  <th>{ar ? "ضريبة" : "VAT"}</th>
                  <th>{ar ? "معاملات" : "Txns"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(s.opened_at).toLocaleDateString(ar ? "ar-SA" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--success)" }}>{fmt(Number(s.total_sales))} {sar}</td>
                    <td>{fmt(Number(s.total_cash))} {sar}</td>
                    <td>{fmt(Number(s.total_card))} {sar}</td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmt(Number(s.total_vat))} {sar}</td>
                    <td><span className="badge badge-gray">{s.transaction_count}</span></td>
                    <td>
                      <span className={`badge ${s.status === "open" ? "badge-success" : "badge-gray"}`}>
                        {s.status === "open" ? (ar ? "مفتوحة" : "Open") : (ar ? "مغلقة" : "Closed")}
                      </span>
                    </td>
                    <td>
                      <Link href={`/${locale}/pos/sessions/${s.id}`} className="btn btn-ghost btn-sm">
                        <Icon name="view" size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
