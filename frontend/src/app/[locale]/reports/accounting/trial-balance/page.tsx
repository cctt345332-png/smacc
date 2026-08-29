"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getTrialBalance, getAccounts } from "@/lib/accounting";
import TrialBalancePrintButton from "@/components/documents/TrialBalancePrintButton";

export default function TrialBalancePage(props: { params: Promise<{ locale: string }> }) {
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
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getAccounts().then(({ data }) => setAccounts(data)).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: rows } = await getTrialBalance(fromDate + "T00:00:00", toDate + "T23:59:59", accountId || undefined);
      setData(rows);
      setLoaded(true);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setLoading(false); }
  };

  const totals = data.reduce((acc, r) => ({
    od: acc.od + Number(r.opening_debit), oc: acc.oc + Number(r.opening_credit),
    pd: acc.pd + Number(r.period_debit), pc: acc.pc + Number(r.period_credit),
    cd: acc.cd + Number(r.closing_debit), cc: acc.cc + Number(r.closing_credit),
  }), { od: 0, oc: 0, pd: 0, pc: 0, cd: 0, cc: 0 });

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2 });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "ميزان المراجعة" : "Trial Balance"}</span>
          </div>
          <h1 className="page-title">{ar ? "ميزان المراجعة" : "Trial Balance"}</h1>
        </div>
        {loaded && <TrialBalancePrintButton locale={locale} fromDate={fromDate} toDate={toDate} rows={data} />}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 260 }}>
            <label className="form-label">{ar ? "الحساب (اختياري)" : "Account (optional)"}</label>
            <select className="form-input form-select" value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">{ar ? "— كل الحسابات —" : "— All accounts —"}</option>
              {accounts.filter(a => a.is_active && a.is_posting && (a.allow_direct_posting ?? true)).map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en || a.name_ar}</option>)}
            </select>
          </div>
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

      {loaded && (
        <div className="card" id="report-content-trial-balance">
          <div className="card-header">
            <span className="card-title">{ar ? "ميزان المراجعة" : "Trial Balance"}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fromDate} → {toDate}</span>
          </div>
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th rowSpan={2}>{ar ? "الكود" : "Code"}</th>
                  <th rowSpan={2}>{ar ? "اسم الحساب" : "Account Name"}</th>
                  <th colSpan={2} style={{ textAlign: "center" }}>{ar ? "الرصيد الافتتاحي" : "Opening"}</th>
                  <th colSpan={2} style={{ textAlign: "center" }}>{ar ? "حركة الفترة" : "Period"}</th>
                  <th colSpan={2} style={{ textAlign: "center" }}>{ar ? "الرصيد الختامي" : "Closing"}</th>
                </tr>
                <tr>
                  <th style={{ textAlign: "end" }}>{ar ? "مدين" : "Dr"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "دائن" : "Cr"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "مدين" : "Dr"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "دائن" : "Cr"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "مدين" : "Dr"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "دائن" : "Cr"}</th>
                </tr>
              </thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.account_id}>
                    <td><code style={{ fontSize: 12 }}>{r.account_code}</code></td>
                    <td>{ar ? r.account_name_ar : r.account_name_en}</td>
                    <td style={{ textAlign: "end" }}>{Number(r.opening_debit) > 0 ? fmt(Number(r.opening_debit)) : "—"}</td>
                    <td style={{ textAlign: "end" }}>{Number(r.opening_credit) > 0 ? fmt(Number(r.opening_credit)) : "—"}</td>
                    <td style={{ textAlign: "end", color: "#5A187E" }}>{Number(r.period_debit) > 0 ? fmt(Number(r.period_debit)) : "—"}</td>
                    <td style={{ textAlign: "end", color: "#059669" }}>{Number(r.period_credit) > 0 ? fmt(Number(r.period_credit)) : "—"}</td>
                    <td style={{ textAlign: "end", fontWeight: 600 }}>{Number(r.closing_debit) > 0 ? fmt(Number(r.closing_debit)) : "—"}</td>
                    <td style={{ textAlign: "end", fontWeight: 600 }}>{Number(r.closing_credit) > 0 ? fmt(Number(r.closing_credit)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                  <td colSpan={2} style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                  <td style={{ textAlign: "end", padding: "12px 16px" }}>{fmt(totals.od)}</td>
                  <td style={{ textAlign: "end", padding: "12px 16px" }}>{fmt(totals.oc)}</td>
                  <td style={{ textAlign: "end", padding: "12px 16px", color: "#5A187E" }}>{fmt(totals.pd)}</td>
                  <td style={{ textAlign: "end", padding: "12px 16px", color: "#059669" }}>{fmt(totals.pc)}</td>
                  <td style={{ textAlign: "end", padding: "12px 16px" }}>{fmt(totals.cd)}</td>
                  <td style={{ textAlign: "end", padding: "12px 16px" }}>{fmt(totals.cc)}</td>
                </tr>
                <tr>
                  <td colSpan={8} style={{ padding: "8px 16px", fontSize: 12 }}>
                    {Math.abs(totals.cd - totals.cc) < 0.01
                      ? <span style={{ color: "#059669", fontWeight: 600 }}>{ar ? "الميزان متوازن" : "Balanced"}</span>
                      : <span style={{ color: "#DC2626", fontWeight: 600 }}>{ar ? "غير متوازن" : "Not balanced"}</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
