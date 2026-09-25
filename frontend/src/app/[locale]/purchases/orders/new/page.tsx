"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getVendors, createPurchaseOrder } from "@/lib/purchases";
import { Icon } from "@/components/ui/Icons";
import ItemPicker, { PickedItem } from "@/components/inventory/ItemPicker";
import SearchableSelect from "@/components/ui/SearchableSelect";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const today = () => new Date().toISOString().split("T")[0];

interface Line { picked: PickedItem; unit: string; discount_pct: string; vat_rate: string; }
const emptyLine = (): Line => ({
  picked: { mode: "free", description_ar: "", unit_price: 0, quantity: 1 },
  unit: "", discount_pct: "0", vat_rate: "15",
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
  return { taxable, vatAmt, total: taxable + vatAmt };
}

export default function NewPurchaseOrderPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const router = useRouter();
  const [vendors, setVendors] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ vendor_id: "", order_date: today(), expected_date: "", delivery_address: "", notes: "" });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  useEffect(() => { getVendors().then(({ data }) => setVendors(data)).catch(() => {}); }, []);

  const setPicked = (i: number, picked: PickedItem) => setLines(p => p.map((l, idx) => idx === i ? { ...l, picked } : l));
  const setField = (i: number, k: "unit" | "discount_pct" | "vat_rate", v: string) => setLines(p => p.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const addLine = () => setLines(p => [...p, emptyLine()]);
  const removeLine = (i: number) => { if (lines.length > 1) setLines(p => p.filter((_, idx) => idx !== i)); };

  const totals = lines.reduce((acc, l) => {
    const c = calcLine(l);
    return { subtotal: acc.subtotal + c.taxable, vat: acc.vat + c.vatAmt, total: acc.total + c.total };
  }, { subtotal: 0, vat: 0, total: 0 });

  const handleSave = async (confirm_order = false) => {
    if (!form.vendor_id) return alert(ar ? "اختر المورد" : "Select vendor");
    if (lines.some(l => !l.picked.description_ar)) return alert(ar ? "أدخل وصف لكل الأسطر" : "Enter description for all lines");
    setSaving(true);
    try {
      const { data } = await createPurchaseOrder({
        ...form,
        order_date: new Date(form.order_date).toISOString(),
        expected_date: form.expected_date ? new Date(form.expected_date).toISOString() : null,
        delivery_address: form.delivery_address || null,
        notes: form.notes || null,
        lines: lines.map((l, i) => ({
          description_ar: l.picked.description_ar,
          unit: l.unit || null,
          line_order: i,
          quantity: l.picked.quantity || 1,
          unit_price: l.picked.unit_price || 0,
          discount_pct: parseFloat(l.discount_pct) || 0,
          vat_rate: parseFloat(l.vat_rate) || 15,
          inventory_item_id: l.picked.inventory_item_id || null,
        })),
      });
      if (confirm_order) {
        const { confirmPurchaseOrder } = await import("@/lib/purchases");
        await confirmPurchaseOrder(data.id);
        router.push(`/${locale}/purchases/orders/${data.id}`);
      } else {
        router.push(`/${locale}/purchases/orders`);
      }
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/purchases/orders`}>{ar ? "أوامر الشراء" : "Purchase Orders"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "أمر شراء جديد" : "New Order"}</span>
          </div>
          <h1 className="page-title">{ar ? "أمر شراء جديد" : "New Purchase Order"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/purchases/orders`} className="btn btn-secondary">{ar ? "إلغاء" : "Cancel"}</Link>
          <button className="btn btn-secondary" onClick={() => handleSave(false)} disabled={saving}>
            <Icon name="draft" size={16} /> {ar ? "حفظ كمسودة" : "Save Draft"}
          </button>
          <button className="btn btn-primary" onClick={() => handleSave(true)} disabled={saving}>
            <Icon name="check" size={16} />
            {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ وتأكيد" : "Save & Confirm")}
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "بيانات الأمر" : "Order Details"}</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">{ar ? "المورد" : "Vendor"} <span className="required">*</span></label>
              <SearchableSelect locale={locale} value={form.vendor_id} required onChange={value => setForm(f => ({ ...f, vendor_id: value }))}
                placeholder={ar ? "اكتب اسم أو رقم المورد..." : "Search vendor..."}
                options={vendors.map(v => ({ value: v.id, label: `${v.vendor_number ? `${v.vendor_number} — ` : ""}${v.name_ar}`, searchText: `${v.vendor_number || ""} ${v.name_ar || ""} ${v.name_en || ""}` }))} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ الأمر" : "Order Date"}</label>
                <input type="date" className="form-input" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ الاستلام المتوقع" : "Expected Date"}</label>
                <input type="date" className="form-input" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />
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
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-secondary)" }}>{ar ? "المجموع قبل الضريبة" : "Subtotal"}</span>
                <span style={{ fontWeight: 600 }}>{fmt(totals.subtotal)} SAR</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--warning)" }}>
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
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>{ar ? "الصنف / الوصف" : "Item / Description"} <span style={{ color: "var(--danger)" }}>*</span></th>
                <th style={{ width: 70 }}>{ar ? "الوحدة" : "Unit"}</th>
                <th style={{ width: 80 }}>{ar ? "الكمية" : "Qty"}</th>
                <th style={{ width: 110 }}>{ar ? "سعر الوحدة" : "Unit Price"}</th>
                <th style={{ width: 80 }}>{ar ? "الخصم%" : "Disc%"}</th>
                <th style={{ width: 80 }}>{ar ? "الضريبة%" : "VAT%"}</th>
                <th style={{ width: 100, textAlign: "end" }}>{ar ? "قبل الضريبة" : "Taxable"}</th>
                <th style={{ width: 90, textAlign: "end" }}>{ar ? "الضريبة" : "VAT"}</th>
                <th style={{ width: 100, textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const c = calcLine(line);
                return (
                  <tr key={i}>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <ItemPicker locale={locale} value={line.picked} onChange={p => setPicked(i, p)} purchaseMode={true} />
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input className="form-input" style={{ width: 60 }} value={line.unit} onChange={e => setField(i, "unit", e.target.value)} placeholder={ar ? "قطعة" : "pcs"} />
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
          <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{ar ? "المجموع قبل الضريبة" : "Subtotal"}</span>
              <span>{fmt(totals.subtotal)} SAR</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--warning)" }}>
              <span>{ar ? "ضريبة القيمة المضافة 15%" : "VAT 15%"}</span>
              <span>{fmt(totals.vat)} SAR</span>
            </div>
            <div style={{ height: 1, background: "var(--border)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}>
              <span>{ar ? "الإجمالي" : "Total"}</span>
              <span style={{ color: "var(--primary)" }}>{fmt(totals.total)} SAR</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
