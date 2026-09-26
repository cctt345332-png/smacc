"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getInvoice, getCustomers, updateInvoice } from "@/lib/sales";
import { Icon } from "@/components/ui/Icons";
import SearchableSelect from "@/components/ui/SearchableSelect";

const today = () => new Date().toISOString().split("T")[0];

type Line = { description_ar: string; quantity: string; unit_price: string; discount_pct: string; vat_rate: string; inventory_item_id?: string | null; serial_item_id?: string | null; serial_ids?: string[] | null; serial_text?: string; variant_id?: string | null };
const emptyLine = (): Line => ({ description_ar: "", quantity: "1", unit_price: "0", discount_pct: "0", vat_rate: "15", serial_ids: null });

export default function EditSalesInvoicePage(props: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = use(props.params);
  const ar = locale === "ar";
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [form, setForm] = useState({ issue_date: today(), supply_date: today(), due_date: "", notes: "", terms: "", invoice_type: "standard", invoice_payment_method: "cash", credit_days: "30" });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getInvoice(id), getCustomers()]).then(([inv, cust]) => {
      const x = inv.data; setInvoice(x); setCustomers(cust.data || []); setCustomerId(x.customer_id);
      setForm({ issue_date: x.issue_date?.slice(0,10) || today(), supply_date: x.supply_date?.slice(0,10) || today(), due_date: x.due_date?.slice(0,10) || "", notes: x.notes || "", terms: x.terms || "", invoice_type: x.invoice_type || "standard", invoice_payment_method: x.invoice_payment_method || "cash", credit_days: String(x.credit_days || 30) });
      setLines((x.lines || []).map((l: any) => { const ids = l.serial_ids_json ? JSON.parse(l.serial_ids_json) : (l.serial_item_id ? [l.serial_item_id] : null); const labels = (l.serial_details || []).map((s: any) => s.serial_number || s.id); return { description_ar: l.description_ar || "", quantity: String(l.quantity || 1), unit_price: String(l.unit_price || 0), discount_pct: String(l.discount_pct || 0), vat_rate: String(l.vat_rate ?? 15), inventory_item_id: l.inventory_item_id, serial_item_id: l.serial_item_id, serial_ids: ids, serial_text: labels.length ? labels.join(", ") : (ids || []).join(", "), variant_id: l.variant_id }; }));
    }).catch(e => alert(e?.response?.data?.detail || "Error")).finally(() => setLoading(false));
  }, [id]);

  const setLine = (i: number, key: keyof Line, value: string) => setLines(prev => prev.map((l, n) => n === i ? { ...l, [key]: value } : l));
  const save = async () => {
    if (!customerId || lines.some(l => !l.description_ar || Number(l.quantity) <= 0 || Number(l.unit_price) < 0)) return alert(ar ? "راجع العميل والأسطر والأسعار" : "Check customer, lines, and prices");
    setSaving(true);
    try {
      await updateInvoice(id, { customer_id: customerId, ...form, issue_date: `${form.issue_date}T00:00:00`, supply_date: `${form.supply_date}T00:00:00`, due_date: form.due_date ? `${form.due_date}T00:00:00` : null, lines: lines.map((l, i) => ({ ...l, serial_text: undefined, line_order: i, quantity: Number(l.quantity), unit_price: Number(l.unit_price), discount_pct: Number(l.discount_pct), vat_rate: Number(l.vat_rate), serial_ids: l.serial_ids || null })) });
      router.push(`/${locale}/sales/invoices/${id}`);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); } finally { setSaving(false); }
  };
  if (loading) return <div className="empty-state">{ar ? "جاري التحميل..." : "Loading..."}</div>;
  if (!invoice) return <div className="empty-state">{ar ? "الفاتورة غير موجودة" : "Invoice not found"}</div>;
  return <>
    <div className="page-header"><div><div className="breadcrumb"><Link href={`/${locale}/sales/invoices`}>{ar ? "الفواتير" : "Invoices"}</Link><span className="breadcrumb-sep">/</span><span>{invoice.invoice_number}</span></div><h1 className="page-title">{ar ? `تعديل ${invoice.invoice_number}` : `Edit ${invoice.invoice_number}`}</h1><p className="page-subtitle">{ar ? "للفواتير المؤكدة غير المسددة: يعكس النظام الأثر القديم ويطبق الجديد دون تكرار البيع" : "Confirmed unpaid invoices are reversed and reposted without duplicate sales"}</p></div><div style={{ display: "flex", gap: 8 }}><Link className="btn btn-secondary" href={`/${locale}/sales/invoices/${id}`}>{ar ? "إلغاء" : "Cancel"}</Link><button className="btn btn-primary" onClick={save} disabled={saving}><Icon name="check" size={15} />{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التعديل" : "Save changes")}</button></div></div>
    <div className="card"><div className="card-header"><span className="card-title">{ar ? "بيانات الفاتورة" : "Invoice details"}</span></div><div className="card-body"><div className="grid-2"><div className="form-group"><label className="form-label">{ar ? "العميل" : "Customer"}</label><SearchableSelect locale={locale} value={customerId} onChange={setCustomerId} options={customers.map(c => ({ value: c.id, label: `${c.customer_number || ""} — ${c.name_ar}`, searchText: `${c.customer_number || ""} ${c.name_ar || ""}` }))} placeholder={ar ? "ابحث عن العميل..." : "Search customer..."} /></div><div className="form-group"><label className="form-label">{ar ? "نوع الفاتورة" : "Invoice type"}</label><select className="form-input form-select" value={form.invoice_type} onChange={e => setForm(f => ({ ...f, invoice_type: e.target.value }))}><option value="standard">{ar ? "ضريبية كاملة" : "Standard"}</option><option value="simplified">{ar ? "مبسطة" : "Simplified"}</option></select></div></div><div className="grid-3"><div className="form-group"><label className="form-label">{ar ? "تاريخ الإصدار" : "Issue date"}</label><input className="form-input" type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} /></div><div className="form-group"><label className="form-label">{ar ? "تاريخ التوريد" : "Supply date"}</label><input className="form-input" type="date" value={form.supply_date} onChange={e => setForm(f => ({ ...f, supply_date: e.target.value }))} /></div><div className="form-group"><label className="form-label">{ar ? "تاريخ الاستحقاق" : "Due date"}</label><input className="form-input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div></div><div className="form-group"><label className="form-label">{ar ? "ملاحظات" : "Notes"}</label><textarea className="form-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div></div></div>
    <div className="card" style={{ marginTop: 16 }}><div className="card-header"><span className="card-title">{ar ? "أسطر الفاتورة" : "Invoice lines"}</span><button className="btn btn-secondary btn-sm" onClick={() => setLines(x => [...x, emptyLine()])}>+ {ar ? "إضافة سطر" : "Add line"}</button></div><div className="table-wrapper"><table><thead><tr><th>{ar ? "الصنف / الوصف" : "Item / description"}</th><th>{ar ? "الكمية" : "Qty"}</th><th>{ar ? "سعر الوحدة" : "Unit price"}</th><th>{ar ? "الخصم %" : "Discount %"}</th><th>{ar ? "الضريبة %" : "VAT %"}</th><th>{ar ? "السيريالات الحقيقية" : "Serial numbers"}</th><th></th></tr></thead><tbody>{lines.map((l, i) => <tr key={i}><td><input className="form-input" value={l.description_ar} onChange={e => setLine(i, "description_ar", e.target.value)} /></td><td><input className="form-input" type="number" min="1" value={l.quantity} onChange={e => setLine(i, "quantity", e.target.value)} /></td><td><input className="form-input" type="number" min="0" step="0.01" value={l.unit_price} onChange={e => setLine(i, "unit_price", e.target.value)} /></td><td><input className="form-input" type="number" min="0" value={l.discount_pct} onChange={e => setLine(i, "discount_pct", e.target.value)} /></td><td><input className="form-input" type="number" min="0" value={l.vat_rate} onChange={e => setLine(i, "vat_rate", e.target.value)} /></td><td><input className="form-input" placeholder={ar ? "رقم السيريال، رقم السيريال" : "serial number, serial number"} value={l.serial_text || ""} onChange={e => { const text = e.target.value; setLines(prev => prev.map((row, n) => n === i ? { ...row, serial_text: text, serial_ids: text.split(",").map(x => x.trim()).filter(Boolean) } : row)); }} /></td><td><button className="btn btn-ghost btn-sm" onClick={() => setLines(x => x.filter((_, n) => n !== i))} disabled={lines.length === 1}>×</button></td></tr>)}</tbody></table></div></div>
  </>;
}
