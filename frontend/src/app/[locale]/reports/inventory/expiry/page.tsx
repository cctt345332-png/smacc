"use client";
/**
 * تقرير انتهاء الصلاحية — للصيدلية فقط
 * يظهر فقط إذا كان النشاط = pharmacy
 */
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getBatchExpiryReport, getExpiryAlerts } from "@/lib/inventory";
import { getCompany } from "@/lib/settings";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const STATUS_CONFIG = {
  expired:  { ar: "منتهي الصلاحية", badge: "badge-danger",  bg: "#FEF2F2", color: "#DC2626" },
  critical: { ar: "ينتهي خلال 30 يوم", badge: "badge-danger", bg: "#FFF7ED", color: "#EA580C" },
  warning:  { ar: "ينتهي خلال 90 يوم", badge: "badge-warning", bg: "#FFFBEB", color: "#D97706" },
  ok:       { ar: "صالح", badge: "badge-success", bg: "#F0FDF4", color: "#059669" },
};

export default function ExpiryReportPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [rows, setRows] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPharmacy, setIsPharmacy] = useState(false);
  const [filter, setFilter] = useState<"all" | "expired" | "critical" | "warning">("all");
  const [daysAhead, setDaysAhead] = useState(90);

  useEffect(() => {
    getCompany().then(({ data }) => {
      if (data?.business_type === "pharmacy") {
        setIsPharmacy(true);
        loadData();
      } else {
        // ليس صيدلية — أعد التوجيه لصفحة التقارير
        window.location.href = `/${locale}/reports`;
      }
    }).catch(() => setLoading(false));
  }, []);

  const loadData = async (days = 90) => {
    setLoading(true);
    try {
      const [reportRes, alertsRes] = await Promise.all([
        getBatchExpiryReport({ days_ahead: days }),
        getExpiryAlerts(days),
      ]);
      setRows(reportRes.data);
      setAlerts(alertsRes.data);
    } catch {} finally { setLoading(false); }
  };

  const filtered = filter === "all" ? rows : rows.filter(r => r.status === filter);

  if (!isPharmacy && !loading) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-title">{ar ? "هذا التقرير للصيدليات فقط" : "This report is for pharmacies only"}</div>
        <Link href={`/${locale}/settings/company`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
          {ar ? "تغيير نوع النشاط" : "Change Business Type"}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "انتهاء الصلاحية" : "Expiry Report"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقرير انتهاء الصلاحية" : "Expiry Date Report"}</h1>
          <p className="page-subtitle">{ar ? "متابعة تواريخ انتهاء صلاحية الأدوية والتشغيلات" : "Track medication batch expiry dates"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <StructuredReportPrintButton locale={locale} title={ar ? "تقرير انتهاء الصلاحية" : "Expiry Date Report"} subtitle={ar ? "رقابة التشغيلات الدوائية وتواريخ انتهاء الصلاحية" : "Medication batch expiry control"} period={ar ? `خلال ${daysAhead} يومًا` : `Within ${daysAhead} days`} reportCode={`EXP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "منتهي الصلاحية" : "Expired", value: String(alerts?.expired_count || 0), tone: "red" }, { label: ar ? "ينتهي خلال 30 يوم" : "Within 30 days", value: String(rows.filter(r => r.status === "critical").length), tone: "red" }, { label: ar ? "ينتهي خلال 90 يوم" : "Within 90 days", value: String(alerts?.near_expiry_count || 0), tone: "amber" }, { label: ar ? "قيمة المخاطر" : "At-risk value", value: `${fmt(Number(alerts?.expired_value || 0) + Number(alerts?.near_expiry_value || 0))} SAR`, tone: "red" }]} tables={[{ title: ar ? "تفاصيل التشغيلات" : "Batch details", headers: [ar ? "الصنف" : "Item", "SKU", ar ? "رقم التشغيلة" : "Batch no.", ar ? "الكمية" : "Qty", ar ? "تاريخ الانتهاء" : "Expiry date", ar ? "الأيام المتبقية" : "Days left", ar ? "القيمة" : "Value", ar ? "الحالة" : "Status"], rows: filtered.map(row => { const status = STATUS_CONFIG[row.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.ok; const days = row.days_to_expiry == null ? "—" : row.days_to_expiry < 0 ? `${Math.abs(row.days_to_expiry)} ${ar ? "يوم مضى" : "days ago"}` : `${row.days_to_expiry} ${ar ? "يوم" : "days"}`; return [row.product_name || "—", row.product_sku || "—", row.batch_number || "—", fmt(row.quantity), row.expiry_date ? new Date(row.expiry_date).toLocaleDateString("en-GB") : "—", days, `${fmt(row.value)} SAR`, ar ? status.ar : row.status]; }), totals: [ar ? "الإجمالي" : "TOTAL", "", "", fmt(filtered.reduce((s, row) => s + Number(row.quantity || 0), 0)), "", "", `${fmt(filtered.reduce((s, row) => s + Number(row.value || 0), 0))} SAR`, ""] }]} />
        </div>
      </div>

      {/* فلتر الأيام */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{ar ? "عرض الأدوية التي تنتهي خلال:" : "Show items expiring within:"}</span>
          {[30, 60, 90, 180, 365].map(d => (
            <button key={d} type="button"
              onClick={() => { setDaysAhead(d); loadData(d); }}
              className={`btn btn-sm ${daysAhead === d ? "btn-primary" : "btn-secondary"}`}>
              {d} {ar ? "يوم" : "days"}
            </button>
          ))}
        </div>
      </div>

      {/* بطاقات الملخص */}
      {alerts && (
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: ar ? "منتهي الصلاحية" : "Expired", count: alerts.expired_count, value: alerts.expired_value, color: "#DC2626", bg: "#FEF2F2", icon: "alert" },
            { label: ar ? "ينتهي خلال 30 يوم" : "Expires in 30 days", count: rows.filter(r => r.status === "critical").length, value: rows.filter(r => r.status === "critical").reduce((s: number, r: any) => s + r.value, 0), color: "#EA580C", bg: "#FFF7ED", icon: "warning" },
            { label: ar ? "ينتهي خلال 90 يوم" : "Expires in 90 days", count: alerts.near_expiry_count, value: alerts.near_expiry_value, color: "#D97706", bg: "#FFFBEB", icon: "clock" },
            { label: ar ? "إجمالي قيمة المخاطر" : "Total At-Risk Value", count: alerts.expired_count + alerts.near_expiry_count, value: alerts.expired_value + alerts.near_expiry_value, color: "#75617F", bg: "#F5F3FF", icon: "money" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "16px 20px", background: s.bg, border: `1px solid ${s.color}30` }}>
              <div style={{ fontSize: 12, color: s.color, fontWeight: 600, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 12, color: s.color, marginTop: 4 }}>{fmt(s.value)} SAR</div>
            </div>
          ))}
        </div>
      )}

      {/* فلتر الحالة */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["all", "expired", "critical", "warning"] as const).map(f => (
          <button key={f} type="button"
            onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-secondary"}`}>
            {f === "all" ? (ar ? "الكل" : "All") : STATUS_CONFIG[f].ar}
            <span style={{ marginInlineStart: 6, background: "rgba(255,255,255,0.3)", borderRadius: 10, padding: "1px 6px", fontSize: 11 }}>
              {f === "all" ? rows.length : rows.filter(r => r.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {/* الجدول */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "تفاصيل التشغيلات" : "Batch Details"}</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{filtered.length} {ar ? "تشغيلة" : "batches"}</span>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-title">{ar ? "لا توجد تشغيلات" : "No batches found"}</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الصنف" : "Item"}</th>
                  <th>{ar ? "رقم التشغيلة" : "Batch No."}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                  <th>{ar ? "تاريخ الانتهاء" : "Expiry Date"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الأيام المتبقية" : "Days Left"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "القيمة" : "Value"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row: any) => {
                  const st = STATUS_CONFIG[row.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.ok;
                  return (
                    <tr key={row.batch_id} style={{ background: row.status === "expired" ? "#FEF2F2" : row.status === "critical" ? "#FFF7ED" : "transparent" }}>
                      <td>
                        <Link href={`/${locale}/inventory/items/${row.product_id}`} style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>
                          {row.product_name}
                        </Link>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.product_sku}</div>
                      </td>
                      <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{row.batch_number}</td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(row.quantity)}</td>
                      <td style={{ color: st.color, fontWeight: 600 }}>
                        {row.expiry_date ? new Date(row.expiry_date).toLocaleDateString("en-SA") : "—"}
                      </td>
                      <td style={{ textAlign: "end", fontWeight: 700, color: st.color }}>
                        {row.days_to_expiry !== null
                          ? row.days_to_expiry < 0
                            ? `${Math.abs(row.days_to_expiry)} ${ar ? "يوم مضى" : "days ago"}`
                            : `${row.days_to_expiry} ${ar ? "يوم" : "days"}`
                          : "—"}
                      </td>
                      <td style={{ textAlign: "end" }}>{fmt(row.value)} SAR</td>
                      <td><span className={`badge ${st.badge}`}>{st.ar}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
