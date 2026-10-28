"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { getInvoices, getInvoice, createSalesDebitNote } from "@/lib/sales";
import SearchableSelect from "@/components/ui/SearchableSelect";

const today = () => new Date().toISOString().split("T")[0];
const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function NewSalesDebitNotePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoice, setInvoice] = useState<any>(null);
  const [invoiceId, setInvoiceId] = useState("");
  const [issueDate, setIssueDate] = useState(today());
  const [reason, setReason] = useState("إضافة كمية أو مبلغ لم يسجل في الفاتورة الأصلية");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { getInvoices({ status: "confirmed" }).then(({ data }) => setInvoices((data || []).filter((x: any) => x.invoice_type !== "simplified"))).catch(() => {}); }, []);

  const chooseInvoice = async (id: string) => {
    setInvoiceId(id); setInvoice(null); setQuantities({});
    if (!id) return;
    try { const { data } = await getInvoice(id); setInvoice(data); setQuantities(Object.fromEntries((data.lines || []).map((line: any) => [line.id, 0]))); }
    catch { alert(ar ? "تعذر تحميل الفاتورة" : "Could not load invoice"); }
  };

  const totals = (invoice?.lines || []).reduce((a: any, line: any) => {
    const qty = Number(quantities[line.id] || 0); const taxable = qty * Number(line.unit_price || 0); const vat = taxable * Number(line.vat_rate || 0) / 100;
    return { taxable: a.taxable + taxable, vat: a.vat + vat, total: a.total + taxable + vat };
  }, { taxable: 0, vat: 0, total: 0 });

  const save = async () => {
    if (!invoiceId) return alert(ar ? "اختر الفاتورة الأصلية" : "Select the original invoice");
    if (!reason.trim()) return alert(ar ? "أدخل سبب الإشعار" : "Enter the reason");
    const lines = (invoice.lines || []).filter((line: any) => Number(quantities[line.id] || 0) > 0).map((line: any, index: number) => ({
      original_invoice_line_id: line.id, description_ar: line.description_ar, quantity: Number(quantities[line.id]), unit_price: Number(line.unit_price), discount_pct: Number(line.discount_pct || 0), vat_rate: Number(line.vat_rate || 15), inventory_item_id: line.inventory_item_id || null, serial_item_id: line.serial_item_id || null, line_order: index,
    }));
    if (!lines.length) return alert(ar ? "أدخل كمية أكبر من صفر لسطر واحد على الأقل" : "Enter a quantity greater than zero for at least one line");
    setLoading(true);
    try { const { data } = await createSalesDebitNote({ original_invoice_id: invoiceId, note_type: "debit", issue_date: new Date(issueDate).toISOString(), reason: reason.trim(), lines }); router.push(`/${locale}/sales/debit-notes/${data.id}`); }
    catch (e: any) { alert(e?.response?.data?.detail || (ar ? "تعذر حفظ إشعار المدين" : "Could not save debit note")); }
    finally { setLoading(false); }
  };

  return <>
    <div className="page-header"><div><div className="breadcrumb"><Link href={`/${locale}/sales/debit-notes`}>{ar ? "إشعارات مدينة المبيعات" : "Sales Debit Notes"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "جديد" : "New"}</span></div><h1 className="page-title">{ar ? "إنشاء إشعار مدين للمبيعات" : "Create Sales Debit Note"}</h1><p className="page-subtitle">{ar ? "هذا المستند يزيد قيمة مستحقات العميل ويرتبط بفاتورة مبيعات أصلية." : "This document increases the customer's balance and links to an original sales invoice."}</p></div><div style={{ display: "flex", gap: 8 }}><Link href={`/${locale}/sales/debit-notes`} className="btn btn-secondary btn-sm">{ar ? "إلغاء" : "Cancel"}</Link><button className="btn btn-primary btn-sm" onClick={save} disabled={loading}>{loading ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ الإشعار" : "Save note")}</button></div></div>
    <div className="card" style={{ marginBottom: 20 }}><div className="card-header"><span className="card-title">{ar ? "بيانات الإشعار" : "Debit note details"}</span></div><div className="card-body"><div className="grid-3"><div className="form-group"><label className="form-label">{ar ? "الفاتورة الضريبية الكاملة الأصلية" : "Original standard tax invoice"} <span className="required">*</span></label><SearchableSelect locale={locale} value={invoiceId} onChange={chooseInvoice} placeholder={ar ? "اختر فاتورة كاملة..." : "Choose a standard invoice..."} options={invoices.map(inv => ({ value: inv.id, label: `${inv.invoice_number} — ${inv.buyer_name_ar} (${fmt(inv.total)} SAR)`, searchText: `${inv.invoice_number} ${inv.buyer_name_ar || ""}` }))} /><div className="form-hint">{ar ? "تم إخفاء الفواتير المبسطة من هذا الاختبار." : "Simplified invoices are hidden from this standard-note test."}</div></div><div className="form-group"><label className="form-label">{ar ? "تاريخ الإشعار" : "Issue date"}</label><input type="date" className="form-input" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></div><div className="form-group"><label className="form-label">{ar ? "سبب الإشعار" : "Reason"} <span className="required">*</span></label><input className="form-input" value={reason} onChange={e => setReason(e.target.value)} /></div></div></div></div>
    {invoice && <div className="card"><div className="card-header"><span className="card-title">{ar ? "أسطر الإشعار — أدخل الكمية الإضافية" : "Note lines — enter additional quantity"}</span></div><div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}><table><thead><tr><th>{ar ? "الصنف" : "Item"}</th><th>{ar ? "كمية الفاتورة" : "Original qty"}</th><th>{ar ? "الكمية الإضافية" : "Additional qty"}</th><th>{ar ? "سعر الوحدة" : "Unit price"}</th><th>{ar ? "الضريبة" : "VAT"}</th><th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th></tr></thead><tbody>{(invoice.lines || []).map((line: any) => { const qty = Number(quantities[line.id] || 0); const total = qty * Number(line.unit_price || 0) * (1 + Number(line.vat_rate || 0) / 100); return <tr key={line.id}><td>{line.description_ar}</td><td>{line.quantity}</td><td><input type="number" className="form-input" style={{ width: 100 }} min="0" value={qty} onChange={e => setQuantities(q => ({ ...q, [line.id]: Number(e.target.value) || 0 }))} /></td><td>{fmt(line.unit_price)} SAR</td><td>{line.vat_rate}%</td><td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(total)} SAR</td></tr>; })}</tbody></table></div><div style={{ padding: 16, textAlign: "end", fontWeight: 700 }}>{ar ? "الإجمالي قبل الضريبة" : "Taxable"}: {fmt(totals.taxable)} SAR — {ar ? "الضريبة" : "VAT"}: {fmt(totals.vat)} SAR — {ar ? "الإجمالي" : "Total"}: {fmt(totals.total)} SAR</div></div>}
  </>;
}
