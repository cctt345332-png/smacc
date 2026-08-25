"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCustomers, createInvoice, confirmInvoice } from "@/lib/sales";
import { getFiscalYears } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";
import ItemPicker, { PickedItem, LineMode } from "@/components/inventory/ItemPicker";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const today = () => new Date().toISOString().split("T")[0];

interface Line {
  picked: PickedItem;
  discount_pct: string;
  vat_rate: string;
}

const emptyLine = (): Line => ({
  picked: { mode: "free", description_ar: "", unit_price: 0, quantity: 1 },
  discount_pct: "0",
  vat_rate: "15",
});

function calcLine(line: Line) {
  const qty = line.picked.quantity || 0;
  const price = line.picked.unit_price || 0;
  const disc = parseFloat(line.discount_pct) || 0;
  const taxRate = parseFloat(line.vat_rate) || 0;
  const gross = qty * price;
  const discAmt = gross * (disc / 100);
  const taxable = gross - discAmt;
  const tax = taxable * (taxRate / 100);
  return { gross, discAmt, taxable, tax, total: taxable + tax };
}

export default function NewInvoicePage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const router = useRouter();

  const [customers, setCustomers] = useState<any[]>([]);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    customer_id: "",
    invoice_type: "standard",
    payment_type: "cash",
    credit_days: "30",
    issue_date: today(),
    supply_date: today(),
    due_date: "",
    fiscal_year_id: "",
    notes: "",
    terms: "",
  });

  const handlePaymentTypeChange = (type: string) => {
    if (type === "cash") {
      setForm(f => ({ ...f, payment_type: type, due_date: f.issue_date }));
    } else {
      const days = parseInt(form.credit_days) || 30;
      const d = new Date(form.issue_date);
      d.setDate(d.getDate() + days);
      setForm(f => ({ ...f, payment_type: type, due_date: d.toISOString().split("T")[0] }));
    }
  };

  const handleCreditDaysChange = (days: string) => {
    const d = new Date(form.issue_date);
    d.setDate(d.getDate() + (parseInt(days) || 30));
    setForm(f => ({ ...f, credit_days: days, due_date: d.toISOString().split("T")[0] }));
  };

  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  useEffect(() => {
    Promise.all([getCustomers(), getFiscalYears()])
      .then(([cRes, fyRes]) => {
        setCustomers(cRes.data);
        setFiscalYears(fyRes.data);
        if (fyRes.data.length > 0) {
          const active = fyRes.data.find((fy: any) => fy.status === "open") || fyRes.data[0];
          setForm(f => ({ ...f, fiscal_year_id: active.id }));
        }
      })
      .catch(() => {});
  }, []);

  const setLine = (i: number, field: keyof Omit<Line, "picked">, value: string) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const setPicked = (i: number, picked: PickedItem) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, picked } : l));
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const totals = lines.reduce((acc, l) => {
    const c = calcLine(l);
    return {
      subtotal: acc.subtotal + c.gross,
      discount: acc.discount + c.discAmt,
      taxable: acc.taxable + c.taxable,
      vat: acc.vat + c.tax,
      total: acc.total + c.total,
    };
  }, { subtotal: 0, discount: 0, taxable: 0, vat: 0, total: 0 });

  const buildPayload = () => ({
    ...form,
    fiscal_year_id: form.fiscal_year_id || null,
    due_date: form.due_date || null,
    lines: lines.map((l, i) => ({
      description_ar: l.picked.description_ar || (ar ? "صنف" : "Item"),
      quantity: l.picked.quantity || 1,
      unit_price: l.picked.unit_price || 0,
      discount_pct: parseFloat(l.discount_pct) || 0,
      vat_rate: parseFloat(l.vat_rate) || 15,
      vat_category: "S",
      line_order: i,
      inventory_item_id: l.picked.inventory_item_id || null,
      serial_item_id: l.picked.serial_item_id || null,
      serial_ids: l.picked.serial_ids || null,
      variant_id: l.picked.variant_id || null,
    })),
  });

  const validate = () => {
    if (!form.customer_id) { alert(ar ? "يرجى اختيار العميل" : "Please select a customer"); return false; }
    if (lines.length === 0) { alert(ar ? "يجب إضافة سطر واحد على الأقل" : "At least one line is required"); return false; }
    for (const l of lines) {
      if (!l.picked.description_ar) { alert(ar ? "يرجى إدخال وصف لجميع الأسطر" : "Please enter description for all lines"); return false; }
      if (l.picked.mode === "serial" && !l.picked.serial_item_id && (!l.picked.serial_ids || l.picked.serial_ids.length === 0)) {
        alert(ar ? "يرجى تحديد السيريالات لكل صنف مسرّل" : "Please select serials for each serial item");
        return false;
      }
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await createInvoice(buildPayload());
      router.push(`/${locale}/sales/invoices`);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Error");
    } finally { setSaving(false); }
  };

  const handleSaveConfirm = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const { data } = await createInvoice(buildPayload());
      await confirmInvoice(data.id);
      router.push(`/${locale}/sales/invoices/${data.id}`);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Error");
    } finally { setSaving(false); }
  };

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/sales/invoices`}>{ar ? "الفواتير" : "Invoices"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "فاتورة جديدة" : "New Invoice"}</span>
          </div>
          <h1 className="page-title">{ar ? "فاتورة ضريبية جديدة" : "New Tax Invoice"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/sales/invoices`} className="btn btn-secondary">
            {ar ? "إلغاء" : "Cancel"}
          </Link>
          <button className="btn btn-secondary" onClick={handleSaveDraft} disabled={saving}>
            <Icon name="draft" size={16} />
            {ar ? "حفظ كمسودة" : "Save Draft"}
          </button>
          <button className="btn btn-primary" onClick={handleSaveConfirm} disabled={saving}>
            <Icon name="check" size={16} />
            {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ وتأكيد" : "Save & Confirm")}
          </button>
        </div>
      </div>

      {/* Top two columns */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">{ar ? "بيانات الفاتورة" : "Invoice Details"}</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">{ar ? "العميل" : "Customer"} <span className="required">*</span></label>
              <select className="form-input form-select" value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                <option value="">{ar ? "— اختر العميل —" : "— Select Customer —"}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name_ar}{c.name_en ? ` / ${c.name_en}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "نوع الفاتورة" : "Invoice Type"}</label>
              <select className="form-input form-select" value={form.invoice_type} onChange={e => setForm(f => ({ ...f, invoice_type: e.target.value }))}>
                <option value="standard">{ar ? "ضريبية كاملة" : "Standard Tax Invoice"}</option>
                <option value="simplified">{ar ? "مبسطة" : "Simplified Invoice"}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{ar ? "طريقة الدفع" : "Payment Terms"} <span className="required">*</span></label>
              <div style={{ display: "flex", gap: 8 }}>
                {["cash", "credit"].map(type => (
                  <button key={type} type="button" onClick={() => handlePaymentTypeChange(type)}
                    style={{
                      flex: 1, padding: "8px 12px", borderRadius: 8, border: "2px solid",
                      borderColor: form.payment_type === type ? (type === "cash" ? "var(--primary)" : "#D97706") : "var(--border)",
                      background: form.payment_type === type ? (type === "cash" ? "var(--primary)" : "#D97706") : "white",
                      color: form.payment_type === type ? "white" : "var(--text-primary)",
                      fontWeight: 600, fontSize: 13, cursor: "pointer",
                    }}>
                    {type === "cash" ? (ar ? "نقدي / فوري" : "Cash") : (ar ? "آجل (ائتماني)" : "Credit")}
                  </button>
                ))}
              </div>
            </div>

            {form.payment_type === "credit" && (
              <div className="form-group" style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 14px" }}>
                <label className="form-label" style={{ color: "#92400E" }}>{ar ? "مدة الأجل (أيام)" : "Credit Period (days)"}</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="number" className="form-input" style={{ width: 100 }}
                    value={form.credit_days} min="1" max="365"
                    onChange={e => handleCreditDaysChange(e.target.value)} />
                  <div style={{ display: "flex", gap: 6 }}>
                    {["15", "30", "45", "60", "90"].map(d => (
                      <button key={d} type="button" onClick={() => handleCreditDaysChange(d)}
                        style={{
                          padding: "4px 10px", borderRadius: 6, border: "1px solid",
                          borderColor: form.credit_days === d ? "#D97706" : "var(--border)",
                          background: form.credit_days === d ? "#D97706" : "white",
                          color: form.credit_days === d ? "white" : "var(--text-secondary)",
                          fontSize: 12, cursor: "pointer", fontWeight: 600,
                        }}>{d}</button>
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

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ الإصدار" : "Issue Date"}</label>
                <input type="date" className="form-input" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ التوريد" : "Supply Date"}</label>
                <input type="date" className="form-input" value={form.supply_date} onChange={e => setForm(f => ({ ...f, supply_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ الاستحقاق" : "Due Date"}</label>
                <input type="date" className="form-input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "السنة المالية" : "Fiscal Year"}</label>
                <select className="form-input form-select" value={form.fiscal_year_id} onChange={e => setForm(f => ({ ...f, fiscal_year_id: e.target.value }))}>
                  <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                  {fiscalYears.map(fy => (
                    <option key={fy.id} value={fy.id}>{fy.name || fy.year}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "الشروط والأحكام" : "Terms & Conditions"}</span>
            </div>
            <div className="card-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "الشروط" : "Terms"}</label>
                <textarea className="form-input" rows={4} value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} placeholder={ar ? "شروط الدفع والتسليم..." : "Payment and delivery terms..."} />
              </div>
            </div>
          </div>

          <div className="card" style={{ borderColor: "#DBEAFE", background: "#EFF6FF" }}>
            <div className="card-body" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Icon name="tax" size={18} color="#5A187E" />
                <span style={{ fontWeight: 700, fontSize: 14, color: "#1E40AF" }}>
                  {ar ? "فاتورة ضريبية — ZATCA" : "ZATCA Tax Invoice"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#1E40AF", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{ar ? "نوع الفاتورة:" : "Invoice Type:"}</span>
                  <span style={{ fontWeight: 600 }}>{form.invoice_type === "standard" ? "ضريبية كاملة" : "مبسطة"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>UUID:</span>
                  <span style={{ fontStyle: "italic", opacity: 0.7 }}>{ar ? "يُولَّد تلقائياً" : "Auto-generated"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{ar ? "ضريبة القيمة المضافة:" : "VAT Rate:"}</span>
                  <span style={{ fontWeight: 700 }}>15%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Lines */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">{ar ? "أسطر الفاتورة" : "Invoice Lines"}</span>
          <button className="btn btn-secondary btn-sm" onClick={addLine}>
            <Icon name="plus" size={14} />
            {ar ? "إضافة سطر" : "Add Line"}
          </button>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>{ar ? "الصنف / الوصف" : "Item / Description"} <span style={{ color: "var(--danger)" }}>*</span></th>
                <th style={{ width: 80 }}>{ar ? "الكمية" : "Qty"}</th>
                <th style={{ width: 110 }}>{ar ? "سعر الوحدة" : "Unit Price"}</th>
                <th style={{ width: 90 }}>{ar ? "الخصم%" : "Disc%"}</th>
                <th style={{ width: 90 }}>{ar ? "الضريبة%" : "Tax%"}</th>
                <th style={{ width: 110, textAlign: "end" }}>{ar ? "قبل الضريبة" : "Taxable"}</th>
                <th style={{ width: 100, textAlign: "end" }}>{ar ? "الضريبة" : "VAT"}</th>
                <th style={{ width: 110, textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const c = calcLine(line);
                const isSerial = line.picked.mode === "serial";
                return (
                  <tr key={i}>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <ItemPicker
                        locale={locale}
                        value={line.picked}
                        onChange={picked => setPicked(i, picked)}
                        purchaseMode={false}
                      />
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input
                        type="number" className="form-input" style={{ width: 70 }}
                        value={line.picked.quantity}
                        min="0"
                        disabled={isSerial}
                        onChange={e => setPicked(i, { ...line.picked, quantity: parseFloat(e.target.value) || 1 })}
                      />
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input
                        type="number" className="form-input" style={{ width: 100 }}
                        value={line.picked.unit_price || ""}
                        placeholder="0.00"
                        min="0"
                        onFocus={e => e.target.select()}
                        onChange={e => setPicked(i, { ...line.picked, unit_price: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input type="number" className="form-input" style={{ width: 70 }} value={line.discount_pct} min="0" max="100" onChange={e => setLine(i, "discount_pct", e.target.value)} />
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input type="number" className="form-input" style={{ width: 70 }} value={line.vat_rate} min="0" max="100" onChange={e => setLine(i, "vat_rate", e.target.value)} />
                    </td>
                    <td style={{ textAlign: "end", fontWeight: 500, verticalAlign: "top", paddingTop: 12 }}>{fmt(c.taxable)}</td>
                    <td style={{ textAlign: "end", color: "var(--warning)", fontWeight: 500, verticalAlign: "top", paddingTop: 12 }}>{fmt(c.tax)}</td>
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

        {/* Totals */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{ar ? "المجموع قبل الخصم" : "Subtotal"}</span>
              <span>{fmt(totals.subtotal)} SAR</span>
            </div>
            {totals.discount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--danger)" }}>{ar ? "الخصم" : "Discount"}</span>
                <span style={{ color: "var(--danger)" }}>- {fmt(totals.discount)} SAR</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{ar ? "المبلغ الخاضع للضريبة" : "Taxable Amount"}</span>
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

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingBottom: 32 }}>
        <Link href={`/${locale}/sales/invoices`} className="btn btn-secondary">
          {ar ? "إلغاء" : "Cancel"}
        </Link>
        <button className="btn btn-secondary" onClick={handleSaveDraft} disabled={saving}>
          <Icon name="draft" size={16} />
          {ar ? "حفظ كمسودة" : "Save as Draft"}
        </button>
        <button className="btn btn-primary" onClick={handleSaveConfirm} disabled={saving}>
          <Icon name="check" size={16} />
          {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ وتأكيد" : "Save & Confirm")}
        </button>
      </div>
    </>
  );
}
