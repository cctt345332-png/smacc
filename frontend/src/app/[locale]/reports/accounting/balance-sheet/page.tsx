"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getTrialBalance, getAccounts } from "@/lib/accounting";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

export default function BalanceSheetPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const now = new Date();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState("");
  const [asOf, setAsOf] = useState(now.toISOString().split("T")[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAccounts().then(({ data }) => setAccounts(data)).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: rows } = await getTrialBalance(`${now.getFullYear()}-01-01T00:00:00`, asOf + "T23:59:59", accountId || undefined);
      const group = (type: string) => rows.filter((r: any) => r.account_type === type);
      const sum = (rows: any[]) => rows.reduce((s: number, r: any) => s + Number(r.closing_debit) - Number(r.closing_credit), 0);
      const assets = group("asset"); const liabilities = group("liability"); const equity = group("equity");
      setData({ assets, liabilities, equity, totalAssets: sum(assets), totalLiabilities: sum(liabilities), totalEquity: sum(equity) });
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setLoading(false); }
  };

  const fmt = (n: number) => Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2 });

  const Section = ({ title, rows, total, color }: any) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color, padding: "10px 16px", background: color + "10", borderRadius: 8, marginBottom: 8 }}>{title}</div>
      {rows.map((r: any, i: number) => {
        const val = Number(r.closing_debit) - Number(r.closing_credit);
        if (Math.abs(val) < 0.01) return null;
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 16px", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
            <span style={{ color: "var(--text-secondary)" }}>{r.account_code} — {ar ? r.account_name_ar : r.account_name_en}</span>
            <span style={{ fontWeight: 600 }}>{fmt(val)} {ar ? "ر.س" : "SAR"}</span>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", fontWeight: 700, fontSize: 14, borderTop: "2px solid var(--border)", marginTop: 4 }}>
        <span>{ar ? "الإجمالي" : "Total"}</span>
        <span style={{ color }}>{fmt(total)} {ar ? "ر.س" : "SAR"}</span>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الميزانية العمومية" : "Balance Sheet"}</span>
          </div>
          <h1 className="page-title">{ar ? "الميزانية العمومية" : "Balance Sheet"}</h1>
        </div>
        {data && <StructuredReportPrintButton locale={locale} title={ar ? "الميزانية العمومية" : "Balance Sheet"} subtitle={ar ? "تقرير المركز المالي" : "Statement of financial position"} period={ar ? `كما في ${asOf}` : `As of ${asOf}`} reportCode={`BS-${asOf.replaceAll("-", "")}`} metrics={[{ label: ar ? "إجمالي الأصول" : "Total assets", value: `${fmt(data.totalAssets)} SAR`, tone: "blue" }, { label: ar ? "إجمالي الخصوم" : "Total liabilities", value: `${fmt(data.totalLiabilities)} SAR`, tone: "red" }, { label: ar ? "حقوق الملكية" : "Equity", value: `${fmt(data.totalEquity)} SAR`, tone: "green" }]} tables={[{ title: ar ? "الأصول" : "Assets", headers: [ar ? "رمز الحساب" : "Code", ar ? "اسم الحساب" : "Account name", ar ? "الرصيد" : "Balance"], rows: data.assets.filter((r: any) => Math.abs(Number(r.closing_debit) - Number(r.closing_credit)) >= 0.01).map((r: any) => [r.account_code, ar ? r.account_name_ar : r.account_name_en, `${fmt(Number(r.closing_debit) - Number(r.closing_credit))} SAR`]), totals: [ar ? "إجمالي الأصول" : "Total assets", "", `${fmt(data.totalAssets)} SAR`] }, { title: ar ? "الخصوم وحقوق الملكية" : "Liabilities & equity", headers: [ar ? "رمز الحساب" : "Code", ar ? "اسم الحساب" : "Account name", ar ? "الرصيد" : "Balance"], rows: [...data.liabilities, ...data.equity].filter((r: any) => Math.abs(Number(r.closing_debit) - Number(r.closing_credit)) >= 0.01).map((r: any) => [r.account_code, ar ? r.account_name_ar : r.account_name_en, `${fmt(Number(r.closing_debit) - Number(r.closing_credit))} SAR`]), totals: [ar ? "إجمالي الخصوم وحقوق الملكية" : "Total liabilities & equity", "", `${fmt(data.totalLiabilities + data.totalEquity)} SAR`] }]} />}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 260 }}>
            <label className="form-label">{ar ? "الحساب (اختياري)" : "Account (optional)"}</label>
            <select className="form-input form-select" value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">{ar ? "— كل الحسابات —" : "— All accounts —"}</option>
              {accounts.filter(a => a.is_active && a.is_posting && (a.allow_direct_posting ?? true)).map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en || a.name_ar}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{ar ? "بتاريخ" : "As of Date"}</label>
            <input type="date" className="form-input" value={asOf} onChange={e => setAsOf(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? (ar ? "جاري..." : "Loading...") : (ar ? "عرض" : "Show")}
          </button>
        </div>
      </div>

      {data && (
        <div className="grid-2" id="report-content-balance-sheet">
          <div className="card">
            <div className="card-header"><span className="card-title">{ar ? "الأصول" : "Assets"}</span></div>
            <div className="card-body" style={{ padding: "12px 0" }}>
              <Section title={ar ? "الأصول" : "Assets"} rows={data.assets} total={data.totalAssets} color="#5A187E" />
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">{ar ? "الخصوم وحقوق الملكية" : "Liabilities & Equity"}</span></div>
            <div className="card-body" style={{ padding: "12px 0" }}>
              <Section title={ar ? "الخصوم" : "Liabilities"} rows={data.liabilities} total={data.totalLiabilities} color="#DC2626" />
              <Section title={ar ? "حقوق الملكية" : "Equity"} rows={data.equity} total={data.totalEquity} color="#75617F" />
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", fontWeight: 800, fontSize: 15, background: "#F8FAFC", borderTop: "2px solid var(--border)" }}>
                <span>{ar ? "إجمالي الخصوم وحقوق الملكية" : "Total Liabilities & Equity"}</span>
                <span style={{ color: Math.abs(data.totalLiabilities + data.totalEquity - data.totalAssets) < 1 ? "#059669" : "#DC2626" }}>
                  {fmt(data.totalLiabilities + data.totalEquity)} {ar ? "ر.س" : "SAR"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
