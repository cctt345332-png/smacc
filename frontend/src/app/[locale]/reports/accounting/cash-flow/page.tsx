"use client";
import { useState, use } from "react";
import Link from "next/link";
import { getTrialBalance } from "@/lib/accounting";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

export default function CashFlowPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

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
      // Simplified cash flow from trial balance
      const revenues = rows.filter((r: any) => r.account_type === "revenue")
        .reduce((s: number, r: any) => s + Number(r.period_credit) - Number(r.period_debit), 0);
      const expenses = rows.filter((r: any) => r.account_type === "expense")
        .reduce((s: number, r: any) => s + Number(r.period_debit) - Number(r.period_credit), 0);
      const netProfit = revenues - expenses;
      setData({ revenues, expenses, netProfit, operating: netProfit, investing: 0, financing: 0 });
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setLoading(false); }
  };

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2 });

  const Row = ({ label, value, bold, indent }: any) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: `${bold ? 12 : 8}px ${indent ? 32 : 20}px`, borderBottom: "1px solid #F1F5F9", fontWeight: bold ? 700 : 400, fontSize: bold ? 14 : 13 }}>
      <span style={{ color: indent ? "var(--text-secondary)" : "var(--text-primary)" }}>{label}</span>
      <span style={{ color: value >= 0 ? "#059669" : "#DC2626", fontWeight: 600 }}>
        {value < 0 ? "(" : ""}{fmt(Math.abs(value))}{value < 0 ? ")" : ""} {ar ? "ر.س" : "SAR"}
      </span>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "التدفقات النقدية" : "Cash Flow"}</span>
          </div>
          <h1 className="page-title">{ar ? "قائمة التدفقات النقدية" : "Cash Flow Statement"}</h1>
        </div>
        {data && <StructuredReportPrintButton locale={locale} title={ar ? "قائمة التدفقات النقدية" : "Cash Flow Statement"} subtitle={ar ? "التدفقات من الأنشطة التشغيلية والاستثمارية والتمويلية" : "Operating, investing and financing cash flows"} period={`${fromDate} — ${toDate}`} reportCode={`CF-${toDate.replaceAll("-", "")}`} metrics={[{ label: ar ? "صافي التدفق التشغيلي" : "Operating cash flow", value: `${fmt(data.operating)} SAR`, tone: data.operating >= 0 ? "green" : "red" }, { label: ar ? "التدفق الاستثماري" : "Investing cash flow", value: `${fmt(data.investing)} SAR`, tone: "blue" }, { label: ar ? "التدفق التمويلي" : "Financing cash flow", value: `${fmt(data.financing)} SAR`, tone: "amber" }, { label: ar ? "صافي التغير في النقدية" : "Net change in cash", value: `${fmt(data.operating + data.investing + data.financing)} SAR`, tone: data.operating + data.investing + data.financing >= 0 ? "green" : "red" }]} tables={[{ title: ar ? "التدفقات من الأنشطة التشغيلية" : "Operating activities", headers: [ar ? "البند" : "Item", ar ? "القيمة" : "Amount"], rows: [[ar ? "صافي الربح" : "Net profit", `${fmt(data.netProfit)} SAR`]], totals: [ar ? "إجمالي التدفقات التشغيلية" : "Total operating cash flow", `${fmt(data.operating)} SAR`] }, { title: ar ? "التدفقات من الأنشطة الاستثمارية" : "Investing activities", headers: [ar ? "البند" : "Item", ar ? "القيمة" : "Amount"], rows: [[ar ? "الحركات الاستثمارية" : "Investing movements", `${fmt(data.investing)} SAR`]], totals: [ar ? "إجمالي التدفقات الاستثمارية" : "Total investing cash flow", `${fmt(data.investing)} SAR`] }, { title: ar ? "التدفقات من الأنشطة التمويلية" : "Financing activities", headers: [ar ? "البند" : "Item", ar ? "القيمة" : "Amount"], rows: [[ar ? "الحركات التمويلية" : "Financing movements", `${fmt(data.financing)} SAR`]], totals: [ar ? "صافي التغير في النقدية" : "Net change in cash", `${fmt(data.operating + data.investing + data.financing)} SAR`] }]} />}
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
        <div className="card" id="report-content-cash-flow">
          <div className="card-header">
            <span className="card-title">{ar ? `قائمة التدفقات النقدية — ${fromDate} إلى ${toDate}` : `Cash Flow — ${fromDate} to ${toDate}`}</span>
          </div>
          <div style={{ padding: 0 }}>
            {/* Operating */}
            <div style={{ padding: "12px 20px", background: "#EFF6FF", fontWeight: 700, color: "#485668", borderBottom: "1px solid var(--border)" }}>
              {ar ? "أولاً: التدفقات من الأنشطة التشغيلية" : "I. Operating Activities"}
            </div>
            <Row label={ar ? "صافي الربح" : "Net Profit"} value={data.netProfit} indent />
            <Row label={ar ? "إجمالي التدفقات التشغيلية" : "Total Operating Cash Flow"} value={data.operating} bold />

            {/* Investing */}
            <div style={{ padding: "12px 20px", background: "#F5F3FF", fontWeight: 700, color: "#65707E", borderBottom: "1px solid var(--border)", marginTop: 8 }}>
              {ar ? "ثانياً: التدفقات من الأنشطة الاستثمارية" : "II. Investing Activities"}
            </div>
            <Row label={ar ? "لا توجد حركات استثمارية" : "No investing activities"} value={0} indent />
            <Row label={ar ? "إجمالي التدفقات الاستثمارية" : "Total Investing Cash Flow"} value={0} bold />

            {/* Financing */}
            <div style={{ padding: "12px 20px", background: "#FFF7ED", fontWeight: 700, color: "#D97706", borderBottom: "1px solid var(--border)", marginTop: 8 }}>
              {ar ? "ثالثاً: التدفقات من الأنشطة التمويلية" : "III. Financing Activities"}
            </div>
            <Row label={ar ? "لا توجد حركات تمويلية" : "No financing activities"} value={0} indent />
            <Row label={ar ? "إجمالي التدفقات التمويلية" : "Total Financing Cash Flow"} value={0} bold />

            {/* Net */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 20px", fontWeight: 800, fontSize: 16, background: data.operating >= 0 ? "#F0FDF4" : "#FEF2F2", borderTop: "2px solid var(--border)" }}>
              <span>{ar ? "صافي التغير في النقدية" : "Net Change in Cash"}</span>
              <span style={{ color: data.operating >= 0 ? "#059669" : "#DC2626" }}>
                {fmt(data.operating)} {ar ? "ر.س" : "SAR"}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
