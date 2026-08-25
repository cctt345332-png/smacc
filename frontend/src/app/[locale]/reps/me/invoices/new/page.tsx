"use client";
/**
 * فاتورة المندوب الجديدة
 * - نفس تصميم فاتورة المبيعات الرئيسية
 * - الأصناف من مخزون المندوب فقط (مع سيريالات)
 * - بعد الحفظ: status = submitted → تنتظر موافقة المحاسب
 * - زر "إرسال للمراجعة" بدلاً من "تأكيد مباشر"
 */
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCustomers, createInvoice, getInvoice, updateInvoice, submitInvoice } from "@/lib/sales";
import { getMyStock } from "@/lib/reps";
import api from "@/lib/api";
import RepStockItemPicker, { RepPickedItem } from "@/components/inventory/RepStockItemPicker";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const today = () => new Date().toISOString().split("T")[0];

interface Line {
  picked: RepPickedItem;
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
  const priceInclVat = line.picked.unit_price || 0;  // السعر شامل الضريبة
  const disc = parseFloat(line.discount_pct) || 0;
  const taxRate = parseFloat(line.vat_rate) || 0;

  // استخراج السعر قبل الضريبة من السعر الشامل
  const divisor = taxRate > 0 ? (1 + taxRate / 100) : 1;
  const priceExcl = priceInclVat / divisor;

  const gross = qty * priceExcl;
  const discAmt = gross * (disc / 100);
  const taxable = gross - discAmt;
  const tax = taxable * (taxRate / 100);
  return { gross, discAmt, taxable, tax, total: taxable + tax, priceExcl };
}

export default function RepNewInvoicePage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const router = useRouter();
  const base = `/${locale}`;

  const [customers, setCustomers] = useState<any[]>([]);
  const [myStock, setMyStock] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    customer_id: "",
    payment_type: "cash",
    credit_days: "30",
    issue_date: today(),
    supply_date: today(),
    due_date: "",
    notes: "",
  });

  const handlePaymentTypeChange = (type: string) => {
    if (type === "cash") {
      setForm(f => ({ ...f, payment_type: type, due_date: f.issue_date }));
    } else {
      const d = new Date(form.issue_date);
      d.setDate(d.getDate() + (parseInt(form.credit_days) || 30));
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
    Promise.all([getCustomers(), getMyStock()])
      .then(([cRes, sRes]) => {
        setCustomers(Array.isArray(cRes.data) ? cRes.data : []);
        setMyStock(Array.isArray(sRes.data) ? sRes.data : []);
      })
      .catch(() => {});
  }, []);

  // ملء العميل أو فتح مسودة/فاتورة مرفوضة للتعديل
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("customer");
    if (cid) setForm(f => ({ ...f, customer_id: cid }));
    const id = params.get("draft");
    if (!id) return;
    getInvoice(id).then(({ data: inv }) => {
      if (!['draft', 'rejected'].includes(inv.status)) throw new Error(ar ? "هذه الفاتورة لم تعد قابلة للتعديل" : "This invoice is no longer editable");
      setDraftId(inv.id);
      setForm({ customer_id: inv.customer_id || "", payment_type: inv.invoice_payment_method || "cash", credit_days: String(inv.credit_days || 30), issue_date: inv.issue_date ? String(inv.issue_date).slice(0, 10) : today(), supply_date: inv.supply_date ? String(inv.supply_date).slice(0, 10) : today(), due_date: inv.due_date ? String(inv.due_date).slice(0, 10) : "", notes: inv.notes || "" });
      setLines((inv.lines || []).map((line: any) => ({ picked: { mode: "free", description_ar: line.description_ar || "", item_name: line.description_ar || "", unit_price: Number(line.unit_price || 0) * (1 + Number(line.vat_rate || 0) / 100), quantity: Number(line.quantity || 1), inventory_item_id: line.inventory_item_id || undefined, serial_item_id: line.serial_item_id || undefined, serial_ids: line.serial_ids_json ? JSON.parse(line.serial_ids_json) : undefined }, discount_pct: String(line.discount_pct || 0), vat_rate: String(line.vat_rate || 15) })) || [emptyLine()]);
    }).catch((e: any) => setError(e?.response?.data?.detail || e?.message || (ar ? "تعذر فتح المسودة" : "Could not load draft")));
  }, [ar]);

  const setLine = (i: number, field: keyof Omit<Line, "picked">, value: string) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const setPicked = (i: number, picked: RepPickedItem) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, picked } : l));

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

  const validate = () => {
    if (!form.customer_id) { setError(ar ? "يرجى اختيار العميل" : "Select a customer"); return false; }
    if (lines.every(l => !l.picked.description_ar && !l.picked.inventory_item_id)) {
      setError(ar ? "أضف صنفاً واحداً على الأقل" : "Add at least one item"); return false;
    }
    for (const l of lines) {
      if (l.picked.mode === "serial" && !l.picked.serial_ids?.length) {
        setError(ar ? "يرجى تحديد السيريالات لكل صنف مسرّل" : "Select serials for serial items");
        return false;
      }
      if (l.picked.inventory_item_id && l.picked.mode === "item") {
        const stockItem = myStock.find(s => s.item_id === l.picked.inventory_item_id || s.id === l.picked.inventory_item_id);
        if (stockItem && l.picked.quantity > Number(stockItem.quantity || stockItem.available_qty || 0)) {
          setError(ar ? `الكمية أكبر من المتاح للصنف: ${l.picked.item_name}` : `Qty exceeds stock for: ${l.picked.item_name}`);
          return false;
        }
      }
    }
    return true;
  };

  const buildPayload = () => ({
    customer_id: form.customer_id,
    invoice_type: "simplified",
    invoice_payment_method: form.payment_type,
    credit_days: form.payment_type === "credit" ? (parseInt(form.credit_days) || 30) : null,
    issue_date: form.issue_date,
    supply_date: form.supply_date,
    due_date: form.due_date || null,
    notes: form.notes || null,
    lines: lines
      .filter(l => l.picked.description_ar || l.picked.inventory_item_id)
      .map((l, i) => {
        const taxRate = parseFloat(l.vat_rate) || 0;
        const priceInclVat = l.picked.unit_price || 0;
        // استخراج السعر قبل الضريبة
        const divisor = taxRate > 0 ? (1 + taxRate / 100) : 1;
        const priceExcl = priceInclVat / divisor;
        return {
          description_ar: l.picked.description_ar || l.picked.item_name || (ar ? "صنف" : "Item"),
          quantity: l.picked.quantity || 1,
          unit_price: priceExcl,
          discount_pct: parseFloat(l.discount_pct) || 0,
          vat_rate: taxRate,
          vat_category: "S",
          line_order: i,
          inventory_item_id: l.picked.inventory_item_id || null,
          serial_item_id: l.picked.serial_item_id || null,
          serial_ids: l.picked.serial_ids || null,
        };
      }),
  });

  /* حفظ مسودة */
  const handleSaveDraft = async () => {
    if (!validate()) return;
    setSaving(true); setError("");
    try {
      if (draftId) await updateInvoice(draftId, buildPayload() as any);
      else await createInvoice(buildPayload() as any);
      router.push(`${base}/reps/me/invoices`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Error");
    } finally { setSaving(false); }
  };

  /* إرسال للمراجعة (submit) */
  const handleSubmitForReview = async () => {
    if (!validate()) return;
    setSaving(true); setError("");
    try {
      const inv = draftId ? (await updateInvoice(draftId, buildPayload() as any)).data : (await createInvoice(buildPayload() as any)).data;
      if (!inv?.id) throw new Error("خطأ في إنشاء الفاتورة");
      /* submit = تغيير الحالة لـ submitted — تنتظر المحاسب */
      await submitInvoice(inv.id);
      router.push(`${base}/reps/me/invoices`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Error");
    } finally { setSaving(false); }
  };

  return (
    <>
      {/* ── Header ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, display: "flex", gap: 6, alignItems: "center" }}>
          <Link href={`${base}/reps/dashboard`} style={{ color: "var(--text-muted)", textDecoration: "none" }}>{ar ? "الرئيسية" : "Home"}</Link>
          <span>/</span>
          <Link href={`${base}/reps/invoices`} style={{ color: "var(--text-muted)", textDecoration: "none" }}>{ar ? "الفواتير" : "Invoices"}</Link>
          <span>/</span>
          <span>{ar ? "فاتورة جديدة" : "New Invoice"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
              {ar ? "فاتورة مبيعات جديدة" : "New Sales Invoice"}
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
              {ar ? "سيتم إرسالها للمحاسب للمراجعة والموافقة" : "Will be sent to accountant for review"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={`${base}/reps/invoices`}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13, fontWeight: 600, textDecoration: "none", color: "var(--text-primary)" }}>
              {ar ? "إلغاء" : "Cancel"}
            </Link>
            <button onClick={handleSaveDraft} disabled={saving}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-primary)" }}>
              {ar ? "حفظ كمسودة" : "Save Draft"}
            </button>
            <button onClick={handleSubmitForReview} disabled={saving}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#3E0865", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              {saving ? (ar ? "جاري الإرسال..." : "Sending...") : (ar ? "إرسال للمراجعة" : "Send for Review")}
            </button>
          </div>
        </div>
      </div>

      {/* رسالة خطأ */}
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#DC2626", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#DC2626" }}>×</button>
        </div>
      )}

      {/* بانر workflow */}
      <div style={{ background: "#F4EFF7", border: "1px solid #9BBBAD", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#1E40AF" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>
          {ar
            ? "بعد الإرسال، ستنتظر الفاتورة موافقة المحاسب. يمكنك تحميل نسخة PDF بعد الموافقة."
            : "After sending, the invoice awaits accountant approval. You can download PDF after approval."}
        </span>
      </div>

      {/* ── الجزء العلوي: عمود واحد على الجوال ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>

        {/* بيانات الفاتورة */}
        <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>{ar ? "بيانات الفاتورة" : "Invoice Details"}</div>

          {/* العميل */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              {ar ? "العميل" : "Customer"} <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <select className="form-input form-select" style={{ flex: 1 }}
                value={form.customer_id}
                onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                <option value="">{ar ? "— اختر العميل —" : "— Select Customer —"}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name_ar}{c.name_en ? ` / ${c.name_en}` : ""}</option>
                ))}
              </select>
              <Link href={`${base}/reps/me/customers?action=new`}
                style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)", fontSize: 12, color: "#3E0865", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", display: "flex", alignItems: "center" }}>
                + {ar ? "عميل جديد" : "New"}
              </Link>
            </div>
          </div>

          {/* طريقة الدفع */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              {ar ? "طريقة الدفع" : "Payment"}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {["cash", "credit"].map(type => (
                <button key={type} type="button" onClick={() => handlePaymentTypeChange(type)}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 8, border: "2px solid",
                    borderColor: form.payment_type === type ? (type === "cash" ? "#3E0865" : "#D97706") : "var(--border)",
                    background: form.payment_type === type ? (type === "cash" ? "#3E0865" : "#D97706") : "var(--surface)",
                    color: form.payment_type === type ? "white" : "var(--text-primary)",
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}>
                  {type === "cash" ? (ar ? "نقدي" : "Cash") : (ar ? "آجل" : "Credit")}
                </button>
              ))}
            </div>
          </div>

          {form.payment_type === "credit" && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#92400E", display: "block", marginBottom: 6 }}>{ar ? "مدة الأجل" : "Credit Period"}</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["15", "30", "45", "60", "90"].map(d => (
                  <button key={d} type="button" onClick={() => handleCreditDaysChange(d)}
                    style={{
                      padding: "4px 10px", borderRadius: 6, border: "1px solid",
                      borderColor: form.credit_days === d ? "#D97706" : "var(--border)",
                      background: form.credit_days === d ? "#D97706" : "var(--surface)",
                      color: form.credit_days === d ? "white" : "var(--text-secondary)",
                      fontSize: 12, cursor: "pointer", fontWeight: 600,
                    }}>{d} {ar ? "يوم" : "d"}</button>
                ))}
              </div>
              {form.due_date && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#92400E", fontWeight: 600 }}>
                  {ar ? "الاستحقاق:" : "Due:"} {form.due_date}
                </div>
              )}
            </div>
          )}

          {/* التواريخ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{ar ? "تاريخ الإصدار" : "Issue Date"}</label>
              <input type="date" className="form-input" value={form.issue_date}
                onChange={e => setForm(f => ({ ...f, issue_date: e.target.value, supply_date: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{ar ? "تاريخ الاستحقاق" : "Due Date"}</label>
              <input type="date" className="form-input" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
          </div>

          {/* ملاحظات */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{ar ? "ملاحظات" : "Notes"}</label>
            <textarea className="form-input" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={ar ? "ملاحظات اختيارية..." : "Optional notes..."} />
          </div>
        </div>

        {/* ملخص الفاتورة */}
        <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{ar ? "ملخص الفاتورة" : "Summary"}</div>
          {[
            { label: ar ? "المبلغ قبل الخصم" : "Subtotal",  value: `${fmt(totals.subtotal)} SAR`, color: "var(--text-primary)" },
            { label: ar ? "الخصم" : "Discount",              value: `- ${fmt(totals.discount)} SAR`, color: "#DC2626" },
            { label: ar ? "المبلغ الخاضع للضريبة" : "Taxable",      value: `${fmt(totals.taxable)} SAR`, color: "var(--text-secondary)" },
            { label: ar ? "ضريبة القيمة المضافة" : "VAT",    value: `${fmt(totals.vat)} SAR`, color: "#D97706" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: r.color }}>
              <span>{r.label}</span><span style={{ fontWeight: 600 }}>{r.value}</span>
            </div>
          ))}
          <div style={{ borderTop: "2px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{ar ? "الإجمالي" : "Total"}</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#3E0865" }}>{fmt(totals.total)} SAR</span>
          </div>
          <button onClick={handleSubmitForReview} disabled={saving}
            style={{ marginTop: 8, width: "100%", padding: "12px", borderRadius: 10, border: "none", background: "#3E0865", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {saving ? (ar ? "جاري الإرسال..." : "Sending...") : (ar ? "إرسال للمراجعة" : "Send for Review")}
          </button>
          <button onClick={handleSaveDraft} disabled={saving}
            style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)" }}>
            {ar ? "حفظ كمسودة" : "Save as Draft"}
          </button>
        </div>
      </div>

      {/* ── أسطر الفاتورة ── */}
      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", marginBottom: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{ar ? "أسطر الفاتورة" : "Invoice Lines"}</span>
          <button onClick={addLine}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#3E0865" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {ar ? "إضافة سطر" : "Add Line"}
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg)" }}>
                <th style={{ padding: "10px 16px", textAlign: "start", fontWeight: 600, color: "var(--text-secondary)", minWidth: 240 }}>{ar ? "الصنف / الوصف" : "Item / Description"}</th>
                <th style={{ padding: "10px 8px", width: 80, fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "الكمية" : "Qty"}</th>
                <th style={{ padding: "10px 8px", width: 110, fontWeight: 600, color: "var(--text-secondary)" }}>
                  <div>{ar ? "السعر النهائي" : "Final Price"}</div>
                  <div style={{ fontSize: 10, color: "#D97706", fontWeight: 400 }}>{ar ? "شامل الضريبة" : "incl. VAT"}</div>
                </th>
                <th style={{ padding: "10px 8px", width: 80, fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "خصم%" : "Disc%"}</th>
                <th style={{ padding: "10px 8px", width: 80, fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "ضريبة%" : "VAT%"}</th>
                <th style={{ padding: "10px 16px", width: 120, textAlign: "end", fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "الإجمالي" : "Total"}</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const c = calcLine(line);
                return (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 16px", verticalAlign: "top" }}>
                      <RepStockItemPicker
                        locale={locale}
                        value={line.picked}
                        onChange={picked => setPicked(i, picked)}
                        stockItems={myStock}
                      />
                    </td>
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                      <input type="number" className="form-input" style={{ width: 70 }}
                        value={line.picked.quantity} min="0"
                        disabled={line.picked.mode === "serial"}
                        onChange={e => setPicked(i, { ...line.picked, quantity: Math.max(0, Number(e.target.value)) })} />
                    </td>
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                      <input type="number" className="form-input" style={{ width: 100 }}
                        value={line.picked.unit_price || ""}
                        placeholder="0.00"
                        min="0" step="0.01"
                        onFocus={e => e.target.select()}
                        onChange={e => setPicked(i, { ...line.picked, unit_price: e.target.value === "" ? 0 : Number(e.target.value) })} />
                    </td>
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                      <input type="number" className="form-input" style={{ width: 66 }}
                        value={line.discount_pct} min="0" max="100"
                        onChange={e => setLine(i, "discount_pct", e.target.value)} />
                    </td>
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                      <input type="number" className="form-input" style={{ width: 66 }}
                        value={line.vat_rate} min="0" max="100"
                        onChange={e => setLine(i, "vat_rate", e.target.value)} />
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "end", fontWeight: 700, color: "#3E0865", verticalAlign: "top", paddingTop: 14 }}>
                      {fmt(c.total)} SAR
                    </td>
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                      {lines.length > 1 && (
                        <button onClick={() => removeLine(i)}
                          style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                          ×
                        </button>
                      )}
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
