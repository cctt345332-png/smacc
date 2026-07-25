"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCustomers } from "@/lib/sales";
import { createOrder } from "@/lib/orders";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const today = () => new Date().toISOString().split("T")[0];

interface Line { description_ar: string; quantity: string; unit_price: string; discount_pct: string; vat_rate: string; unit: string; }
const emptyLine = (): Line => ({ description_ar: "", quantity: "1", unit_price: "0", discount_pct: "0", vat_rate: "15", unit: "" });

function calcLine(l: Line) {
  const qty = parseFloat(l.quantity) || 0;
  const price = parseFloat(l.unit_price) || 0;
  const disc = parseFloat(l.discount_pct) || 0;
  const vat = parseFloat(l.vat_rate) || 0;
  const gross = qty * price;
  const discAmt = gross * disc / 100;
  const taxable = gross - discAmt;
  const vatAmt = taxable * vat / 100;
  return { taxable, vatAmt, total: taxable + vatAmt };
}

export default function NewOrderPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_id: "", order_date: today(), delivery_date: "", notes: "", delivery_address: "" });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  useEffect(() => { getCustomers().then(({ data }) => setCustomers(data)); }, []);

  const setLine = (i: number, k: keyof Line, v: string) => setLines(p => p.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const addLine = () => setLines(p => [...p, emptyLine()]);
  const removeLine = (i: number) => { if (lines.length > 1) setLines(p => p.filter((_, idx) => idx !== i)); };

  const totals = lines.reduce((acc, l) => { const c = calcLine(l); return { vat: acc.vat + c.vatAmt, total: acc.total + c.total }; }, { vat: 0, total: 0 });

  const handleSave = async () => {
    if (!form.customer_id) return alert(ar ? "اختر العميل" : "Select customer");
    if (lines.some(l => !l.description_ar)) return alert(ar ? "أدخل وصف لكل الأسطر" : "Enter description for all lines");
    setSaving(true);
    try {
      await createOrder({
        ...form,
        order_date: new Date(form.order_date).toISOString(),
        delivery_date: form.delivery_date ? new Date(form.delivery_date).toISOString() : null,
        lines: lines.map((l, i) => ({ ...l, line_order: i, quantity: parseFloat(l.quantity) || 1, unit_price: parseFloat(l.unit_price) || 0, discount_pct: parseFloat(l.discount_pct) || 0, vat_rate: parseFloat(l.vat_rate) || 15 })),
      });
      router.push(`/${locale}/sales/orders`);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/sales/orders`}>{ar ? "أوامر البيع" : "Sales Orders"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "أمر بيع جديد" : "New Order"}</span>
          </div>
          <h1 className="page-title">{ar ? "أمر بيع جديد" : "New Sales Order"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/sales/orders`} className="btn btn-secondary btn-sm">{ar ? "إلغاء" : "Cancel"}</Link>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "بيانات الأمر" : "Order Details"}</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">{ar ? "العميل" : "Customer"} <span className="required">*</span></label>
              <select className="form-input form-select" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ الأمر" : "Order Date"}</label>
                <input type="date" className="form-input" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ التسليم" : "Delivery Date"}</label>
                <input type="date" className="form-input" value={form.delivery_date} onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "عنوان التسليم" : "Delivery Address"}</label>
              <textarea className="form-input" rows={2} value={form.delivery_address} onChange={e => setForm(f => ({ ...f, delivery_address: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "ملخص الأمر" : "Order Summary"}</span></div>
          <div className="card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-secondary)" }}>{ar ? "عدد الأسطر" : "Lines"}</span>
                <span style={{ fontWeight: 600 }}>{lines.length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#D97706" }}>
                <span>{ar ? "ضريبة القيمة المضافة 15%" : "VAT 15%"}</span>
                <span style={{ fontWeight: 600 }}>{fmt(totals.vat)} SAR</span>
              </div>
              <div style={{ height: 1, background: "var(--border)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800 }}>
                <span>{ar ? "الإجمالي" : "Total"}</span>
                <span style={{ color: "var(--primary)" }}>{fmt(totals.total)} SAR</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "أسطر الأمر" : "Order Lines"}</span>
          <button className="btn btn-secondary btn-sm" onClick={addLine}><Icon name="plus" size={14} /> {ar ? "إضافة سطر" : "Add Line"}</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {[ar ? "الوصف *" : "Description *", ar ? "الوحدة" : "Unit", ar ? "الكمية" : "Qty", ar ? "سعر الوحدة" : "Price", ar ? "الخصم%" : "Disc%", ar ? "الضريبة%" : "VAT%", ar ? "الإجمالي" : "Total", ""].map((h, i) => (
                  <th key={i} style={{ padding: "10px 12px", textAlign: i >= 6 ? "end" : "start", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const c = calcLine(line);
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 12px", minWidth: 200 }}>
                      <input className="form-input" style={{ fontSize: 12 }} value={line.description_ar} onChange={e => setLine(i, "description_ar", e.target.value)} placeholder={ar ? "وصف المنتج أو الخدمة" : "Product/service description"} dir="rtl" />
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <input className="form-input" style={{ width: 70, fontSize: 12 }} value={line.unit} onChange={e => setLine(i, "unit", e.target.value)} placeholder={ar ? "قطعة" : "pcs"} />
                    </td>
                    {(["quantity", "unit_price", "discount_pct", "vat_rate"] as (keyof Line)[]).map(k => (
                      <td key={k} style={{ padding: "8px 6px" }}>
                        <input type="number" className="form-input" style={{ width: 80, fontSize: 12 }} value={line[k]} onChange={e => setLine(i, k, e.target.value)} min="0" />
                      </td>
                    ))}
                    <td style={{ padding: "8px 12px", textAlign: "end", fontWeight: 700 }}>{fmt(c.total)}</td>
                    <td style={{ padding: "8px 6px" }}>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeLine(i)} style={{ color: "var(--danger)" }}><Icon name="trash" size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
