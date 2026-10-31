"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createExpenseBatch } from "@/lib/treasury";
import { getAccounts, getFiscalYears, getOperationalAccountMappings } from "@/lib/accounting";

const today = () => new Date().toISOString().split("T")[0];
const CATS = [{ value: "rent", ar: "إيجار" }, { value: "utilities", ar: "كهرباء وماء" }, { value: "salaries", ar: "رواتب" }, { value: "maintenance", ar: "صيانة" }, { value: "transport", ar: "مواصلات" }, { value: "marketing", ar: "تسويق" }, { value: "office", ar: "مستلزمات مكتبية" }, { value: "insurance", ar: "تأمين" }, { value: "government", ar: "رسوم حكومية" }, { value: "other", ar: "أخرى" }];
const METHODS = [{ value: "cash", ar: "نقداً" }, { value: "bank_transfer", ar: "تحويل بنكي" }, { value: "cheque", ar: "شيك" }];
const emptyRow = () => ({ description_ar: "", total_amount: "", expense_category: "other", payment_method: "cash", debit_account_id: "", party_name: "", notes: "" });

export default function BatchExpensesPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params); const ar = locale === "ar"; const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]); const [years, setYears] = useState<any[]>([]); const [mappings, setMappings] = useState<any[]>([]);
  const [date, setDate] = useState(today()); const [year, setYear] = useState(""); const [rows, setRows] = useState<any[]>([emptyRow(), emptyRow()]); const [saving, setSaving] = useState(false);
  useEffect(() => { Promise.all([getAccounts(), getFiscalYears(), getOperationalAccountMappings().catch(() => ({ data: [] }))]).then(([a, y, m]) => { setAccounts(a.data); setYears(y.data); setMappings(m.data || []); if (y.data[0]) setYear(y.data[0].id); }); }, []);
  const expenseAccounts = accounts.filter(a => a.account_type === "expense");
  const update = (i: number, key: string, value: string) => setRows(old => old.map((r, n) => n === i ? { ...r, [key]: value } : r));
  const total = rows.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
  const submit = async () => {
    const valid = rows.filter(r => r.description_ar.trim() || r.total_amount);
    if (!year || !valid.length) return alert(ar ? "أدخل السنة المالية ومصروفًا واحدًا على الأقل" : "Select fiscal year and enter at least one expense");
    if (valid.some(r => !r.description_ar.trim() || Number(r.total_amount) <= 0)) return alert(ar ? "أكمل بيان ومبلغ كل مصروف" : "Complete every description and amount");
    setSaving(true);
    try { await createExpenseBatch({ voucher_date: new Date(date).toISOString(), fiscal_year_id: year, description_ar: `ترحيل ${valid.length} مصروفات`, items: valid }); alert(ar ? "تم ترحيل المصروفات في قيد محاسبي واحد" : "Expenses posted in one journal entry"); router.push(`/${locale}/treasury/expenses`); }
    catch (e: any) { alert(e?.response?.data?.detail || (ar ? "تعذر ترحيل المصروفات" : "Could not post expenses")); } finally { setSaving(false); }
  };
  return <>
    <div className="page-header"><div><div className="breadcrumb"><Link href={`/${locale}/treasury/expenses`}>{ar ? "المصروفات" : "Expenses"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "مصروفات متعددة" : "Batch Expenses"}</span></div><h1 className="page-title">{ar ? "إدخال مصروفات متعددة" : "Batch Expenses"}</h1><p className="page-subtitle">{ar ? "إدخال عدة مصروفات وترحيلها في قيد محاسبي واحد" : "Enter multiple expenses and post them in one journal entry"}</p></div><div style={{ display: "flex", gap: 8 }}><Link href={`/${locale}/treasury/expenses`} className="btn btn-secondary btn-sm">{ar ? "إلغاء" : "Cancel"}</Link><button className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>{saving ? (ar ? "جاري الترحيل..." : "Posting...") : (ar ? "حفظ وترحيل كقيد واحد" : "Post as One Journal")}</button></div></div>
    <div className="card" style={{ marginBottom: 16 }}><div className="card-body"><div className="grid-2"><div className="form-group"><label className="form-label">{ar ? "تاريخ القيد" : "Entry date"}</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div><div className="form-group"><label className="form-label">{ar ? "السنة المالية" : "Fiscal year"}</label><select className="form-input form-select" value={year} onChange={e => setYear(e.target.value)}>{years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</select></div></div></div></div>
    <div className="card"><div className="card-header"><span className="card-title">{ar ? "بنود المصروفات" : "Expense lines"}</span><button className="btn btn-secondary btn-sm" onClick={() => setRows([...rows, emptyRow()])}>+ {ar ? "إضافة مصروف" : "Add expense"}</button></div><div className="table-wrapper"><table><thead><tr><th>#</th><th>{ar ? "البيان" : "Description"}</th><th>{ar ? "الفئة" : "Category"}</th><th>{ar ? "المبلغ شامل الضريبة" : "Total incl. VAT"}</th><th>{ar ? "طريقة الدفع" : "Payment"}</th><th>{ar ? "حساب المصروف" : "Expense account"}</th><th></th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{i + 1}</td><td><input className="form-input" value={r.description_ar} onChange={e => update(i, "description_ar", e.target.value)} placeholder={ar ? "وصف المصروف" : "Description"} /></td><td><select className="form-input form-select" value={r.expense_category} onChange={e => update(i, "expense_category", e.target.value)}>{CATS.map(c => <option key={c.value} value={c.value}>{c.ar}</option>)}</select></td><td><input type="number" min="0" step="0.01" className="form-input" value={r.total_amount} onChange={e => update(i, "total_amount", e.target.value)} /></td><td><select className="form-input form-select" value={r.payment_method} onChange={e => update(i, "payment_method", e.target.value)}>{METHODS.map(m => <option key={m.value} value={m.value}>{m.ar}</option>)}</select></td><td><select className="form-input form-select" value={r.debit_account_id} onChange={e => update(i, "debit_account_id", e.target.value)}><option value="">{ar ? "الافتراضي" : "Default"}</option>{expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>)}</select></td><td><button className="btn btn-ghost btn-sm" onClick={() => setRows(rows.filter((_, n) => n !== i))} disabled={rows.length === 1}>حذف</button></td></tr>)}</tbody></table></div><div style={{ padding: 16, textAlign: "end", fontWeight: 700, color: "var(--primary)" }}>{ar ? "الإجمالي شامل الضريبة:" : "Total incl. VAT:"} {total.toLocaleString("en-US", { minimumFractionDigits: 2 })} ر.س</div></div>
  </>;
}
