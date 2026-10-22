"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getProfitLossReport, getAccounts } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";
import SearchableAccountSelect from "@/components/accounting/SearchableAccountSelect";

export default function IncomeStatementPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const now = new Date();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState("");
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAccounts().then(({ data }) => setAccounts(data)).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: report } = await getProfitLossReport(fromDate + "T00:00:00", toDate + "T23:59:59", accountId || undefined);
      setData({
        revenues: report.revenues || [], expenses: report.expenses || [],
        totalRevenue: Number(report.total_revenue || 0), totalCogs: Number(report.total_cogs || 0),
        grossProfit: Number(report.gross_profit || 0), operatingExpenses: Number(report.operating_expenses || 0),
        salaryExpense: Number(report.salary_expense || 0), totalExpense: Number(report.total_expense || 0),
        purchasesTotal: Number(report.purchases_total || 0), purchaseCount: Number(report.purchase_count || 0),
        netProfit: Number(report.net_profit || 0),
      });
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
          <span>{ar ? "تقرير الأرباح والخسائر" : "Profit & Loss Report"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقرير الأرباح والخسائر" : "Profit & Loss Report"}</h1>
          <p className="page-subtitle">{ar ? "المبيعات والتكلفة والمشتريات والمصروفات والرواتب وصافي الربح" : "Sales, cost, purchases, expenses, salaries and net profit"}</p>
        </div>
        {data && <StructuredReportPrintButton locale={locale} title={ar ? "قائمة الدخل" : "Income Statement"} subtitle={ar ? "الإيرادات والمصروفات وصافي الربح" : "Revenue, expenses and net profit"} period={`${fromDate} — ${toDate}`} reportCode={`IS-${toDate.replaceAll("-", "")}`} metrics={[{ label: ar ? "إجمالي الإيرادات" : "Total revenue", value: `${fmt(data.totalRevenue)} SAR`, tone: "green" }, { label: ar ? "إجمالي المصروفات" : "Total expenses", value: `${fmt(data.totalExpense)} SAR`, tone: "red" }, { label: ar ? "صافي الربح / الخسارة" : "Net profit / loss", value: `${fmt(data.netProfit)} SAR`, tone: data.netProfit >= 0 ? "green" : "red" }]} tables={[{ title: ar ? "الإيرادات" : "Revenue", headers: [ar ? "رمز الحساب" : "Code", ar ? "اسم الحساب" : "Account name", ar ? "قيمة الفترة" : "Period amount"], rows: data.revenues.filter((r: any) => Math.abs(Number(r.period_credit) - Number(r.period_debit)) >= 0.01).map((r: any) => [r.account_code, ar ? r.account_name_ar : r.account_name_en, `${fmt(Number(r.period_credit) - Number(r.period_debit))} SAR`]), totals: [ar ? "إجمالي الإيرادات" : "Total revenue", "", `${fmt(data.totalRevenue)} SAR`] }, { title: ar ? "المصروفات" : "Expenses", headers: [ar ? "رمز الحساب" : "Code", ar ? "اسم الحساب" : "Account name", ar ? "قيمة الفترة" : "Period amount"], rows: data.expenses.filter((r: any) => Math.abs(Number(r.period_debit) - Number(r.period_credit)) >= 0.01).map((r: any) => [r.account_code, ar ? r.account_name_ar : r.account_name_en, `${fmt(Number(r.period_debit) - Number(r.period_credit))} SAR`]), totals: [ar ? "صافي الربح / الخسارة" : "Net profit / loss", "", `${fmt(data.netProfit)} SAR`] }]} />}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 260 }}>
            <label className="form-label">{ar ? "الحساب (اختياري)" : "Account (optional)"}</label>
            <SearchableAccountSelect accounts={accounts} value={accountId} onChange={setAccountId} locale={locale} placeholder={ar ? "ابحث عن الحساب..." : "Search account..."} />
          </div>
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
          <div id="report-content-income-statement">
          <div className="grid-3" style={{ marginBottom: 20 }}>
            {[
              { label: ar ? "إجمالي الإيرادات" : "Total Revenue", value: data.totalRevenue, color: "#6F4A84", icon: "trending" as const },
              { label: ar ? "تكلفة البضاعة المباعة" : "Cost of Goods Sold", value: data.totalCogs, color: "#D97706", icon: "trendingDown" as const },
              { label: ar ? "الربح الإجمالي" : "Gross Profit", value: data.grossProfit, color: data.grossProfit >= 0 ? "#2563EB" : "#DC2626", icon: "profit" as const },
              { label: ar ? "المشتريات" : "Purchases", value: data.purchasesTotal, color: "#2563EB", icon: "receipt" as const },
              { label: ar ? "المصروفات التشغيلية" : "Operating Expenses", value: data.operatingExpenses, color: "#DC2626", icon: "trendingDown" as const },
              { label: ar ? "الرواتب" : "Salaries", value: data.salaryExpense, color: "#B45309", icon: "trendingDown" as const },
              { label: ar ? "إجمالي المصروفات" : "Total Expenses", value: data.totalExpense, color: "#DC2626", icon: "trendingDown" as const },
              { label: ar ? "صافي الربح" : "Net Profit", value: data.netProfit, color: data.netProfit >= 0 ? "#6F4A84" : "#DC2626", icon: "profit" as const },
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
              <div style={{ padding: "14px 20px", background: "#F7F2F8", borderBottom: "1px solid var(--border)", fontWeight: 700, color: "#6F4A84" }}>
                {ar ? "الإيرادات" : "Revenue"}
              </div>
              {data.revenues.map((r: any, i: number) => {
                const val = Number(r.period_credit) - Number(r.period_debit);
                if (Math.abs(val) < 0.01) return null;
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 20px", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{r.account_code} — {ar ? r.account_name_ar : r.account_name_en}</span>
                    <span style={{ fontWeight: 600, color: "#6F4A84" }}>{fmt(val)} {ar ? "ر.س" : "SAR"}</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 20px", fontWeight: 700, background: "#F7F2F8", borderBottom: "2px solid var(--border)" }}>
                <span>{ar ? "إجمالي الإيرادات" : "Total Revenue"}</span>
                <span style={{ color: "#6F4A84", fontSize: 15 }}>{fmt(data.totalRevenue)} {ar ? "ر.س" : "SAR"}</span>
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
              <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 20px", fontWeight: 800, fontSize: 16, background: data.netProfit >= 0 ? "#F7F2F8" : "#FEF2F2" }}>
                <span>{ar ? "صافي الربح / الخسارة" : "Net Profit / Loss"}</span>
                <span style={{ color: data.netProfit >= 0 ? "#6F4A84" : "#DC2626" }}>
                  {data.netProfit < 0 ? "(" : ""}{fmt(data.netProfit)}{data.netProfit < 0 ? ")" : ""} {ar ? "ر.س" : "SAR"}
                </span>
              </div>
            </div>
          </div>
          </div>
        </>
      )}
    </>
  );
}
