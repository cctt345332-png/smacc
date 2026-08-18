"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBill, confirmBill, getPurchaseOrders, getVendors } from "@/lib/purchases";
import { getFiscalYears } from "@/lib/accounting";
import { getWarehouses } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";
import ItemPicker, { PickedItem } from "@/components/inventory/ItemPicker";

// ── مساعدات ──────────────────────────────────────────────────────────
const fmt = (n: number) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = () => new Date().toISOString().split("T")[0];

// ── أنواع ─────────────────────────────────────────────────────────────
interface Line {
  picked: PickedItem;
  discount_pct: string;
  vat_rate: string;
}

// الكمية الفعلية للسطر — للسيريال = عدد السيريالات المُدخلة
function lineQty(l: Line): number {
  if (l.picked.mode === "serial" && l.picked.new_serials && l.picked.new_serials.length > 0) {
    return l.picked.new_serials.length;
  }
  return l.picked.quantity || 0;
}

// حساب مبالغ السطر
function calcLine(l: Line) {
  const qty   = lineQty(l);
  const price = l.picked.unit_price || 0;
  const disc  = parseFloat(l.discount_pct) || 0;
  const vatStr = l.vat_rate === "" ? "15" : l.vat_rate;
  const vat    = isNaN(parseFloat(vatStr)) ? 15 : parseFloat(vatStr);
  const gross   = qty * price;
  const discAmt = gross * disc / 100;
  const taxable = gross - discAmt;
  const vatAmt  = taxable * vat / 100;
  return { qty, gross, discAmt, taxable, vatAmt, total: taxable + vatAmt };
}

const emptyLine = (): Line => ({
  picked: { mode: "free", description_ar: "", unit_price: 0, quantity: 1 },
  discount_pct: "0",
  vat_rate: "15",
});

// ── الصفحة الرئيسية ───────────────────────────────────────────────────
export default function NewBillPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();
  const preOrderId = searchParams.get("order_id") || "";

  // ── بيانات مساعدة ─────────────────────────────────────────────────
  const [vendors,        setVendors]        = useState<any[]>([]);
  const [warehouses,     setWarehouses]     = useState<any[]>([]);
  const [fiscalYears,    setFiscalYears]    = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [saving,         setSaving]         = useState(false);

  // ── رأس الفاتورة ──────────────────────────────────────────────────
  const [form, setForm] = useState({
    vendor_id:             "",
    warehouse_id:          "",
    vendor_invoice_number: "",
    payment_type:          "cash",
    credit_days:           "30",
    bill_date:             today(),
    supply_date:           today(),
    due_date:              today(),
    fiscal_year_id:        "",
    purchase_order_id:     preOrderId,
    notes:                 "",
  });

  // ── أسطر الفاتورة ─────────────────────────────────────────────────
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  // ── تحميل البيانات ────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getWarehouses(),
      getFiscalYears(),
      getPurchaseOrders({ status: "confirmed" }),
      getVendors(),
    ]).then(([whRes, fyRes, poRes, venRes]) => {
      setWarehouses(whRes.data);
      setFiscalYears(fyRes.data);
      setPurchaseOrders(poRes.data);
      setVendors(venRes.data);

      // مستودع افتراضي
      const defWh = whRes.data.find((w: any) => w.is_default) || whRes.data[0];
      if (defWh) setForm(f => ({ ...f, warehouse_id: defWh.id }));

      // سنة مالية مفتوحة
      if (fyRes.data.length > 0) {
        const active = fyRes.data.find((fy: any) => fy.status === "open") || fyRes.data[0];
        setForm(f => ({ ...f, fiscal_year_id: active.id }));
      }
    }).catch(() => {});
  }, []);

  // ── معالجة طريقة الدفع ────────────────────────────────────────────
  const handlePaymentTypeChange = (type: string) => {
    if (type === "cash") {
      setForm(f => ({ ...f, payment_type: type, due_date: f.bill_date }));
    } else {
      const days = parseInt(form.credit_days) || 30;
      const d = new Date(form.bill_date);
      d.setDate(d.getDate() + days);
      setForm(f => ({ ...f, payment_type: type, due_date: d.toISOString().split("T")[0] }));
    }
  };

  const handleCreditDaysChange = (days: string) => {
    const d = new Date(form.bill_date);
    d.setDate(d.getDate() + (parseInt(days) || 30));
    setForm(f => ({ ...f, credit_days: days, due_date: d.toISOString().split("T")[0] }));
  };

  // ── تعديل الأسطر ──────────────────────────────────────────────────
  const setLine = (i: number, k: keyof Omit<Line, "picked">, v: string) =>
    setLines(p => p.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const setPicked = (i: number, picked: PickedItem) =>
    setLines(p => p.map((l, idx) => idx === i ? { ...l, picked } : l));

  const addLine    = () => setLines(p => [...p, emptyLine()]);
  const removeLine = (i: number) => {
    if (lines.length > 1) setLines(p => p.filter((_, idx) => idx !== i));
  };

  // ── إجماليات ──────────────────────────────────────────────────────
  const totals = lines.reduce(
    (acc, l) => {
      const c = calcLine(l);
      return {
        subtotal: acc.subtotal + c.gross,
        discount: acc.discount + c.discAmt,
        taxable:  acc.taxable  + c.taxable,
        vat:      acc.vat      + c.vatAmt,
        total:    acc.total    + c.total,
      };
    },
    { subtotal: 0, discount: 0, taxable: 0, vat: 0, total: 0 },
  );

  // ── بناء الـ payload ───────────────────────────────────────────────
  const buildPayload = () => ({
    vendor_id:             form.vendor_id             || null,
    warehouse_id:          form.warehouse_id           || null,
    vendor_invoice_number: form.vendor_invoice_number  || null,
    payment_type:          form.payment_type,
    bill_date:             form.bill_date,
    supply_date:           form.supply_date,
    due_date:              form.due_date               || null,
    fiscal_year_id:        form.fiscal_year_id         || null,
    purchase_order_id:     form.purchase_order_id      || null,
    notes:                 form.notes                  || null,
    lines: lines.map((l, i) => {
      const qty = lineQty(l);
      return {
        line_order:       i,
        description_ar:   l.picked.description_ar || (ar ? "صنف" : "Item"),
        // الكمية الفعلية — للسيريال = عدد السيريالات
        quantity:         qty,
        // unit_price = تكلفة الشراء للوحدة (cost_price)
        // sale_price لكل سيريال يأتي داخل new_serial_numbers منفصلاً
        unit_price:       l.picked.unit_price || 0,
        discount_pct:     parseFloat(l.discount_pct) || 0,
        vat_rate:         l.vat_rate === "" ? 15 : (isNaN(parseFloat(l.vat_rate)) ? 15 : parseFloat(l.vat_rate)),
        vat_category:     "S",
        inventory_item_id: l.picked.inventory_item_id || null,
        // سيريالات — كل عنصر: { serial_number, condition, sale_price }
        // sale_price هنا = سعر بيع هذا السيريال تحديداً (منفصل عن unit_price)
        new_serial_numbers: l.picked.mode === "serial" && l.picked.new_serials?.length
          ? l.picked.new_serials.map(s => ({
              serial_number: s.serial_number,
              condition:     s.condition     || "new",
              // sale_price: 0 أو فارغ → null (لم يُحدَّد بعد)
              sale_price:    (s.sale_price && s.sale_price > 0) ? s.sale_price : null,
            }))
          : null,
        // تشغيلة (صيدلية)
        batch_number:      l.picked.batch_number      || null,
        batch_expiry_date: l.picked.batch_expiry_date || null,
      };
    }),
  });

  // ── التحقق من البيانات ────────────────────────────────────────────
  const validate = (): boolean => {
    if (!form.warehouse_id) {
      alert(ar ? "يرجى اختيار المستودع المستلِم" : "Please select a receiving warehouse");
      return false;
    }
    for (const l of lines) {
      if (!l.picked.description_ar?.trim()) {
        alert(ar ? "يرجى إدخال وصف لجميع الأسطر" : "Please enter a description for all lines");
        return false;
      }
      if (l.picked.unit_price == null || l.picked.unit_price < 0) {
        alert(ar ? "سعر الوحدة يجب أن يكون 0 أو أكثر" : "Unit price must be 0 or greater");
        return false;
      }
      if (
        l.picked.mode === "serial" &&
        (!l.picked.new_serials || l.picked.new_serials.length === 0)
      ) {
        alert(ar ? "يرجى إضافة أرقام السيريالات للصنف المُسرَّل" : "Please add serial numbers for the serial item");
        return false;
      }
      if (
        l.picked.mode === "batch" &&
        (!l.picked.batch_number || !l.picked.batch_expiry_date)
      ) {
        alert(ar ? "يرجى إدخال رقم التشغيلة وتاريخ الانتهاء" : "Please enter batch number and expiry date");
        return false;
      }
    }
    return true;
  };

  // ── الحفظ ─────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await createBill(buildPayload());
      router.push(`/${locale}/purchases/bills`);
    } catch (e: any) {
      alert(e?.response?.data?.detail || (ar ? "حدث خطأ أثناء الحفظ" : "Error saving bill"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfirm = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const { data } = await createBill(buildPayload());
      await confirmBill(data.id);
      router.push(`/${locale}/purchases/bills/${data.id}`);
    } catch (e: any) {
      alert(e?.response?.data?.detail || (ar ? "حدث خطأ أثناء الحفظ" : "Error saving bill"));
    } finally {
      setSaving(false);
    }
  };

  // ── الواجهة ───────────────────────────────────────────────────────
  return (
    <>
      {/* ─── رأس الصفحة ─── */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/purchases/bills`}>
              {ar ? "الفواتير الواردة" : "Bills"}
            </Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "فاتورة واردة جديدة" : "New Bill"}</span>
          </div>
          <h1 className="page-title">
            {ar ? "فاتورة واردة جديدة" : "New Purchase Bill"}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/purchases/bills`} className="btn btn-secondary">
            {ar ? "إلغاء" : "Cancel"}
          </Link>
          <button className="btn btn-secondary" onClick={handleSaveDraft} disabled={saving}>
            <Icon name="draft" size={16} />
            {ar ? "حفظ كمسودة" : "Save Draft"}
          </button>
          <button className="btn btn-primary" onClick={handleSaveConfirm} disabled={saving}>
            <Icon name="check" size={16} />
            {saving
              ? (ar ? "جاري الحفظ..." : "Saving...")
              : (ar ? "حفظ وتأكيد" : "Save & Confirm")}
          </button>
        </div>
      </div>

      {/* ─── بيانات الفاتورة ─── */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {ar ? "بيانات الفاتورة الواردة" : "Bill Details"}
            </span>
          </div>
          <div className="card-body">

            {/* المورد — اختياري */}
            <div className="form-group">
              <label className="form-label">
                {ar ? "المورد" : "Vendor"}
                <span style={{ fontSize: 11, color: "var(--text-secondary)", marginInlineStart: 6 }}>
                  {ar ? "(اختياري)" : "(optional)"}
                </span>
              </label>
              <select
                className="form-input form-select"
                value={form.vendor_id}
                onChange={e => setForm(f => ({ ...f, vendor_id: e.target.value }))}
              >
                <option value="">{ar ? "— بدون مورد —" : "— No vendor —"}</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name_ar}</option>
                ))}
              </select>
            </div>

            {/* المستودع — مطلوب */}
            <div className="form-group">
              <label className="form-label">
                {ar ? "المستودع المستلِم" : "Receiving Warehouse"}
                <span className="required"> *</span>
              </label>
              <select
                className="form-input form-select"
                value={form.warehouse_id}
                onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}
              >
                <option value="">{ar ? "— اختر المستودع —" : "— Select Warehouse —"}</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name_ar}{w.is_default ? (ar ? " (افتراضي)" : " (Default)") : ""}
                  </option>
                ))}
              </select>
              {form.warehouse_id && (
                <div style={{ marginTop: 6, fontSize: 11, color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon name="bank" size={13} />
                  {ar ? "المخزون سيُضاف لهذا المستودع عند التأكيد" : "Stock will be added to this warehouse on confirm"}
                </div>
              )}
            </div>

            {/* رقم المرجع */}
            <div className="form-group">
              <label className="form-label">
                {ar ? "رقم فاتورة المورد / المرجع" : "Vendor Invoice / Reference"}
              </label>
              <input
                className="form-input"
                value={form.vendor_invoice_number}
                onChange={e => setForm(f => ({ ...f, vendor_invoice_number: e.target.value }))}
                placeholder={ar ? "رقم فاتورة المورد (اختياري)" : "Vendor invoice number (optional)"}
              />
            </div>

            {/* طريقة الدفع */}
            <div className="form-group">
              <label className="form-label">
                {ar ? "طريقة الدفع" : "Payment Terms"}
                <span className="required"> *</span>
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["cash", "credit"] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handlePaymentTypeChange(type)}
                    style={{
                      flex: 1, padding: "8px 12px", borderRadius: 8, border: "2px solid",
                      borderColor: form.payment_type === type
                        ? (type === "cash" ? "var(--primary)" : "#D97706")
                        : "var(--border)",
                      background: form.payment_type === type
                        ? (type === "cash" ? "var(--primary)" : "#D97706")
                        : "white",
                      color: form.payment_type === type ? "white" : "var(--text-primary)",
                      fontWeight: 600, fontSize: 13, cursor: "pointer",
                    }}
                  >
                    {type === "cash"
                      ? (ar ? "نقدي / فوري" : "Cash")
                      : (ar ? "آجل (ائتماني)" : "Credit")}
                  </button>
                ))}
              </div>
            </div>

            {/* مدة الأجل */}
            {form.payment_type === "credit" && (
              <div className="form-group" style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 14px" }}>
                <label className="form-label" style={{ color: "#92400E" }}>
                  {ar ? "مدة الأجل (أيام)" : "Credit Period (days)"}
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="number" className="form-input" style={{ width: 100 }}
                    value={form.credit_days} min="1" max="365"
                    onChange={e => handleCreditDaysChange(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    {["15", "30", "45", "60", "90"].map(d => (
                      <button
                        key={d} type="button"
                        onClick={() => handleCreditDaysChange(d)}
                        style={{
                          padding: "4px 10px", borderRadius: 6, border: "1px solid",
                          borderColor: form.credit_days === d ? "#D97706" : "var(--border)",
                          background: form.credit_days === d ? "#D97706" : "white",
                          color: form.credit_days === d ? "white" : "var(--text-secondary)",
                          fontSize: 12, cursor: "pointer", fontWeight: 600,
                        }}
                      >{d}</button>
                    ))}
                  </div>
                </div>
                {form.due_date && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#92400E", fontWeight: 600 }}>
                    {ar ? "تاريخ الاستحقاق:" : "Due Date:"} {form.due_date}
                  </div>
                )}
              </div>
            )}

            {/* التواريخ */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ الفاتورة" : "Bill Date"}</label>
                <input
                  type="date" className="form-input"
                  value={form.bill_date}
                  onChange={e => setForm(f => ({ ...f, bill_date: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ التوريد" : "Supply Date"}</label>
                <input
                  type="date" className="form-input"
                  value={form.supply_date}
                  onChange={e => setForm(f => ({ ...f, supply_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ الاستحقاق" : "Due Date"}</label>
                <input
                  type="date" className="form-input"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "السنة المالية" : "Fiscal Year"}</label>
                <select
                  className="form-input form-select"
                  value={form.fiscal_year_id}
                  onChange={e => setForm(f => ({ ...f, fiscal_year_id: e.target.value }))}
                >
                  <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                  {fiscalYears.map(fy => (
                    <option key={fy.id} value={fy.id}>{fy.name || fy.year}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* أمر الشراء */}
            <div className="form-group">
              <label className="form-label">
                {ar ? "أمر الشراء المرتبط" : "Linked Purchase Order"}
                <span style={{ fontSize: 11, color: "var(--text-secondary)", marginInlineStart: 6 }}>
                  {ar ? "(اختياري)" : "(optional)"}
                </span>
              </label>
              <select
                className="form-input form-select"
                value={form.purchase_order_id}
                onChange={e => setForm(f => ({ ...f, purchase_order_id: e.target.value }))}
              >
                <option value="">{ar ? "— بدون ربط —" : "— None —"}</option>
                {purchaseOrders.map(po => (
                  <option key={po.id} value={po.id}>{po.order_number}</option>
                ))}
              </select>
            </div>

            {/* ملاحظات */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
              <textarea
                className="form-input" rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* ─── الجانب الأيمن — معلومات ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* بطاقة ZATCA */}
          <div className="card" style={{ borderColor: "#DBEAFE", background: "#EFF6FF" }}>
            <div className="card-body" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Icon name="tax" size={18} color="#2563EB" />
                <span style={{ fontWeight: 700, fontSize: 14, color: "#1E40AF" }}>
                  {ar ? "فاتورة ضريبية واردة — ZATCA" : "ZATCA Incoming Tax Invoice"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#1E40AF", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{ar ? "نوع الفاتورة:" : "Invoice Type:"}</span>
                  <span style={{ fontWeight: 600 }}>{ar ? "فاتورة واردة" : "Incoming Bill"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{ar ? "الرقم الضريبي للمورد:" : "Vendor VAT Number:"}</span>
                  <span style={{ fontStyle: "italic", opacity: 0.7 }}>
                    {ar ? "مطلوب للخصم الضريبي" : "Required for VAT deduction"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{ar ? "ضريبة القيمة المضافة:" : "VAT Rate:"}</span>
                  <span style={{ fontWeight: 700 }}>15%</span>
                </div>
              </div>
            </div>
          </div>

          {/* تلميح السعر للسيريالات */}
          <div className="card" style={{ borderColor: "#EDE9FE", background: "#F5F3FF" }}>
            <div className="card-body" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: "#5B21B6", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {ar ? "ملاحظة — الأسعار في السيريالات" : "Note — Serial item prices"}
                </div>
                <div>
                  {ar
                    ? "سعر الوحدة = تكلفة شراء كل وحدة (unit_price). سعر البيع لكل سيريال يُدخل بشكل منفصل داخل نافذة السيريالات."
                    : "Unit price = purchase cost per unit. Each serial's sale price is entered separately in the serials window."}
                </div>
              </div>
            </div>
          </div>

          {/* ربط المخزون */}
          <div className="card" style={{ borderColor: "#D1FAE5", background: "#F0FDF4" }}>
            <div className="card-body" style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: "#065F46", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {ar ? "ربط المخزون التلقائي" : "Auto Inventory Link"}
                </div>
                <div>
                  {ar
                    ? "عند تأكيد الفاتورة، يُضاف المخزون تلقائياً للمستودع المختار."
                    : "On confirmation, inventory is automatically added to the selected warehouse."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── أسطر الفاتورة ─── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">{ar ? "أسطر الفاتورة" : "Bill Lines"}</span>
          <button className="btn btn-secondary btn-sm" onClick={addLine}>
            <Icon name="plus" size={14} /> {ar ? "إضافة سطر" : "Add Line"}
          </button>
        </div>

        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>
                  {ar ? "الصنف / الوصف" : "Item / Description"}
                  <span style={{ color: "var(--danger)" }}> *</span>
                </th>
                <th style={{ width: 80 }}>{ar ? "الكمية" : "Qty"}</th>
                <th style={{ width: 120 }}>
                  {ar ? "سعر التكلفة" : "Cost Price"}
                  <span style={{ color: "var(--danger)" }}> *</span>
                </th>
                <th style={{ width: 90 }}>{ar ? "خصم%" : "Disc%"}</th>
                <th style={{ width: 90 }}>{ar ? "ضريبة%" : "VAT%"}</th>
                <th style={{ width: 115, textAlign: "end" }}>{ar ? "قبل الضريبة" : "Taxable"}</th>
                <th style={{ width: 100, textAlign: "end" }}>{ar ? "الضريبة" : "VAT"}</th>
                <th style={{ width: 115, textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const c        = calcLine(line);
                const isSerial = line.picked.mode === "serial";
                const isBatch  = line.picked.mode === "batch";

                return (
                  <tr key={i}>
                    {/* الصنف */}
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <ItemPicker
                        locale={locale}
                        value={line.picked}
                        onChange={picked => setPicked(i, picked)}
                        purchaseMode={true}
                        warehouseId={form.warehouse_id}
                      />
                    </td>

                    {/* الكمية — تلقائية للسيريال */}
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      {isSerial ? (
                        <div style={{
                          width: 70, height: 36, display: "flex", alignItems: "center",
                          justifyContent: "center", background: "#F5F3FF",
                          border: "1px solid #C4B5FD", borderRadius: 6,
                          fontWeight: 700, fontSize: 13, color: "#7C3AED",
                        }}>
                          {c.qty}
                        </div>
                      ) : (
                        <input
                          type="number" className="form-input" style={{ width: 70 }}
                          value={line.picked.quantity} min="0" step="0.001"
                          onChange={e =>
                            setPicked(i, { ...line.picked, quantity: parseFloat(e.target.value) || 1 })
                          }
                        />
                      )}
                    </td>

                    {/* سعر التكلفة — unit_price */}
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input
                        type="number" className="form-input" style={{ width: 110 }}
                        value={line.picked.unit_price} min="0" step="0.01"
                        onChange={e =>
                          setPicked(i, { ...line.picked, unit_price: parseFloat(e.target.value) || 0 })
                        }
                      />
                      {isSerial && (
                        <div style={{ fontSize: 10, color: "#7C3AED", marginTop: 2 }}>
                          {ar ? "تكلفة الشراء للوحدة" : "Purchase cost / unit"}
                        </div>
                      )}
                    </td>

                    {/* خصم% */}
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input
                        type="number" className="form-input" style={{ width: 70 }}
                        value={line.discount_pct} min="0" max="100"
                        onChange={e => setLine(i, "discount_pct", e.target.value)}
                      />
                    </td>

                    {/* ضريبة% */}
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input
                        type="number" className="form-input" style={{ width: 70 }}
                        value={line.vat_rate} min="0" max="100"
                        onChange={e => setLine(i, "vat_rate", e.target.value)}
                      />
                    </td>

                    {/* قبل الضريبة */}
                    <td style={{ textAlign: "end", fontWeight: 500, verticalAlign: "top", paddingTop: 12 }}>
                      {fmt(c.taxable)}
                    </td>

                    {/* الضريبة */}
                    <td style={{ textAlign: "end", color: "var(--warning)", fontWeight: 500, verticalAlign: "top", paddingTop: 12 }}>
                      {fmt(c.vatAmt)}
                    </td>

                    {/* الإجمالي */}
                    <td style={{ textAlign: "end", fontWeight: 700, verticalAlign: "top", paddingTop: 12 }}>
                      {fmt(c.total)}
                    </td>

                    {/* حذف */}
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      {lines.length > 1 && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: "var(--danger)" }}
                          onClick={() => removeLine(i)}
                          title={ar ? "حذف السطر" : "Remove line"}
                        >
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

        {/* ─── الإجماليات ─── */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 340, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>
                {ar ? "المجموع قبل الخصم" : "Subtotal (before discount)"}
              </span>
              <span>{fmt(totals.subtotal)} SAR</span>
            </div>
            {totals.discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--danger)" }}>{ar ? "إجمالي الخصم" : "Total Discount"}</span>
                <span style={{ color: "var(--danger)" }}>− {fmt(totals.discount)} SAR</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>
                {ar ? "المبلغ الخاضع للضريبة" : "Taxable Amount"}
              </span>
              <span>{fmt(totals.taxable)} SAR</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--warning)" }}>
              <span>{ar ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)"}</span>
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

      {/* ─── أزرار الحفظ السفلية ─── */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingBottom: 32 }}>
        <Link href={`/${locale}/purchases/bills`} className="btn btn-secondary">
          {ar ? "إلغاء" : "Cancel"}
        </Link>
        <button className="btn btn-secondary" onClick={handleSaveDraft} disabled={saving}>
          <Icon name="draft" size={16} />
          {ar ? "حفظ كمسودة" : "Save as Draft"}
        </button>
        <button className="btn btn-primary" onClick={handleSaveConfirm} disabled={saving}>
          <Icon name="check" size={16} />
          {saving
            ? (ar ? "جاري الحفظ..." : "Saving...")
            : (ar ? "حفظ وتأكيد" : "Save & Confirm")}
        </button>
      </div>
    </>
  );
}
