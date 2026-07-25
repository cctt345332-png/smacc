"use client";
import { useState } from "react";
import Link from "next/link";
import { getTrialBalance } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";

export default function IncomeStatementPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const now = new Date();
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: rows } = await getTrialBalance(fromDate + "T00:00:00", toDate + "T23:59:59");
      const revenues = rows.filter((r: any) => r.account_type === "revenue");
      const expenses = rows.filter((r: any) => r.account_type === "expense");
      const totalRevenue = revenues.reduce((s: number, r: any) => s + Number(r.period_credit) - Number(r.period_debit), 0);
      const totalExpense = expenses.reduce((s: number, r: any) => s + Number(r.period_debit) - Number(r.period_credit), 0);
      setData({ revenues, expenses, totalRevenue, totalExpense, netProfit: totalRevenue - totalExpense });
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setLoading(false); }
  };

  const fmt = (n: number) => Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2 });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "قائمة الدخل" : "Income Statement"}</span>
          </div>
          <h1 className="page-title">{ar ? "قائمة الدخل" : "Income Statement"}</h1>
          <p className="page-subtitle">{ar ? "الإيرادات والمصروفات وصافي الربح" : "Revenue, expenses and net profit"}</p>
        </div>
        {data && <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨️ {ar ? "طباعة" : "Print"}</button>}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{ar ? "من" : "From"}</label>
            <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{ar ? "إلى" : "To"}</label>
            <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? (ar ? "جاري..." : "Loading...") : (ar ? "عرض" : "Show")}
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid-3" style={{ marginBottom: 20 }}>
            {[
              { label: ar ? "إجمالي الإيرادات" : "Total Revenue", value: data.totalRevenue, color: "#059669", icon: "trending" as const },
              { label: ar ? "إجمالي المصروفات" : "Total Expenses", value: data.totalExpense, color: "#DC2626", icon: "trendingDown" as const },
              { label: ar ? "صافي الربح" : "Net Profit", value: data.netProfit, color: data.netProfit >= 0 ? "#059669" : "#DC2626", icon: "profit" as const },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-icon" style={{ background: s.color + "18", color: s.color }}><Icon name={s.icon} size={20} /></div>
                <div className="stat-content">
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={{ color: s.color }}>{fmt(s.value)} {ar ? "ر.س" : "SAR"}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-body" style={{ padding: "0" }}>
              {/* Revenue */}
              <div style={{ padding: "14px 20px", background: "#F0FDF4", borderBottom: "1px solid var(--border)", fontWeight: 700, color: "#059669" }}>
                {ar ? "الإيرادات" : "Revenue"}
              </div>
              {data.revenues.map((r: any, i: number) => {
                const val = Number(r.period_credit) - Number(r.period_debit);
                if (Math.abs(val) < 0.01) return null;
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 20px", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{r.account_code} — {ar ? r.account_name_ar : r.account_name_en}</span>
                    <span style={{ fontWeight: 600, color: "#059669" }}>{fmt(val)} {ar ? "ر.س" : "SAR"}</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", fontWeight: 700, background: "#F0FDF4", borderBottom: "2px solid var(--border)" }}>
                <span>{ar ? "إجمالي الإيرادات" : "Total Revenue"}</span>
                <span style={{ color: "#059669", fontSize: 15 }}>{fmt(data.totalRevenue)} {ar ? "ر.س" : "SAR"}</span>
              </div>

              {/* Expenses */}
              <div style={{ padding: "14px 20px", background: "#FEF2F2", borderBottom: "1px solid var(--border)", fontWeight: 700, color: "#DC2626" }}>
                {ar ? "المصروفات" : "Expenses"}
              </div>
              {data.expenses.map((r: any, i: number) => {
                const val = Number(r.period_debit) - Number(r.period_credit);
                if (Math.abs(val) < 0.01) return null;
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 20px", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{r.account_code} — {ar ? r.account_name_ar : r.account_name_en}</span>
                    <span style={{ fontWeight: 600, color: "#DC2626" }}>{fmt(val)} {ar ? "ر.س" : "SAR"}</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", fontWeight: 700, background: "#FEF2F2", borderBottom: "2px solid var(--border)" }}>
                <span>{ar ? "إجمالي المصروفات" : "Total Expenses"}</span>
                <span style={{ color: "#DC2626", fontSize: 15 }}>{fmt(data.totalExpense)} {ar ? "ر.س" : "SAR"}</span>
              </div>

              {/* Net */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 20px", fontWeight: 800, fontSize: 16, background: data.netProfit >= 0 ? "#F0FDF4" : "#FEF2F2" }}>
                <span>{ar ? "صافي الربح / الخسارة" : "Net Profit / Loss"}</span>
                <span style={{ color: data.netProfit >= 0 ? "#059669" : "#DC2626" }}>
                  {data.netProfit < 0 ? "(" : ""}{fmt(data.netProfit)}{data.netProfit < 0 ? ")" : ""} {ar ? "ر.س" : "SAR"}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
