"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getJournalEntry } from "@/lib/accounting";
import { getAccounts } from "@/lib/accounting";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const statusAr: Record<string, string> = { draft: "مسودة", posted: "مرحّل", cancelled: "ملغي" };
const statusClass: Record<string, string> = { draft: "badge-warning", posted: "badge-success", cancelled: "badge-danger" };

export default function JournalEntryDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);
  const { locale, id } = params;
  const ar = locale === "ar";
  const router = useRouter();
  const [entry, setEntry] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getJournalEntry(id), getAccounts()]).then(([entryRes, accountsRes]) => {
      setEntry(entryRes.data);
      setAccounts(Array.isArray(accountsRes.data) ? accountsRes.data : []);
    }).catch((e: any) => setError(e?.response?.data?.detail || (ar ? "القيد غير موجود" : "Journal entry not found")))
      .finally(() => setLoading(false));
  }, [id, ar]);

  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));
  const lines = entry?.lines || [];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><Link href={`/${locale}/accounting/journal`}>{ar ? "قيود اليومية" : "Journal Entries"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "عرض القيد" : "View Entry"}</span></div>
          <h1 className="page-title">{ar ? "تفاصيل القيد" : "Journal Entry Details"}</h1>
          <p className="page-subtitle">{ar ? "عرض الحسابات المدينة والدائنة والبيان الكامل للقيد" : "View the complete debit, credit and journal details"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}><button className="btn btn-secondary btn-sm" onClick={() => router.back()}>{ar ? "رجوع" : "Back"}</button>{entry && <StructuredReportPrintButton locale={locale} title={ar ? "تفاصيل القيد" : "Journal Entry Details"} subtitle={entry.description_ar || ""} period={new Date(entry.entry_date).toLocaleDateString("en-GB")} reportCode={entry.entry_number} orientation="landscape" metrics={[{ label: ar ? "الحالة" : "Status", value: ar ? statusAr[entry.status] || entry.status : entry.status, tone: entry.status === "posted" ? "green" : entry.status === "cancelled" ? "red" : "amber" }, { label: ar ? "إجمالي المدين" : "Total debit", value: `${fmt(entry.total_debit)} SAR`, tone: "blue" }, { label: ar ? "إجمالي الدائن" : "Total credit", value: `${fmt(entry.total_credit)} SAR`, tone: "green" }]} tables={[{ title: ar ? "سطور القيد" : "Journal lines", headers: [ar ? "الحساب" : "Account", ar ? "البيان" : "Description", ar ? "مدين" : "Debit", ar ? "دائن" : "Credit"], rows: lines.map((line: any) => [accountMap[line.account_id]?.name_ar || line.account_id, line.description || "—", fmt(line.debit), fmt(line.credit)]), totals: [ar ? "الإجمالي" : "TOTAL", "", fmt(entry.total_debit), fmt(entry.total_credit)] }]} />}</div>
      </div>

      {loading ? <div className="card"><div className="empty-state">{ar ? "جاري تحميل القيد..." : "Loading journal entry..."}</div></div> : error ? <div className="card"><div className="empty-state"><div className="empty-state-title">{error}</div><Link className="btn btn-primary btn-sm" style={{ marginTop: 12 }} href={`/${locale}/accounting/journal`}>{ar ? "العودة إلى القيود" : "Back to journal"}</Link></div></div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card"><div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}><div><div className="stat-label">{ar ? "رقم القيد" : "Entry #"}</div><strong>{entry.entry_number}</strong></div><div><div className="stat-label">{ar ? "التاريخ" : "Date"}</div><strong>{new Date(entry.entry_date).toLocaleDateString("en-SA")}</strong></div><div><div className="stat-label">{ar ? "الحالة" : "Status"}</div><span className={`badge ${statusClass[entry.status] || "badge-neutral"}`}>{ar ? statusAr[entry.status] || entry.status : entry.status}</span></div><div><div className="stat-label">{ar ? "المرجع" : "Reference"}</div><strong>{entry.reference || "—"}</strong></div></div></div>
          <div className="card"><div className="card-body"><div style={{ marginBottom: 16 }}><div className="stat-label">{ar ? "البيان" : "Description"}</div><div style={{ fontSize: 16, fontWeight: 700 }}>{ar ? entry.description_ar : entry.description_en || entry.description_ar}</div>{entry.notes && <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>{entry.notes}</div>}</div><div className="table-wrapper"><table><thead><tr><th>{ar ? "#" : "#"}</th><th>{ar ? "الحساب" : "Account"}</th><th>{ar ? "كود الحساب" : "Account code"}</th><th>{ar ? "البيان" : "Description"}</th><th style={{ textAlign: "end" }}>{ar ? "مدين" : "Debit"}</th><th style={{ textAlign: "end" }}>{ar ? "دائن" : "Credit"}</th></tr></thead><tbody>{lines.map((line: any, index: number) => { const account = accountMap[line.account_id]; return <tr key={line.id || index}><td>{index + 1}</td><td style={{ fontWeight: 700 }}>{account?.name_ar || line.account_id}</td><td style={{ fontFamily: "monospace" }}>{account?.code || "—"}</td><td>{line.description || "—"}</td><td style={{ textAlign: "end", color: "#5A187E", fontWeight: 700 }}>{Number(line.debit) ? `${fmt(line.debit)} SAR` : "—"}</td><td style={{ textAlign: "end", color: "#15803D", fontWeight: 700 }}>{Number(line.credit) ? `${fmt(line.credit)} SAR` : "—"}</td></tr>; })}</tbody><tfoot><tr style={{ fontWeight: 800 }}><td colSpan={4}>{ar ? "الإجمالي" : "Total"}</td><td style={{ textAlign: "end" }}>{fmt(entry.total_debit)} SAR</td><td style={{ textAlign: "end" }}>{fmt(entry.total_credit)} SAR</td></tr></tfoot></table></div></div></div>
        </div>
      )}
    </>
  );
}
