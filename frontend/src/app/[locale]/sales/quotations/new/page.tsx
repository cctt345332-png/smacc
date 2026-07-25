"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCustomers, createQuotation } from "@/lib/sales";
import { Icon } from "@/components/ui/Icons";
import ItemPicker, { PickedItem } from "@/components/inventory/ItemPicker";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const today = () => new Date().toISOString().split("T")[0];

interface Line { picked: PickedItem; discount_pct: string; vat_rate: string; }
const emptyLine = (): Line => ({
  picked: { mode: "free", description_ar: "", unit_price: 0, quantity: 1 },
  discount_pct: "0", vat_rate: "15",
});

function calcLine(l: Line) {
  const qty = l.picked.quantity || 0;
  const price = l.picked.unit_price || 0;
  const disc = parseFloat(l.discount_pct) || 0;
  const vat = parseFloat(l.vat_rate) || 0;
  const gross = qty * price;
  const discAmt = gross * disc / 100;
  const taxable = gross - discAmt;
  const vatAmt = taxable * vat / 100;
  return { gross, discAmt, taxable, vatAmt, total: taxable + vatAmt };
}

export default function NewQuotationPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_id: "", issue_date: today(), expiry_date: "", subject: "", notes: "", terms: "" });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  useEffect(() => { getCustomers().then(({ data }) => setCustomers(data)); }, []);

  const setPicked = (i: number, picked: PickedItem) => setLines(p => p.map((l, idx) => idx === i ? { ...l, picked } : l));
  const setField = (i: number, k: "discount_pct" | "vat_rate", v: string) => setLines(p => p.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const addLine = () => setLines(p => [...p, emptyLine()]);
  const removeLine = (i: number) => { if (lines.length > 1) setLines(p => p.filter((_, idx) => idx !== i)); };

  const totals = lines.reduce((acc, l) => {
    const c = calcLine(l);
    return { subtotal: acc.subtotal + c.gross, vat: acc.vat + c.vatAmt, total: acc.total + c.total };
  }, { subtotal: 0, vat: 0, total: 0 });

  const handleSave = async () => {
    if (!form.customer_id) return alert(ar ? "اختر العميل" : "Select customer");
    if (lines.some(l => !l.picked.description_ar)) return alert(ar ? "أدخل وصف لكل الأسطر" : "Enter description for all lines");
    setSaving(true);
    try {
      await createQuotation({
        ...form,
        expiry_date: form.expiry_date ? new Date(form.expiry_date).toISOString() : null,
        issue_date: new Date(form.issue_date).toISOString(),
        lines: lines.map((l, i) => ({
          description_ar: l.picked.description_ar,
          line_order: i,
          quantity: l.picked.quantity || 1,
          unit_price: l.picked.unit_price || 0,
          discount_pct: parseFloat(l.discount_pct) || 0,
          vat_rate: parseFloat(l.vat_rate) || 15,
        })),
      });
      router.push(`/${locale}/sales/quotations`);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/sales/quotations`}>{ar ? "عروض الأسعار" : "Quotations"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "عرض سعر جديد" : "New Quotation"}</span>
          </div>
          <h1 className="page-title">{ar ? "عرض سعر جديد" : "New Quotation"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/sales/quotations`} className="btn btn-secondary btn-sm">{ar ? "إلغاء" : "Cancel"}</Link>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "بيانات العرض" : "Quotation Details"}</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">{ar ? "العميل" : "Customer"} <span className="required">*</span></label>
              <select className="form-input form-select" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "الموضوع" : "Subject"}</label>
              <input className="form-input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder={ar ? "موضوع العرض..." : "Quotation subject..."} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ الإصدار" : "Issue Date"}</label>
                <input type="date" className="form-input" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ الانتهاء" : "Expiry Date"}</label>
                <input type="date" className="form-input" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "ملاحظات وشروط" : "Notes & Terms"}</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
              <textarea className="form-input" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{ar ? "الشروط والأحكام" : "Terms"}</label>
              <textarea className="form-input" rows={3} value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "أسطر العرض" : "Quotation Lines"}</span>
          <button className="btn btn-secondary btn-sm" onClick={addLine}><Icon name="plus" size={14} /> {ar ? "إضافة سطر" : "Add Line"}</button>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>{ar ? "الصنف / الوصف" : "Item / Description"} <span style={{ color: "var(--danger)" }}>*</span></th>
                <th style={{ width: 80 }}>{ar ? "الكمية" : "Qty"}</th>
                <th style={{ width: 110 }}>{ar ? "سعر الوحدة" : "Unit Price"}</th>
                <th style={{ width: 90 }}>{ar ? "الخصم%" : "Disc%"}</th>
                <th style={{ width: 90 }}>{ar ? "الضريبة%" : "VAT%"}</th>
                <th style={{ width: 110, textAlign: "end" }}>{ar ? "قبل الضريبة" : "Taxable"}</th>
                <th style={{ width: 100, textAlign: "end" }}>{ar ? "الضريبة" : "VAT"}</th>
                <th style={{ width: 110, textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const c = calcLine(line);
                return (
                  <tr key={i}>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <ItemPicker locale={locale} value={line.picked} onChange={p => setPicked(i, p)} purchaseMode={false} />
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input type="number" className="form-input" style={{ width: 70 }} value={line.picked.quantity} min="0"
                        disabled={line.picked.mode === "serial"}
                        onChange={e => setPicked(i, { ...line.picked, quantity: parseFloat(e.target.value) || 1 })} />
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input type="number" className="form-input" style={{ width: 100 }} value={line.picked.unit_price} min="0"
                        onChange={e => setPicked(i, { ...line.picked, unit_price: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input type="number" className="form-input" style={{ width: 70 }} value={line.discount_pct} min="0" max="100" onChange={e => setField(i, "discount_pct", e.target.value)} />
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input type="number" className="form-input" style={{ width: 70 }} value={line.vat_rate} min="0" max="100" onChange={e => setField(i, "vat_rate", e.target.value)} />
                    </td>
                    <td style={{ textAlign: "end", fontWeight: 500, verticalAlign: "top", paddingTop: 12 }}>{fmt(c.taxable)}</td>
                    <td style={{ textAlign: "end", color: "var(--warning)", fontWeight: 500, verticalAlign: "top", paddingTop: 12 }}>{fmt(c.vatAmt)}</td>
                    <td style={{ textAlign: "end", fontWeight: 700, verticalAlign: "top", paddingTop: 12 }}>{fmt(c.total)}</td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      {lines.length > 1 && <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => removeLine(i)}><Icon name="trash" size={14} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{ar ? "المجموع" : "Subtotal"}</span>
              <span>{fmt(totals.subtotal)} SAR</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--warning)" }}>
              <span>{ar ? "ضريبة القيمة المضافة 15%" : "VAT 15%"}</span>
              <span>{fmt(totals.vat)} SAR</span>
            </div>
            <div style={{ height: 1, background: "var(--border)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}>
              <span>{ar ? "الإجمالي" : "TOTAL"}</span>
              <span style={{ color: "var(--primary)" }}>{fmt(totals.total)} SAR</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
