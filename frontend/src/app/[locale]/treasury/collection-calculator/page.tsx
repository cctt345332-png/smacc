"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getReps } from "@/lib/reps";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amount = (value: string) => Math.max(0, Number(value) || 0);

const RECEIPT_METHODS = [
  ["cash", "نقداً", "Cash"],
  ["bank_transfer", "تحويل بنكي", "Bank transfer"],
  ["cheque", "شيكات", "Cheques"],
  ["credit_card", "بطاقات", "Cards"],
  ["mada", "مدى", "Mada"],
  ["stc_pay", "STC Pay", "STC Pay"],
] as const;

const EXPENSE_TYPES = [
  ["fuel", "وقود", "Fuel"],
  ["vehicle", "صيانة ومواصلات", "Maintenance and transport"],
  ["communications", "اتصالات", "Communications"],
  ["other", "مصروفات أخرى", "Other expenses"],
] as const;

type Values = Record<string, string>;

export default function CollectionCalculatorPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [reps, setReps] = useState<any[]>([]);
  const [repId, setRepId] = useState("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [receipts, setReceipts] = useState<Values>({});
  const [expenses, setExpenses] = useState<Values>({});

  useEffect(() => {
    getReps().then(({ data }) => setReps(Array.isArray(data) ? data : [])).catch(() => setReps([]));
  }, []);

  const totalReceipts = RECEIPT_METHODS.reduce((sum, [key]) => sum + amount(receipts[key] || ""), 0);
  const totalExpenses = EXPENSE_TYPES.reduce((sum, [key]) => sum + amount(expenses[key] || ""), 0);
  const net = totalReceipts - totalExpenses;
  const selectedRep = reps.find((rep: any) => String(rep.id) === String(repId));
  const repName = selectedRep?.full_name || selectedRep?.name || selectedRep?.rep_code || (ar ? "كل المناديب" : "All reps");
  const period = from || to ? `${from || (ar ? "البداية" : "Start")} — ${to || (ar ? "حتى اليوم" : "Today")}` : (ar ? "كل الفترات" : "All periods");

  const receiptRows = RECEIPT_METHODS.map(([key, arName, enName]) => [ar ? arName : enName, `${fmt(amount(receipts[key] || ""))} SAR`]);
  const expenseRows = EXPENSE_TYPES.map(([key, arName, enName]) => [ar ? arName : enName, `${fmt(amount(expenses[key] || ""))} SAR`]);
  const allRows = [
    [ar ? "إجمالي المقبوض" : "Total collections", `${fmt(totalReceipts)} SAR`],
    ...receiptRows,
    [ar ? "إجمالي المصروف" : "Total expenses", `${fmt(totalExpenses)} SAR`],
    ...expenseRows,
    [ar ? "الصافي" : "Net balance", `${fmt(net)} SAR`],
  ];

  const clear = () => { setReceipts({}); setExpenses({}); };
  const input = (group: Values, setter: (value: Values) => void, key: string) => (
    <input
      type="number"
      min="0"
      step="0.01"
      className="form-input"
      value={group[key] || ""}
      onChange={e => setter({ ...group, [key]: e.target.value })}
      placeholder="0.00"
      dir="ltr"
    />
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><Link href={`/${locale}/treasury`}>{ar ? "الخزينة والمدفوعات" : "Treasury"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "حاسبة التسوية" : "Settlement calculator"}</span></div>
          <h1 className="page-title">{ar ? "حاسبة تسوية المندوب" : "Representative settlement calculator"}</h1>
          <p className="page-subtitle">{ar ? "حسبة يدوية للمقبوض والمصروف خلال فترة محددة — لا تنشئ سندات ولا تعدل القيود المحاسبية" : "Manual collection and expense calculation for a selected period — does not create vouchers or accounting entries"}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={clear}>{ar ? "مسح المبالغ" : "Clear amounts"}</button>
          <StructuredReportPrintButton
            locale={locale}
            title={ar ? "تقرير تسوية المندوب" : "Representative settlement report"}
            subtitle={ar ? "تقرير يدوي للمقبوض والمصروف والصافي" : "Manual collections, expenses and net balance"}
            period={`${period} · ${ar ? "المندوب: " : "Representative: "}${repName}`}
            orientation="portrait"
            reportCode={`SET-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`}
            metrics={[
              { label: ar ? "إجمالي المقبوض" : "Total collected", value: `${fmt(totalReceipts)} SAR`, tone: "green" },
              { label: ar ? "إجمالي المصروف" : "Total expenses", value: `${fmt(totalExpenses)} SAR`, tone: "amber" },
              { label: ar ? "الصافي" : "Net balance", value: `${fmt(net)} SAR`, tone: net >= 0 ? "blue" : "red" },
            ]}
            tables={[{ title: ar ? "ملخص التسوية" : "Settlement summary", headers: ar ? ["البيان", "المبلغ"] : ["Description", "Amount"], rows: allRows, totals: [ar ? "الصافي النهائي" : "Final net", `${fmt(net)} SAR`] }]}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 240, flex: 1 }}><label className="form-label">{ar ? "المندوب" : "Representative"}</label><select className="form-input form-select" value={repId} onChange={e => setRepId(e.target.value)}><option value="">{ar ? "كل المناديب" : "All representatives"}</option>{reps.map(rep => <option key={rep.id} value={rep.id}>{rep.full_name || rep.name || rep.rep_code}</option>)}</select></div>
          <div className="form-group" style={{ margin: 0, minWidth: 170 }}><label className="form-label">{ar ? "من تاريخ" : "From date"}</label><input type="date" className="form-input" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="form-group" style={{ margin: 0, minWidth: 170 }}><label className="form-label">{ar ? "إلى تاريخ" : "To date"}</label><input type="date" className="form-input" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start", gap: 16 }}>
        <section className="card" style={{ padding: 20 }}>
          <h2 style={{ marginTop: 0, color: "#3E0865" }}>{ar ? "المقبوض حسب طريقة الدفع" : "Collections by payment method"}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{ar ? "أدخل إجمالي كل طريقة قبض للفترة المحددة" : "Enter the total collected for each method in the selected period"}</p>
          <div style={{ display: "grid", gap: 12 }}>{RECEIPT_METHODS.map(([key, arName, enName]) => <div key={key} className="form-group" style={{ margin: 0 }}><label className="form-label">{ar ? arName : enName}</label>{input(receipts, setReceipts, key)}</div>)}</div>
          <div style={{ marginTop: 18, padding: 14, background: "#F4EFF7", borderRadius: 8, display: "flex", justifyContent: "space-between", fontWeight: 800 }}><span>{ar ? "إجمالي المقبوض" : "Total collected"}</span><span dir="ltr">{fmt(totalReceipts)} SAR</span></div>
        </section>

        <section className="card" style={{ padding: 20 }}>
          <h2 style={{ marginTop: 0, color: "#3E0865" }}>{ar ? "المصروف" : "Expenses"}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{ar ? "أدخل إجمالي المصروفات حسب التصنيف للفترة المحددة" : "Enter expenses by category for the selected period"}</p>
          <div style={{ display: "grid", gap: 12 }}>{EXPENSE_TYPES.map(([key, arName, enName]) => <div key={key} className="form-group" style={{ margin: 0 }}><label className="form-label">{ar ? arName : enName}</label>{input(expenses, setExpenses, key)}</div>)}</div>
          <div style={{ marginTop: 18, padding: 14, background: "#FFF7ED", borderRadius: 8, display: "flex", justifyContent: "space-between", fontWeight: 800 }}><span>{ar ? "إجمالي المصروف" : "Total expenses"}</span><span dir="ltr">{fmt(totalExpenses)} SAR</span></div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 16, padding: 20 }}>
        <h2 style={{ marginTop: 0 }}>{ar ? "ملخص الحسبة" : "Calculation summary"}</h2>
        <div className="grid-3">
          <div className="stat-card"><div className="stat-content"><div className="stat-label">{ar ? "المقبوض" : "Collected"}</div><div className="stat-value" style={{ color: "#2F855A" }} dir="ltr">{fmt(totalReceipts)} SAR</div></div></div>
          <div className="stat-card"><div className="stat-content"><div className="stat-label">{ar ? "المصروف" : "Expenses"}</div><div className="stat-value" style={{ color: "#B45309" }} dir="ltr">{fmt(totalExpenses)} SAR</div></div></div>
          <div className="stat-card"><div className="stat-content"><div className="stat-label">{ar ? "الصافي" : "Net"}</div><div className="stat-value" style={{ color: net >= 0 ? "#3E0865" : "#B42318" }} dir="ltr">{fmt(net)} SAR</div></div></div>
        </div>
        <div className="table-wrapper" style={{ marginTop: 18 }}><table><thead><tr><th>{ar ? "البيان" : "Description"}</th><th style={{ textAlign: "end" }}>{ar ? "المبلغ" : "Amount"}</th></tr></thead><tbody>{allRows.map(([label, value], index) => <tr key={`${label}-${index}`}><td style={{ fontWeight: index === 0 || index === receiptRows.length + 1 || index === allRows.length - 1 ? 800 : 500 }}>{label}</td><td style={{ textAlign: "end", fontWeight: 700 }} dir="ltr">{value}</td></tr>)}</tbody></table></div>
      </section>
    </>
  );
}
