"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBill, updateBill, confirmBill } from "@/lib/purchases";
import { getFiscalYears } from "@/lib/accounting";
import { getWarehouses } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";
import ItemPicker, { PickedItem } from "@/components/inventory/ItemPicker";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const toDateStr = (dt: string | null) => {
  if (!dt) return "";
  try { return new Date(dt).toISOString().split("T")[0]; } catch { return ""; }
};

interface Line { picked: PickedItem; discount_pct: string; vat_rate: string; }

function calcLine(l: Line) {
  const qty = l.picked.quantity || 0, price = l.picked.unit_price || 0;
  const disc = parseFloat(l.discount_pct) || 0;
  const vatStr = l.vat_rate === "" ? "15" : l.vat_rate;
  const vat = isNaN(parseFloat(vatStr)) ? 15 : parseFloat(vatStr);
  const gross = qty * price, discAmt = gross * disc / 100, taxable = gross - discAmt;
  const vatAmt = taxable * vat / 100;
  return { gross, discAmt, taxable, vatAmt, total: taxable + vatAmt };
}

export default function EditBillPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const ar = locale === "ar";
  const router = useRouter();

  const [bill, setBill] = useState<any>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isDraft = bill?.status === "draft";

  const [form, setForm] = useState({
    warehouse_id: "", vendor_invoice_number: "",
    payment_type: "cash", credit_days: "30",
    bill_date: "", supply_date: "", due_date: "",
    fiscal_year_id: "", notes: "",
  });
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    Promise.all([getBill(id), getWarehouses(), getFiscalYears()])
      .then(([bRes, whRes, fyRes]) => {
        const b = bRes.data;
        setBill(b);
        setWarehouses(whRes.data);
        setFiscalYears(fyRes.data);
        setForm({
          warehouse_id: b.warehouse_id || "",
          vendor_invoice_number: b.vendor_invoice_number || "",
          payment_type: b.due_date ? "credit" : "cash",
          credit_days: "30",
          bill_date: toDateStr(b.bill_date),
          supply_date: toDateStr(b.supply_date),
          due_date: toDateStr(b.due_date),
          fiscal_year_id: b.fiscal_year_id || "",
          notes: b.notes || "",
        });
        // تحويل الأسطر لصيغة الفورم
        const mappedLines: Line[] = (b.lines || []).map((l: any) => {
          let newSerials = undefined;
          if (l.new_serial_numbers_json) {
            try { newSerials = JSON.parse(l.new_serial_numbers_json); } catch {}
          }
          return {
                          picked: {
              mode: l.inventory_item_id ? (newSerials || l.new_serial_number ? "serial" : l.batch_number ? "batch" : "item") : "free",
              // يحفظ اسم المادة منفصلاً عن السيريال حتى لا يظهر الحقل كأنه فارغ.
              item_name: l.item_name || l.inventory_item_name || String(l.description_ar || "").split(" — ")[0],
              description_ar: l.description_ar || "",

              unit_price: Number(l.unit_price || 0),
              quantity: Number(l.quantity || 1),
              inventory_item_id: l.inventory_item_id || undefined,
              serial_item_id: l.serial_item_id || undefined,
              new_serials: newSerials,
              new_serial_number: l.new_serial_number || undefined,
              new_serial_condition: l.new_serial_condition || undefined,
              new_serial_sale_price: l.new_serial_sale_price || undefined,
              batch_number: l.batch_number || undefined,
              batch_expiry_date: l.batch_expiry_date || undefined,
            },
            discount_pct: String(Number(l.discount_pct || 0)),
            vat_rate: String(Number(l.vat_rate || 15)),
          };
        });
        if (mappedLines.length === 0) mappedLines.push({ picked: { mode: "free", description_ar: "", unit_price: 0, quantity: 1 }, discount_pct: "0", vat_rate: "15" });
        setLines(mappedLines);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const setLine = (i: number, k: keyof Omit<Line, "picked">, v: string) =>
    setLines(p => p.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const setPicked = (i: number, picked: PickedItem) =>
    setLines(p => p.map((l, idx) => idx === i ? { ...l, picked } : l));
  const addLine = () => setLines(p => [...p, { picked: { mode: "free", description_ar: "", unit_price: 0, quantity: 1 }, discount_pct: "0", vat_rate: "15" }]);
  const removeLine = (i: number) => { if (lines.length > 1) setLines(p => p.filter((_, idx) => idx !== i)); };

  const totals = lines.reduce((acc, l) => {
    const c = calcLine(l);
    return { subtotal: acc.subtotal + c.gross, discount: acc.discount + c.discAmt, taxable: acc.taxable + c.taxable, vat: acc.vat + c.vatAmt, total: acc.total + c.total };
  }, { subtotal: 0, discount: 0, taxable: 0, vat: 0, total: 0 });

  const buildPayload = () => {
    const base: any = {
      warehouse_id: form.warehouse_id || null,
      vendor_invoice_number: form.vendor_invoice_number || null,
      bill_date: form.bill_date, supply_date: form.supply_date,
      due_date: form.due_date || null, notes: form.notes || null,
    };
    // أرسل الأسطر دائماً — لجميع حالات الفاتورة
    base.lines = lines.map((l, i) => ({
        description_ar: l.picked.description_ar || (ar ? "صنف" : "Item"),
        quantity: l.picked.quantity || 1, unit_price: l.picked.unit_price || 0,
        discount_pct: parseFloat(l.discount_pct) || 0,
        vat_rate: l.vat_rate === "" ? 15 : (isNaN(parseFloat(l.vat_rate)) ? 15 : parseFloat(l.vat_rate)),
        vat_category: parseFloat(l.vat_rate) === 0 ? "Z" : "S", line_order: i,
        inventory_item_id: l.picked.inventory_item_id || null,
        serial_item_id: l.picked.serial_item_id || null,
        new_serial_numbers: l.picked.new_serials?.map(s => ({ serial_number: s.serial_number, condition: s.condition, sale_price: s.sale_price ?? null })) || null,
        new_serial_number: l.picked.new_serial_number || null,
        new_serial_condition: l.picked.new_serial_condition || null,
        new_serial_sale_price: l.picked.new_serial_sale_price || null,
        batch_number: l.picked.batch_number || null,
        batch_expiry_date: l.picked.batch_expiry_date || null,
    }));
    return base;
  };

  const handleSave = async () => {
    if (!form.warehouse_id) { alert(ar ? "يرجى اختيار المستودع" : "Please select a warehouse"); return; }
    setSaving(true);
    try {
      await updateBill(id, buildPayload());
      router.push(`/${locale}/purchases/bills/${id}`);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const handleSaveConfirm = async () => {
    if (!form.warehouse_id) { alert(ar ? "يرجى اختيار المستودع" : "Please select a warehouse"); return; }
    setSaving(true);
    try {
      await updateBill(id, buildPayload());
      // نؤكد فقط إذا كانت مسودة
      if (isDraft) await confirmBill(id);
      router.push(`/${locale}/purchases/bills/${id}`);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="empty-state" style={{ minHeight: "60vh" }}><div>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;
  if (!bill) return <div className="empty-state"><div>{ar ? "الفاتورة غير موجودة" : "Bill not found"}</div></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/purchases/bills`}>{ar ? "الفواتير الواردة" : "Bills"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/purchases/bills/${id}`}>{bill.bill_number}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "تعديل" : "Edit"}</span>
          </div>
          <h1 className="page-title">
            {ar ? `تعديل الفاتورة — ${bill.bill_number}` : `Edit Bill — ${bill.bill_number}`}
          </h1>
          {!isDraft && (
            <div style={{ marginTop: 6, padding: "6px 12px", background: "#FEF3C7", borderRadius: 8, fontSize: 12, color: "#92400E", fontWeight: 600, display: "inline-flex", gap: 6, alignItems: "center" }}>
              <Icon name="warning" size={13} />
              {ar ? "الفاتورة مؤكدة — التعديل سيُحدّث المبالغ والأسطر" : "Confirmed — editing will update amounts and lines"}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/purchases/bills/${id}`} className="btn btn-secondary">{ar ? "إلغاء" : "Cancel"}</Link>
          <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>
            <Icon name="draft" size={16} /> {ar ? "حفظ التعديلات" : "Save Changes"}
          </button>
          {isDraft && (
            <button className="btn btn-primary" onClick={handleSaveConfirm} disabled={saving}>
              <Icon name="check" size={16} />
              {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ وتأكيد" : "Save & Confirm")}
            </button>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "بيانات الفاتورة" : "Bill Details"}</span></div>
          <div className="card-body">

            {/* المستودع */}
            <div className="form-group">
              <label className="form-label">{ar ? "المستودع المستلِم" : "Receiving Warehouse"} <span className="required">*</span></label>
              <select className="form-input form-select" value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
                <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar}{w.is_default ? (ar ? " (افتراضي)" : " (Default)") : ""}</option>)}
              </select>
            </div>

            {/* رقم المرجع */}
            <div className="form-group">
              <label className="form-label">{ar ? "رقم المرجع / الإذن" : "Reference / Permit Number"}</label>
              <input className="form-input" value={form.vendor_invoice_number} onChange={e => setForm(f => ({ ...f, vendor_invoice_number: e.target.value }))} />
            </div>

            {/* التواريخ */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ الفاتورة" : "Bill Date"}</label>
                <input type="date" className="form-input" value={form.bill_date} onChange={e => setForm(f => ({ ...f, bill_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ التوريد" : "Supply Date"}</label>
                <input type="date" className="form-input" value={form.supply_date} onChange={e => setForm(f => ({ ...f, supply_date: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "تاريخ الاستحقاق" : "Due Date"}</label>
              <input type="date" className="form-input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>

            {/* الملاحظات */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* ملخص */}
        <div className="card" style={{ borderColor: "#DDD6FE", background: "#F5F3FF" }}>
          <div className="card-body" style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#5B21B6", marginBottom: 12 }}>
              {ar ? "ملخص الفاتورة" : "Bill Summary"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6B7280" }}>{ar ? "رقم الفاتورة:" : "Bill Number:"}</span>
                <span style={{ fontWeight: 700 }}>{bill.bill_number}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6B7280" }}>{ar ? "الحالة:" : "Status:"}</span>
                <span style={{ fontWeight: 700, color: isDraft ? "#D97706" : "#6F4A84" }}>
                  {isDraft ? (ar ? "مسودة" : "Draft") : (ar ? "مؤكدة" : "Confirmed")}                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#6B7280" }}>{ar ? "الإجمالي الحالي:" : "Current Total:"}</span>
                <span style={{ fontWeight: 700 }}>{fmt(bill.total)} SAR</span>
              </div>
              {!isDraft && (
                <div style={{ marginTop: 8, padding: 10, background: "#E9DDED", borderRadius: 8, fontSize: 11, color: "#4B2A5A" }}>
                  {ar ? "الفاتورة مؤكدة — التعديل سيحدث الأسطر والمبالغ مباشرة" : "Confirmed bill — changes will update lines and amounts directly"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* الأسطر — متاحة لجميع الحالات */}
      <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">{ar ? "أسطر الفاتورة" : "Bill Lines"}</span>
            <button className="btn btn-secondary btn-sm" onClick={addLine}><Icon name="plus" size={14} /> {ar ? "إضافة سطر" : "Add Line"}</button>
          </div>
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>{ar ? "الصنف / الوصف" : "Item"}</th>
                  <th style={{ width: 80 }}>{ar ? "الكمية" : "Qty"}</th>
                  <th style={{ width: 110 }}>{ar ? "سعر الوحدة" : "Price"}</th>
                  <th style={{ width: 80 }}>{ar ? "الخصم%" : "Disc%"}</th>
                  <th style={{ width: 80 }}>{ar ? "الضريبة%" : "VAT%"}</th>
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
                        <ItemPicker locale={locale} value={line.picked} onChange={p => setPicked(i, p)} purchaseMode={true} />
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
                        <input type="number" className="form-input" style={{ width: 70 }} value={line.discount_pct} min="0" max="100" onChange={e => setLine(i, "discount_pct", e.target.value)} />
                      </td>
                      <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                        <select className="form-input form-select" style={{ width: 82 }} value={line.vat_rate} onChange={e => setLine(i, "vat_rate", e.target.value)}>
                          <option value="15">15%</option>
                          <option value="0">0% — {ar ? "صفرية" : "Zero-rated"}</option>
                        </select>
                      </td>
                      <td style={{ textAlign: "end", fontWeight: 500, verticalAlign: "top", paddingTop: 12 }}>{fmt(c.taxable)}</td>
                      <td style={{ textAlign: "end", color: "var(--warning)", verticalAlign: "top", paddingTop: 12 }}>{fmt(c.vatAmt)}</td>
                      <td style={{ textAlign: "end", fontWeight: 700, verticalAlign: "top", paddingTop: 12 }}>{fmt(c.total)}</td>
                      <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                        {lines.length > 1 && (
                          <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => removeLine(i)}>
                            <Icon name="trash" size={14} />
                          </button>
                        )}
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
                <span style={{ color: "var(--text-secondary)" }}>{ar ? "المجموع" : "Subtotal"}</span>
                <span>{fmt(totals.subtotal)} SAR</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--warning)" }}>
                <span>VAT</span><span>{fmt(totals.vat)} SAR</span>
              </div>
              <div style={{ height: 1, background: "var(--border)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}>
                <span>{ar ? "الإجمالي" : "TOTAL"}</span>
                <span style={{ color: "var(--primary)" }}>{fmt(totals.total)} SAR</span>
              </div>
            </div>
          </div>
        </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingBottom: 32 }}>
        <Link href={`/${locale}/purchases/bills/${id}`} className="btn btn-secondary">{ar ? "إلغاء" : "Cancel"}</Link>
        <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>
          <Icon name="draft" size={16} /> {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التعديلات" : "Save Changes")}
        </button>
        <button className="btn btn-primary" onClick={handleSaveConfirm} disabled={saving}>
          <Icon name="check" size={16} />
          {saving ? (ar ? "جاري الحفظ..." : "Saving...") : isDraft ? (ar ? "حفظ وتأكيد" : "Save & Confirm") : (ar ? "حفظ التعديلات" : "Save Changes")}
        </button>
      </div>
    </>
  );
}
