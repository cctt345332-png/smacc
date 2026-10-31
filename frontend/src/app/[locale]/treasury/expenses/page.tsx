"use client";
import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import * as XLSX from "xlsx-js-style";
import { getVouchers, postVoucher, cancelVoucher } from "@/lib/treasury";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const STATUS: Record<string, { ar: string; en: string; badge: string }> = {
  draft: { ar: "مسودة", en: "Draft", badge: "badge-warning" },
  posted: { ar: "مرحّل", en: "Posted", badge: "badge-success" },
  cancelled: { ar: "ملغي", en: "Cancelled", badge: "badge-danger" },
};
const CATS: Record<string, string> = { rent: "إيجار", utilities: "كهرباء وماء", salaries: "رواتب", maintenance: "صيانة", transport: "مواصلات", marketing: "تسويق", office: "مستلزمات مكتبية", insurance: "تأمين", government: "رسوم حكومية", other: "أخرى" };
const dateKey = (value: any) => String(value || "").slice(0, 10);
const displayDate = (value: any, ar: boolean) => new Date(value).toLocaleDateString(ar ? "ar-SA" : "en-GB");

export default function ExpensesPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);
  const { locale } = params;
  const ar = locale === "ar";
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = async () => {
    try { const { data } = await getVouchers({ voucher_type: "expense" }); setItems(data || []); }
    catch { setItems([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      const text = [item.voucher_number, item.description_ar, item.description_en, item.expense_category].filter(Boolean).join(" ").toLowerCase();
      const day = dateKey(item.voucher_date);
      return (!needle || text.includes(needle)) && (!category || item.expense_category === category) && (!status || item.status === status) && (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
    });
  }, [items, search, category, status, dateFrom, dateTo]);

  const handle = async (fn: () => Promise<any>, id: string) => {
    setActing(id);
    try { await fn(); await load(); }
    catch (e: any) { alert(e?.response?.data?.detail || (ar ? "تعذر تنفيذ العملية" : "Operation failed")); }
    finally { setActing(null); }
  };
  const clearFilters = () => { setSearch(""); setCategory(""); setStatus(""); setDateFrom(""); setDateTo(""); };
  const printFiltered = () => window.print();
  const exportExcel = () => {
    const headers = ar
      ? ["رقم السند", "التاريخ", "الفئة", "البيان", "المبلغ قبل الضريبة", "الضريبة", "الإجمالي", "الحالة"]
      : ["Voucher #", "Date", "Category", "Description", "Amount before VAT", "VAT", "Total", "Status"];
    const rows = filteredItems.map((v) => [
      v.voucher_number || "",
      displayDate(v.voucher_date, ar),
      ar ? (CATS[v.expense_category] || v.expense_category || "") : (v.expense_category || ""),
      v.description_ar || v.description_en || "",
      Number(v.amount || 0),
      Number(v.vat_amount || 0),
      Number(v.amount || 0) + Number(v.vat_amount || 0),
      ar ? (STATUS[v.status]?.ar || v.status || "") : (STATUS[v.status]?.en || v.status || ""),
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const totalAmount = filteredItems.reduce((sum, v) => sum + Number(v.amount || 0), 0);
    const totalVat = filteredItems.reduce((sum, v) => sum + Number(v.vat_amount || 0), 0);
    const totalRow = rows.length + 2;
    XLSX.utils.sheet_add_aoa(worksheet, [[ar ? "الإجمالي" : "TOTAL", "", "", "", totalAmount, totalVat, totalAmount + totalVat, ""]], { origin: -1 });
    worksheet["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 35 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];

    const headerStyle = { fill: { fgColor: { rgb: "5A187E" } }, font: { color: { rgb: "FFFFFF" }, bold: true }, alignment: { horizontal: "center", vertical: "center" } };
    const totalStyle = { fill: { fgColor: { rgb: "EDE7F2" } }, font: { color: { rgb: "3E0865" }, bold: true }, border: { top: { style: "thin", color: { rgb: "5A187E" } } } };
    for (let col = 0; col < headers.length; col += 1) {
      const headerCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: col })];
      if (headerCell) headerCell.s = headerStyle;
      const totalCell = worksheet[XLSX.utils.encode_cell({ r: totalRow - 1, c: col })];
      if (totalCell) totalCell.s = totalStyle;
    }
    for (let row = 1; row < totalRow; row += 1) {
      for (const col of [4, 5, 6]) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
        if (cell) cell.s = { numFmt: "#,##0.00", alignment: { horizontal: "right" } };
      }
    }
    for (const col of [4, 5, 6]) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: totalRow - 1, c: col })];
      if (cell) cell.s = { ...totalStyle, numFmt: "#,##0.00", alignment: { horizontal: "right" } };
    }
    worksheet["!rows"] = [{ hpt: 24 }, ...rows.map(() => ({ hpt: 20 })), { hpt: 24 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, ar ? "المصاريف" : "Expenses");
    XLSX.writeFile(workbook, `expenses-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const totalPosted = filteredItems.filter(i => i.status === "posted").reduce((s, i) => s + Number(i.amount || 0) + Number(i.vat_amount || 0), 0);
  const totalAll = filteredItems.reduce((s, i) => s + Number(i.amount || 0) + Number(i.vat_amount || 0), 0);
  const categories = Array.from(new Set(items.map(i => i.expense_category).filter(Boolean)));

  return (
    <>
      <style jsx global>{`.expense-print-only { display: none; } @media print { .expense-no-print { display: none !important; } .expense-print-only { display: block !important; } .expense-print-area .card { border: 1px solid #D5C8DD !important; box-shadow: none !important; } .expense-print-area .card-header { background: #EFE8F3 !important; border-bottom: 1px solid #D5C8DD !important; color: #3E0865 !important; } .expense-print-area table { width: 100% !important; font-size: 10px !important; border-collapse: collapse !important; } .expense-print-area th, .expense-print-area td { padding: 6px 5px !important; border: 1px solid #CDBED6 !important; } .expense-print-area th { background: #F1EBF5 !important; color: #3E0865 !important; font-weight: 800 !important; } .expense-print-area tfoot td { background: #EDE7F2 !important; color: #3E0865 !important; font-weight: 800 !important; border-top: 2px solid #5A187E !important; } body { background: #fff !important; } @page { size: A4 landscape; margin: 10mm; } }`}</style>
      <div className="expense-print-area">
        <div className="expense-print-only" style={{ fontFamily: "'IBM Plex Sans Arabic', Cairo, Arial, sans-serif", color: "#2B1A32", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #3E0865", paddingBottom: 10, marginBottom: 12 }}>
            <div><strong style={{ display: "block", color: "#3E0865", fontSize: 20 }}>مسار | MASAR ERP</strong><span style={{ color: "#75617F", fontSize: 10 }}>{ar ? "نظام المحاسبة وإدارة الأعمال" : "Accounting & business management"}</span></div>
            <div style={{ textAlign: ar ? "left" : "right" }}><strong style={{ display: "block", color: "#3E0865", fontSize: 18 }}>{ar ? "تقرير المصروفات" : "Expense Report"}</strong><span style={{ color: "#75617F", fontSize: 10 }}>{ar ? "تاريخ الطباعة: " : "Printed: "}{new Date().toLocaleDateString(ar ? "ar-SA" : "en-GB")}</span></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: "1px solid #D5C8DD", marginBottom: 12 }}>
            <div style={{ padding: "7px 9px", borderInlineEnd: "1px solid #D5C8DD" }}><span style={{ display: "block", color: "#75617F", fontSize: 9 }}>{ar ? "عدد النتائج" : "Results"}</span><strong>{filteredItems.length}</strong></div>
            <div style={{ padding: "7px 9px", borderInlineEnd: "1px solid #D5C8DD" }}><span style={{ display: "block", color: "#75617F", fontSize: 9 }}>{ar ? "من تاريخ" : "From date"}</span><strong>{dateFrom || (ar ? "الكل" : "All")}</strong></div>
            <div style={{ padding: "7px 9px", borderInlineEnd: "1px solid #D5C8DD" }}><span style={{ display: "block", color: "#75617F", fontSize: 9 }}>{ar ? "إلى تاريخ" : "To date"}</span><strong>{dateTo || (ar ? "الكل" : "All")}</strong></div>
            <div style={{ padding: "7px 9px" }}><span style={{ display: "block", color: "#75617F", fontSize: 9 }}>{ar ? "إجمالي النتائج" : "Filtered total"}</span><strong style={{ color: "#DC2626" }}>{fmt(totalAll)} SAR</strong></div>
          </div>
        </div>
        <div className="page-header expense-no-print">
          <div><div className="breadcrumb"><Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "المصروفات" : "Expenses"}</span></div><h1 className="page-title">{ar ? "المصروفات" : "Expenses"}</h1><p className="page-subtitle">{ar ? "تسجيل المصروفات التشغيلية ومراجعة تقاريرها" : "Record and review operational expenses"}</p></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn btn-secondary btn-sm" onClick={printFiltered}><Icon name="print" size={14} /> {ar ? "طباعة" : "Print"}</button><button className="btn btn-secondary btn-sm" onClick={exportExcel} disabled={!filteredItems.length}><Icon name="download" size={14} /> {ar ? "تصدير Excel" : "Export Excel"}</button><Link href={`/${locale}/treasury/expenses/batch`} className="btn btn-secondary btn-sm">{ar ? "مصروفات متعددة — قيد واحد" : "Batch Expenses — One Journal"}</Link><Link href={`/${locale}/treasury/expenses/new`} className="btn btn-primary btn-sm"><Icon name="plus" size={14} /> {ar ? "مصروف جديد" : "New Expense"}</Link></div>
        </div>

        <div className="grid-3 expense-no-print" style={{ marginBottom: 20 }}>{[
          { label: ar ? "إجمالي المصروفات المفلترة" : "Filtered Expenses", value: `${fmt(totalAll)} SAR`, color: "#DC2626" },
          { label: ar ? "عدد النتائج" : "Filtered Count", value: filteredItems.length, color: "#5A187E" },
          { label: ar ? "المصروفات المرحلة" : "Posted Expenses", value: `${fmt(totalPosted)} SAR`, color: "#047857" },
        ].map(s => <div key={s.label} className="stat-card"><div className="stat-icon" style={{ background: s.color + "18", color: s.color }}><Icon name="trendingDown" size={20} /></div><div className="stat-content"><div className="stat-label">{s.label}</div><div className="stat-value" style={{ color: s.color, fontSize: 18 }}>{s.value}</div></div></div>)}</div>

        <div className="card expense-no-print" style={{ marginBottom: 16 }}><div className="card-body" style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.5fr) repeat(4, minmax(130px, 1fr)) auto", gap: 10, alignItems: "end" }}>
          <label className="form-label" style={{ margin: 0 }}>{ar ? "بحث" : "Search"}<input className="form-input" style={{ marginTop: 5 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={ar ? "رقم السند أو البيان" : "Voucher or description"} /></label>
          <label className="form-label" style={{ margin: 0 }}>{ar ? "الفئة" : "Category"}<select className="form-input" style={{ marginTop: 5 }} value={category} onChange={e => setCategory(e.target.value)}><option value="">{ar ? "كل الفئات" : "All categories"}</option>{categories.map(c => <option key={c} value={c}>{ar ? CATS[c] || c : c}</option>)}</select></label>
          <label className="form-label" style={{ margin: 0 }}>{ar ? "الحالة" : "Status"}<select className="form-input" style={{ marginTop: 5 }} value={status} onChange={e => setStatus(e.target.value)}><option value="">{ar ? "كل الحالات" : "All statuses"}</option>{Object.entries(STATUS).map(([key, value]) => <option key={key} value={key}>{ar ? value.ar : value.en}</option>)}</select></label>
          <label className="form-label" style={{ margin: 0 }}>{ar ? "من تاريخ" : "From date"}<input type="date" className="form-input" style={{ marginTop: 5 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label>
          <label className="form-label" style={{ margin: 0 }}>{ar ? "إلى تاريخ" : "To date"}<input type="date" className="form-input" style={{ marginTop: 5 }} value={dateTo} onChange={e => setDateTo(e.target.value)} /></label>
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>{ar ? "مسح" : "Clear"}</button>
        </div></div>

        <div className="card"><div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div className="card-title">{ar ? "سجل المصاريف" : "Expenses register"}</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>{ar ? `عدد النتائج: ${filteredItems.length}` : `${filteredItems.length} results`}</div></div><div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div> : filteredItems.length === 0 ? <div className="empty-state"><div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}><Icon name="receipt" size={24} /></div><div className="empty-state-title">{items.length ? (ar ? "لا توجد نتائج مطابقة للفلاتر" : "No matching results") : (ar ? "لا توجد مصروفات" : "No expenses")}</div></div> : <table>
            <thead><tr><th>{ar ? "رقم السند" : "Voucher #"}</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "الفئة" : "Category"}</th><th>{ar ? "البيان" : "Description"}</th><th style={{ textAlign: "end" }}>{ar ? "المبلغ" : "Amount"}</th><th style={{ textAlign: "end" }}>{ar ? "الضريبة" : "VAT"}</th><th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th><th>{ar ? "الحالة" : "Status"}</th><th className="expense-no-print">{ar ? "الإجراءات" : "Actions"}</th></tr></thead>
            <tbody>{filteredItems.map(v => { const s = STATUS[v.status] || { ar: v.status, en: v.status, badge: "badge-gray" }; return <tr key={v.id}><td><Link href={`/${locale}/treasury/expenses/${v.id}`} style={{ fontWeight: 700, color: "#DC2626", textDecoration: "none" }}>{v.voucher_number}</Link></td><td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{displayDate(v.voucher_date, ar)}</td><td style={{ fontSize: 12 }}>{v.expense_category ? (ar ? CATS[v.expense_category] || v.expense_category : v.expense_category) : "—"}</td><td style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{v.description_ar || v.description_en || "—"}</td><td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(v.amount)}</td><td style={{ textAlign: "end", color: "#D97706" }}>{Number(v.vat_amount) > 0 ? fmt(v.vat_amount) : "—"}</td><td style={{ textAlign: "end", fontWeight: 700, color: "#DC2626" }}>{fmt(Number(v.amount || 0) + Number(v.vat_amount || 0))}</td><td><span className={`badge ${s.badge}`}>{ar ? s.ar : s.en}</span></td><td className="expense-no-print"><div style={{ display: "flex", gap: 4 }}><Link href={`/${locale}/treasury/expenses/${v.id}`} className="btn btn-ghost btn-sm btn-icon"><Icon name="view" size={14} /></Link>{v.status === "draft" && <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "#6F4A84" }} onClick={() => handle(() => postVoucher(v.id), v.id)} disabled={acting === v.id}><Icon name="check" size={14} /></button>}{v.status === "draft" && <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "var(--danger)" }} onClick={() => handle(() => cancelVoucher(v.id), v.id)} disabled={acting === v.id}><Icon name="cancel" size={14} /></button>}</div></td></tr>; })}</tbody>
            <tfoot><tr><td colSpan={4}>{ar ? "الإجمالي" : "TOTAL"}</td><td style={{ textAlign: "end" }}>{fmt(filteredItems.reduce((sum, v) => sum + Number(v.amount || 0), 0))}</td><td style={{ textAlign: "end" }}>{fmt(filteredItems.reduce((sum, v) => sum + Number(v.vat_amount || 0), 0))}</td><td style={{ textAlign: "end" }}>{fmt(totalAll)}</td><td colSpan={2}></td></tr></tfoot>
          </table>}
        </div></div>
      </div>
    </>
  );
}
