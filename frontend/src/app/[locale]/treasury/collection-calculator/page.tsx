"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getReps } from "@/lib/reps";
import { getPayments } from "@/lib/sales";
import { getExpenses } from "@/lib/expenses";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amount = (value: string) => Math.max(0, Number(value) || 0);
const dateOnly = (value: any) => String(value || "").slice(0, 10);
const paymentMethod = (value: any) => typeof value === "string" ? value : value?.value || "";

const RECEIPT_METHODS = [
  ["cash", "نقداً", "Cash"], ["bank_transfer", "تحويل بنكي", "Bank transfer"], ["cheque", "شيكات", "Cheques"],
  ["credit_card", "بطاقات", "Cards"], ["mada", "مدى", "Mada"], ["stc_pay", "STC Pay", "STC Pay"],
] as const;
const EXPENSE_TYPES = [
  ["fuel", "وقود", "Fuel"], ["vehicle", "صيانة ومواصلات", "Maintenance and transport"],
  ["communications", "اتصالات", "Communications"], ["other", "مصروفات أخرى", "Other expenses"],
] as const;
type Values = Record<string, string>;
type Totals = Record<string, number>;

const emptyTotals = (keys: readonly (readonly [string, string, string])[]): Totals => Object.fromEntries(keys.map(([key]) => [key, 0]));

export default function CollectionCalculatorPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const today = new Date().toISOString().slice(0, 10);
  const [reps, setReps] = useState<any[]>([]);
  const [repId, setRepId] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [receipts, setReceipts] = useState<Values>({});
  const [expenses, setExpenses] = useState<Values>({});
  const [systemReceipts, setSystemReceipts] = useState<Totals>(emptyTotals(RECEIPT_METHODS));
  const [systemExpenses, setSystemExpenses] = useState<Totals>(emptyTotals(EXPENSE_TYPES));
  const [systemCashExpenses, setSystemCashExpenses] = useState(0);
  const [systemCounts, setSystemCounts] = useState({ payments: 0, expenses: 0, pendingExpenses: 0 });
  const [loadingSystem, setLoadingSystem] = useState(false);
  const [systemError, setSystemError] = useState("");

  useEffect(() => {
    getReps().then(({ data }) => setReps(Array.isArray(data) ? data : [])).catch(() => setReps([]));
  }, []);

  useEffect(() => {
    let active = true;
    const loadSystemData = async () => {
      setLoadingSystem(true); setSystemError("");
      try {
        const [{ data: paymentData }, { data: expenseData }] = await Promise.all([
          getPayments({ ...(repId ? { rep_id: repId } : {}), ...(from ? { date_from: `${from}T00:00:00` } : {}), ...(to ? { date_to: `${to}T23:59:59` } : {}) }),
          getExpenses({ ...(repId ? { rep_id: repId } : {}), ...(from ? { date_from: `${from}T00:00:00` } : {}), ...(to ? { date_to: `${to}T23:59:59` } : {}) }),
        ]);
        const payments = (Array.isArray(paymentData) ? paymentData : []).filter((row: any) => {
          const date = dateOnly(row.payment_date);
          return (!from || date >= from) && (!to || date <= to) && row.payment_type !== "discount";
        });
        const allExpenses = Array.isArray(expenseData) ? expenseData : [];
        const approved = allExpenses.filter((row: any) => row.status === "approved");
        const nextReceipts = emptyTotals(RECEIPT_METHODS);
        payments.forEach((row: any) => { const key = paymentMethod(row.payment_method); if (key in nextReceipts) nextReceipts[key] += Number(row.amount || 0); });
        const nextExpenses = emptyTotals(EXPENSE_TYPES);
        let cashExpenses = 0;
        approved.forEach((row: any) => {
          const category = row.category === "vehicle_maintenance" ? "vehicle" : (row.category in nextExpenses ? row.category : "other");
          nextExpenses[category] += Number(row.amount || 0);
          if (["cash", "rep_advance"].includes(paymentMethod(row.payment_method))) cashExpenses += Number(row.amount || 0);
        });
        if (active) { setSystemReceipts(nextReceipts); setSystemExpenses(nextExpenses); setSystemCashExpenses(cashExpenses); setSystemCounts({ payments: payments.length, expenses: approved.length, pendingExpenses: allExpenses.filter((row: any) => row.status === "pending").length }); }
      } catch { if (active) setSystemError(ar ? "تعذر جلب بيانات السندات والمصاريف" : "Could not load receipts and expenses"); }
      finally { if (active) setLoadingSystem(false); }
    };
    loadSystemData();
    return () => { active = false; };
  }, [repId, from, to, ar]);

  const totalReceipts = RECEIPT_METHODS.reduce((sum, [key]) => sum + systemReceipts[key] + amount(receipts[key] || ""), 0);
  const totalExpenses = EXPENSE_TYPES.reduce((sum, [key]) => sum + systemExpenses[key] + amount(expenses[key] || ""), 0);
  const cashCollected = systemReceipts.cash + amount(receipts.cash || "");
  // المصروف اليدوي في هذه الأداة يعتبر مصروفاً نقدياً ما لم يكن مسجلاً بالنظام
  // بطريقة دفع غير نقدية؛ لذلك يُخصم من مبلغ التسليم النقدي مباشرة.
  const manualExpensesTotal = EXPENSE_TYPES.reduce((sum, [key]) => sum + amount(expenses[key] || ""), 0);
  const cashExpenses = systemCashExpenses + manualExpensesTotal;
  const cashDue = cashCollected - cashExpenses;
  const net = totalReceipts - totalExpenses;
  const selectedRep = reps.find((rep: any) => String(rep.id) === String(repId));
  const repName = selectedRep?.full_name || selectedRep?.name || selectedRep?.rep_code || (ar ? "كل المناديب" : "All reps");
  const period = from || to ? `${from || (ar ? "البداية" : "Start")} — ${to || (ar ? "حتى اليوم" : "Today")}` : (ar ? "كل الفترات" : "All periods");
  const receiptRows = RECEIPT_METHODS.map(([key, arName, enName]) => [ar ? arName : enName, `${fmt(systemReceipts[key] + amount(receipts[key] || ""))} SAR`]);
  const expenseRows = EXPENSE_TYPES.map(([key, arName, enName]) => [ar ? arName : enName, `${fmt(systemExpenses[key] + amount(expenses[key] || ""))} SAR`]);
  const allRows = [
    [ar ? "إجمالي المقبوض" : "Total collections", `${fmt(totalReceipts)} SAR`], ...receiptRows,
    [ar ? "إجمالي المصروف" : "Total expenses", `${fmt(totalExpenses)} SAR`], ...expenseRows,
    [ar ? "النقد المطلوب تسليمه" : "Cash to hand over", `${fmt(cashDue)} SAR`],
    [ar ? "الصافي الكلي" : "Overall net", `${fmt(net)} SAR`],
  ];
  const clearManual = () => { setReceipts({}); setExpenses({}); };
  const input = (group: Values, setter: (value: Values) => void, key: string) => <input type="number" min="0" step="0.01" className="form-input" value={group[key] || ""} onChange={e => setter({ ...group, [key]: e.target.value })} placeholder="0.00" dir="ltr" />;

  return <>
    <div className="page-header"><div><div className="breadcrumb"><Link href={`/${locale}/treasury`}>{ar ? "الخزينة والمدفوعات" : "Treasury"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "حاسبة التسوية" : "Settlement calculator"}</span></div><h1 className="page-title">{ar ? "حاسبة تسوية المندوب" : "Representative settlement calculator"}</h1><p className="page-subtitle">{ar ? "تجلب السندات والمصاريف تلقائياً حسب المندوب والفترة، مع إمكانية إضافة مبالغ يدوية غير مسجلة" : "Automatically loads receipts and expenses by representative and period, with manual additions for unrecorded amounts"}</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn btn-secondary btn-sm" onClick={clearManual}>{ar ? "مسح الإضافات اليدوية" : "Clear manual additions"}</button><StructuredReportPrintButton locale={locale} title={ar ? "تقرير تسوية المندوب" : "Representative settlement report"} subtitle={ar ? "السندات والمصاريف والنقد المطلوب تسليمه" : "Receipts, expenses and cash to hand over"} period={`${period} · ${ar ? "المندوب: " : "Representative: "}${repName}`} orientation="portrait" reportCode={`SET-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`} metrics={[{ label: ar ? "إجمالي المقبوض" : "Total collected", value: `${fmt(totalReceipts)} SAR`, tone: "green" }, { label: ar ? "النقد المطلوب تسليمه" : "Cash to hand over", value: `${fmt(cashDue)} SAR`, tone: cashDue >= 0 ? "blue" : "red" }, { label: ar ? "إجمالي المصروف" : "Total expenses", value: `${fmt(totalExpenses)} SAR`, tone: "amber" }]} tables={[{ title: ar ? "ملخص التسوية" : "Settlement summary", headers: ar ? ["البيان", "المبلغ"] : ["Description", "Amount"], rows: allRows, totals: [ar ? "النقد المطلوب تسليمه" : "Cash to hand over", `${fmt(cashDue)} SAR`] }]} /></div></div>

    <div className="card" style={{ marginBottom: 16, padding: 16 }}><div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}><div className="form-group" style={{ margin: 0, minWidth: 240, flex: 1 }}><label className="form-label">{ar ? "المندوب" : "Representative"}</label><select className="form-input form-select" value={repId} onChange={e => setRepId(e.target.value)}><option value="">{ar ? "كل المناديب" : "All representatives"}</option>{reps.map(rep => <option key={rep.id} value={rep.id}>{rep.full_name || rep.name || rep.rep_code}</option>)}</select></div><div className="form-group" style={{ margin: 0, minWidth: 170 }}><label className="form-label">{ar ? "من تاريخ" : "From date"}</label><input type="date" className="form-input" value={from} onChange={e => setFrom(e.target.value)} /></div><div className="form-group" style={{ margin: 0, minWidth: 170 }}><label className="form-label">{ar ? "إلى تاريخ" : "To date"}</label><input type="date" className="form-input" value={to} onChange={e => setTo(e.target.value)} /></div></div></div>

    {systemError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{systemError}</div>}
    <div className="card" style={{ marginBottom: 16, padding: 14, background: "#F8F4FA" }}><strong>{loadingSystem ? (ar ? "جاري تحديث بيانات النظام..." : "Refreshing system data...") : (ar ? "تم التحديث تلقائياً من النظام" : "Automatically updated from system")}</strong><span style={{ marginInlineStart: 16, color: "var(--text-muted)", fontSize: 13 }}>{systemCounts.payments} {ar ? "سند قبض" : "receipts"} · {systemCounts.expenses} {ar ? "مصروف معتمد" : "approved expenses"}{systemCounts.pendingExpenses ? ` · ${systemCounts.pendingExpenses} ${ar ? "مصروف بانتظار الاعتماد مستبعد" : "pending expenses excluded"}` : ""}</span></div>

    <div className="grid-2" style={{ alignItems: "start", gap: 16 }}><section className="card" style={{ padding: 20 }}><h2 style={{ marginTop: 0, color: "#3E0865" }}>{ar ? "المقبوض حسب طريقة الدفع" : "Collections by payment method"}</h2><p style={{ color: "var(--text-muted)", fontSize: 13 }}>{ar ? "القيمة الأولى من النظام، ويمكن إضافة مبلغ يدوي غير مسجل" : "System amount first; add a manual amount if needed"}</p><div style={{ display: "grid", gap: 12 }}>{RECEIPT_METHODS.map(([key, arName, enName]) => <div key={key} className="form-group" style={{ margin: 0 }}><label className="form-label">{ar ? arName : enName}</label><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><input className="form-input" value={fmt(systemReceipts[key])} readOnly dir="ltr" title={ar ? "من النظام" : "From system"} /><div>{input(receipts, setReceipts, key)}</div></div><small style={{ color: "var(--text-muted)" }}>{ar ? "النظام / إضافة يدوية" : "System / Manual addition"}</small></div>)}</div><div style={{ marginTop: 18, padding: 14, background: "#F4EFF7", borderRadius: 8, display: "flex", justifyContent: "space-between", fontWeight: 800 }}><span>{ar ? "إجمالي المقبوض" : "Total collected"}</span><span dir="ltr">{fmt(totalReceipts)} SAR</span></div></section>
      <section className="card" style={{ padding: 20 }}><h2 style={{ marginTop: 0, color: "#3E0865" }}>{ar ? "المصروف المعتمد" : "Approved expenses"}</h2><p style={{ color: "var(--text-muted)", fontSize: 13 }}>{ar ? "المصروفات المعتمدة فقط تدخل في الحسبة، ويمكن إضافة مبلغ يدوي" : "Approved expenses only are included; manual additions are supported"}</p><div style={{ display: "grid", gap: 12 }}>{EXPENSE_TYPES.map(([key, arName, enName]) => <div key={key} className="form-group" style={{ margin: 0 }}><label className="form-label">{ar ? arName : enName}</label><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><input className="form-input" value={fmt(systemExpenses[key])} readOnly dir="ltr" /><div>{input(expenses, setExpenses, key)}</div></div><small style={{ color: "var(--text-muted)" }}>{ar ? "النظام / إضافة يدوية" : "System / Manual addition"}</small></div>)}</div><div style={{ marginTop: 18, padding: 14, background: "#FFF7ED", borderRadius: 8, display: "flex", justifyContent: "space-between", fontWeight: 800 }}><span>{ar ? "إجمالي المصروف" : "Total expenses"}</span><span dir="ltr">{fmt(totalExpenses)} SAR</span></div></section></div>

    <section className="card" style={{ marginTop: 16, padding: 20 }}><h2 style={{ marginTop: 0 }}>{ar ? "المبلغ النقدي المطلوب تسليمه" : "Cash amount to hand over"}</h2><p style={{ color: "var(--text-muted)" }}>{ar ? "النقد المطلوب = المقبوض النقدي − المصروف النقدي. التحويلات والبطاقات لا تدخل في مبلغ النقد المسلم." : "Cash to hand over = cash collected − cash expenses. Transfers and cards are excluded from the cash handover."}</p><div className="grid-3"><div className="stat-card"><div className="stat-content"><div className="stat-label">{ar ? "المقبوض النقدي" : "Cash collected"}</div><div className="stat-value" style={{ color: "#2F855A" }} dir="ltr">{fmt(cashCollected)} SAR</div></div></div><div className="stat-card"><div className="stat-content"><div className="stat-label">{ar ? "المصروف النقدي" : "Cash expenses"}</div><div className="stat-value" style={{ color: "#B45309" }} dir="ltr">{fmt(cashExpenses)} SAR</div></div></div><div className="stat-card"><div className="stat-content"><div className="stat-label">{ar ? "النقد المطلوب تسليمه" : "Cash to hand over"}</div><div className="stat-value" style={{ color: cashDue >= 0 ? "#3E0865" : "#B42318" }} dir="ltr">{fmt(cashDue)} SAR</div></div></div></div><div className="table-wrapper" style={{ marginTop: 18 }}><table><thead><tr><th>{ar ? "البيان" : "Description"}</th><th style={{ textAlign: "end" }}>{ar ? "المبلغ" : "Amount"}</th></tr></thead><tbody>{allRows.map(([label, value], index) => <tr key={`${label}-${index}`}><td style={{ fontWeight: index === 0 || index === receiptRows.length + 1 || index >= allRows.length - 2 ? 800 : 500 }}>{label}</td><td style={{ textAlign: "end", fontWeight: 700 }} dir="ltr">{value}</td></tr>)}</tbody></table></div></section>
  </>;
}
