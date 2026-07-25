"use client";
import { useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function VATReportPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const now = new Date();
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get("/accounting/reports/vat", {
        params: { from_date: fromDate + "T00:00:00", to_date: toDate + "T23:59:59" }
      });
      setData(res);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setLoading(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "تقرير ضريبة القيمة المضافة" : "VAT Report"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقرير ضريبة القيمة المضافة" : "VAT Report"}</h1>
          <p className="page-subtitle">{ar ? "الإقرار الضريبي — هيئة الزكاة والضريبة والجمارك" : "VAT Return — ZATCA"}</p>
        </div>
        {data && <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨️ {ar ? "طباعة" : "Print"}</button>}
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{ar ? "من تاريخ" : "From Date"}</label>
            <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{ar ? "إلى تاريخ" : "To Date"}</label>
            <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? (ar ? "جاري..." : "Loading...") : (ar ? "عرض التقرير" : "Show Report")}
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid-3" style={{ marginBottom: 20 }}>
            {[
              { label: ar ? "ضريبة المبيعات (مخرجات)" : "Output VAT", value: data.summary.output_vat, color: "#059669", icon: "📤" },
              { label: ar ? "ضريبة المشتريات (مدخلات)" : "Input VAT", value: data.summary.input_vat, color: "#2563EB", icon: "📥" },
              { label: ar ? "صافي الضريبة المستحقة" : "Net VAT Payable", value: data.summary.net_vat_payable, color: data.summary.net_vat_payable > 0 ? "#D97706" : "#059669", icon: "🏛️" },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-icon" style={{ background: s.color + "18", color: s.color, fontSize: 22 }}>{s.icon}</div>
                <div className="stat-content">
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={{ color: s.color }}>{fmt(s.value)} {ar ? "ر.س" : "SAR"}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Detail table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                {ar ? `تفاصيل الإقرار — ${fromDate} إلى ${toDate}` : `VAT Return — ${fromDate} to ${toDate}`}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {data.summary.invoice_count} {ar ? "فاتورة" : "invoices"}
              </span>
            </div>
            <div style={{ padding: 0 }}>
              {/* المبيعات */}
              <div style={{ padding: "12px 20px", background: "#F0FDF4", fontWeight: 700, color: "#059669", borderBottom: "1px solid var(--border)" }}>
                {ar ? "أولاً: المبيعات (المخرجات)" : "I. Sales (Output VAT)"}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    <th style={{ padding: "10px 20px", textAlign: "start", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>{ar ? "البند" : "Item"}</th>
                    <th style={{ padding: "10px 20px", textAlign: "end", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>{ar ? "المبلغ الخاضع" : "Taxable Amount"}</th>
                    <th style={{ padding: "10px 20px", textAlign: "end", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>{ar ? "مبلغ الضريبة" : "VAT Amount"}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px 20px", fontSize: 13 }}>{ar ? "مبيعات خاضعة للضريبة (15%)" : "Standard rated sales (15%)"}</td>
                    <td style={{ padding: "12px 20px", textAlign: "end" }}>{fmt(data.output_vat.standard_rated_sales)}</td>
                    <td style={{ padding: "12px 20px", textAlign: "end", color: "#059669", fontWeight: 600 }}>{fmt(data.output_vat.standard_vat_amount)}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px 20px", fontSize: 13 }}>{ar ? "مبيعات بنسبة صفر" : "Zero rated sales"}</td>
                    <td style={{ padding: "12px 20px", textAlign: "end" }}>{fmt(data.output_vat.zero_rated_sales)}</td>
                    <td style={{ padding: "12px 20px", textAlign: "end", color: "var(--text-muted)" }}>—</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px 20px", fontSize: 13 }}>{ar ? "مبيعات معفاة" : "Exempt sales"}</td>
                    <td style={{ padding: "12px 20px", textAlign: "end" }}>{fmt(data.output_vat.exempt_sales)}</td>
                    <td style={{ padding: "12px 20px", textAlign: "end", color: "var(--text-muted)" }}>—</td>
                  </tr>
                  <tr style={{ background: "#F0FDF4", fontWeight: 700 }}>
                    <td style={{ padding: "12px 20px" }}>{ar ? "إجمالي المبيعات" : "Total Sales"}</td>
                    <td style={{ padding: "12px 20px", textAlign: "end" }}>{fmt(data.output_vat.total_sales)}</td>
                    <td style={{ padding: "12px 20px", textAlign: "end", color: "#059669" }}>{fmt(data.output_vat.standard_vat_amount)}</td>
                  </tr>
                </tbody>
              </table>

              {/* المشتريات */}
              <div style={{ padding: "12px 20px", background: "#EFF6FF", fontWeight: 700, color: "#2563EB", borderTop: "2px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                {ar ? "ثانياً: المشتريات (المدخلات)" : "II. Purchases (Input VAT)"}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "12px 20px", fontSize: 13 }}>{ar ? "مشتريات خاضعة للضريبة (15%)" : "Standard rated purchases (15%)"}</td>
                    <td style={{ padding: "12px 20px", textAlign: "end" }}>{fmt(data.input_vat.standard_rated_purchases)}</td>
                    <td style={{ padding: "12px 20px", textAlign: "end", color: "#2563EB", fontWeight: 600 }}>{fmt(data.input_vat.standard_vat_amount)}</td>
                  </tr>
                  <tr style={{ background: "#EFF6FF", fontWeight: 700 }}>
                    <td style={{ padding: "12px 20px" }}>{ar ? "إجمالي المشتريات" : "Total Purchases"}</td>
                    <td style={{ padding: "12px 20px", textAlign: "end" }}>{fmt(data.input_vat.standard_rated_purchases)}</td>
                    <td style={{ padding: "12px 20px", textAlign: "end", color: "#2563EB" }}>{fmt(data.input_vat.standard_vat_amount)}</td>
                  </tr>
                </tbody>
              </table>

              {/* الصافي */}
              <div style={{ padding: "16px 20px", borderTop: "2px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: data.summary.net_vat_payable > 0 ? "#FEF9C3" : "#F0FDF4" }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{ar ? "صافي الضريبة المستحقة للهيئة" : "Net VAT Due to ZATCA"}</span>
                <span style={{ fontWeight: 800, fontSize: 20, color: data.summary.net_vat_payable > 0 ? "#D97706" : "#059669" }}>
                  {fmt(data.summary.net_vat_payable)} {ar ? "ر.س" : "SAR"}
                </span>
              </div>
            </div>
          </div>

          {/* ZATCA link */}
          <div style={{ marginTop: 16, background: "linear-gradient(135deg,#1E3A5F,#2563EB)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ color: "white" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{ar ? "تقديم الإقرار لهيئة الزكاة والضريبة والجمارك" : "Submit Return to ZATCA"}</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{ar ? "يتطلب تفعيل ربط زاتكا من الإعدادات" : "Requires ZATCA integration enabled in Settings"}</div>
            </div>
            <Link href={`/${locale}/settings/tax`} className="btn" style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)", flexShrink: 0 }}>
              {ar ? "إعدادات زاتكا" : "ZATCA Settings"}
            </Link>
          </div>
        </>
      )}
    </>
  );
}
