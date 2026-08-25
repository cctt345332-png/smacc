"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getAccounts, getLedger } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

export default function LedgerPage(props: { params: Promise<{ locale: string }> }) {
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
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { getAccounts().then(({ data }) => setAccounts(data.filter((a: any) => a.is_posting))); }, []);

  const load = async () => {
    if (!accountId) return alert(ar ? "اختر حساباً" : "Select an account");
    setLoading(true);
    try {
      const { data } = await getLedger(accountId, fromDate + "T00:00:00", toDate + "T23:59:59");
      setRows(data); setLoaded(true);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setLoading(false); }
  };

  const fmt = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 });
  const selectedAcc = accounts.find(a => a.id === accountId);
  const totalDebit = rows.reduce((s, r) => s + Number(r.debit), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.credit), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "دفتر الأستاذ العام" : "General Ledger"}</span>
          </div>
          <h1 className="page-title">{ar ? "دفتر الأستاذ العام" : "General Ledger"}</h1>
          <p className="page-subtitle">{ar ? "حركات الحسابات المحاسبية" : "Account transaction history"}</p>
        </div>
        {loaded && <StructuredReportPrintButton locale={locale} title={ar ? "دفتر الأستاذ العام" : "General Ledger"} subtitle={selectedAcc ? `${selectedAcc.code} — ${ar ? selectedAcc.name_ar : selectedAcc.name_en}` : ""} period={`${fromDate} — ${toDate}`} orientation="landscape" reportCode={`GL-${fromDate.replaceAll("-", "")}`} metrics={[{ label: ar ? "إجمالي المدين" : "Total debit", value: `${fmt(totalDebit)} SAR`, tone: "blue" }, { label: ar ? "إجمالي الدائن" : "Total credit", value: `${fmt(totalCredit)} SAR`, tone: "green" }, { label: ar ? "الرصيد الختامي" : "Closing balance", value: `${fmt(rows.length ? Number(rows[rows.length - 1].balance) : 0)} SAR`, tone: "amber" }]} tables={[{ headers: [ar ? "رقم القيد" : "Entry #", ar ? "التاريخ" : "Date", ar ? "البيان" : "Description", ar ? "المرجع" : "Ref", ar ? "مدين" : "Debit", ar ? "دائن" : "Credit", ar ? "الرصيد" : "Balance"], rows: rows.map(r => [String(r.entry_number || "—"), new Date(r.entry_date).toLocaleDateString("en-SA"), String(r.description || "—"), String(r.reference || "—"), Number(r.debit) ? fmt(Number(r.debit)) : "—", Number(r.credit) ? fmt(Number(r.credit)) : "—", fmt(Number(r.balance || 0))]), totals: [ar ? "الإجمالي" : "Total", "", "", "", fmt(totalDebit), fmt(totalCredit), fmt(rows.length ? Number(rows[rows.length - 1].balance) : 0)] }]} />}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 280 }}>
            <label className="form-label">{ar ? "الحساب" : "Account"} <span className="required">*</span></label>
            <select className="form-input form-select" value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">{ar ? "اختر حساباً..." : "Select account..."}</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>)}
            </select>
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

      {loaded && (
        <>
          {selectedAcc && (
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              {[
                { label: ar ? "الحساب" : "Account", value: `${selectedAcc.code} — ${ar ? selectedAcc.name_ar : selectedAcc.name_en}` },
                { label: ar ? "إجمالي المدين" : "Total Debit", value: `${fmt(totalDebit)} ${ar ? "ر.س" : "SAR"}`, color: "#485668" },
                { label: ar ? "إجمالي الدائن" : "Total Credit", value: `${fmt(totalCredit)} ${ar ? "ر.س" : "SAR"}`, color: "#059669" },
                { label: ar ? "الرصيد الختامي" : "Closing Balance", value: rows.length ? `${fmt(Number(rows[rows.length - 1].balance))} ${ar ? "ر.س" : "SAR"}` : "0.00", color: "#D97706" },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: "12px 16px", flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: s.color || "var(--text-primary)" }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              {rows.length === 0 ? (
                <div className="empty-state">
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}><Icon name="ledger" size={24} /></div>
                  <div className="empty-state-title">{ar ? "لا توجد حركات في هذه الفترة" : "No transactions in this period"}</div>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "رقم القيد" : "Entry #"}</th>
                      <th>{ar ? "التاريخ" : "Date"}</th>
                      <th>{ar ? "البيان" : "Description"}</th>
                      <th>{ar ? "المرجع" : "Ref"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "مدين" : "Debit"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "دائن" : "Credit"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الرصيد" : "Balance"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td><Link href={`/${locale}/accounting/journal/${r.entry_id}`} style={{ color: "var(--primary)", fontWeight: 700, fontSize: 12, textDecoration: "none" }}>{r.entry_number}</Link></td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(r.entry_date).toLocaleDateString("en-SA")}</td>
                        <td>{r.description}</td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.reference || "—"}</td>
                        <td style={{ textAlign: "end", color: "#485668", fontWeight: Number(r.debit) > 0 ? 600 : 400 }}>{Number(r.debit) > 0 ? fmt(Number(r.debit)) : "—"}</td>
                        <td style={{ textAlign: "end", color: "#059669", fontWeight: Number(r.credit) > 0 ? 600 : 400 }}>{Number(r.credit) > 0 ? fmt(Number(r.credit)) : "—"}</td>
                        <td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(Number(r.balance))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", borderTop: "2px solid var(--border)", fontWeight: 700 }}>
                      <td colSpan={4} style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#485668" }}>{fmt(totalDebit)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#059669" }}>{fmt(totalCredit)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px" }}>{rows.length ? fmt(Number(rows[rows.length - 1].balance)) : "0.00"}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
