"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getPayments, createPayment, getInvoices } from "@/lib/sales";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const METHODS: Record<string, { ar: string; en: string }> = {
  cash:          { ar: "نقداً",         en: "Cash" },
  bank_transfer: { ar: "تحويل بنكي",    en: "Bank Transfer" },
  cheque:        { ar: "شيك",           en: "Cheque" },
  credit_card:   { ar: "بطاقة ائتمان", en: "Credit Card" },
  mada:          { ar: "مدى",           en: "Mada" },
  stc_pay:       { ar: "STC Pay",       en: "STC Pay" },
};

const emptyForm = {
  invoice_id: "",
  payment_date: new Date().toISOString().split("T")[0],
  amount: "",
  payment_method: "cash",
  reference: "",
  notes: "",
};

export default function PaymentsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    try {
      const { data } = await getPayments();
      setPayments(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  };

  const loadInvoices = async () => {
    try {
      // جلب الفواتير المؤكدة وغير المدفوعة بالكامل
      const { data } = await getInvoices({ status: "confirmed" });
      setInvoices(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const openModal = () => {
    loadInvoices();
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (!form.invoice_id) return alert(ar ? "اختر الفاتورة" : "Select an invoice");
    if (!form.amount || Number(form.amount) <= 0) return alert(ar ? "أدخل مبلغاً صحيحاً" : "Enter valid amount");
    setSaving(true);
    try {
      await createPayment({
        ...form,
        amount: parseFloat(form.amount),
        payment_date: new Date(form.payment_date).toISOString(),
        reference: form.reference || null,
        notes: form.notes || null,
      });
      setShowModal(false);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Error");
    } finally { setSaving(false); }
  };

  const total = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/sales`}>{ar ? "المبيعات" : "Sales"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "سندات القبض" : "Receipts"}</span>
          </div>
          <h1 className="page-title">{ar ? "سندات القبض" : "Receipt Payments"}</h1>
          <p className="page-subtitle">{ar ? "المبالغ المقبوضة من العملاء مقابل الفواتير" : "Payments collected from customers against invoices"}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openModal}>
          <Icon name="plus" size={14} /> {ar ? "سند قبض جديد" : "New Receipt"}
        </button>
      </div>

      {/* إحصائيات */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          { label: ar ? "إجمالي المقبوض" : "Total Collected", value: `${fmt(total)} SAR`, color: "#059669" },
          { label: ar ? "عدد السندات" : "Total Receipts", value: payments.length, color: "#2563EB" },
          { label: ar ? "آخر قبض" : "Latest", value: payments[0] ? new Date(payments[0].payment_date).toLocaleDateString("ar-SA") : "—", color: "#7C3AED" },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-content">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* الجدول */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state">
              <div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
            </div>
          ) : payments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{ar ? "لا توجد سندات قبض" : "No receipts yet"}</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={openModal}>
                + {ar ? "سند جديد" : "New Receipt"}
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم السند" : "Receipt #"}</th>
                  <th>{ar ? "رقم الفاتورة" : "Invoice #"}</th>
                  <th>{ar ? "العميل" : "Customer"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "طريقة الدفع" : "Method"}</th>
                  <th>{ar ? "المرجع" : "Reference"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#059669" }}>
                        {p.payment_number}
                      </span>
                    </td>
                    <td>
                      <Link href={`/${locale}/sales/invoices/${p.invoice_id}`}
                        style={{ color: "var(--primary)", textDecoration: "none", fontSize: 12 }}>
                        {p.invoice_id?.slice(-8)}
                      </Link>
                    </td>
                    <td style={{ fontSize: 13 }}>{p.customer_id?.slice(-8) || "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {new Date(p.payment_date).toLocaleDateString("ar-SA")}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: 11 }}>
                        {ar ? METHODS[p.payment_method]?.ar : METHODS[p.payment_method]?.en || p.payment_method}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.reference || "—"}</td>
                    <td style={{ textAlign: "end", fontWeight: 700, color: "#059669" }}>
                      {fmt(p.amount)} SAR
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                  <td colSpan={6} style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                  <td style={{ textAlign: "end", padding: "12px 16px", color: "#059669" }}>
                    {fmt(total)} SAR
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Modal سند قبض جديد */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 480 }} className="animate-slide">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "سند قبض جديد" : "New Receipt"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* الفاتورة */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "الفاتورة" : "Invoice"} <span className="required">*</span></label>
                <select className="form-input form-select" value={form.invoice_id}
                  onChange={e => {
                    const inv = invoices.find((i: any) => i.id === e.target.value);
                    setForm(f => ({
                      ...f,
                      invoice_id: e.target.value,
                      amount: inv ? String(Number(inv.total) - Number(inv.paid_amount)) : f.amount,
                    }));
                  }}>
                  <option value="">{ar ? "— اختر الفاتورة —" : "— Select Invoice —"}</option>
                  {invoices.map((inv: any) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.buyer_name_ar} — {fmt(Number(inv.total) - Number(inv.paid_amount))} SAR
                    </option>
                  ))}
                </select>
              </div>

              {/* التاريخ والمبلغ */}
              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{ar ? "تاريخ القبض" : "Payment Date"} <span className="required">*</span></label>
                  <input type="date" className="form-input" value={form.payment_date}
                    onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{ar ? "المبلغ" : "Amount"} <span className="required">*</span></label>
                  <input type="number" className="form-input" value={form.amount} min="0.01" step="0.01"
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>

              {/* طريقة الدفع */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "طريقة الدفع" : "Payment Method"} <span className="required">*</span></label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.entries(METHODS).map(([key, label]) => (
                    <button key={key} type="button"
                      onClick={() => setForm(f => ({ ...f, payment_method: key }))}
                      style={{
                        padding: "6px 12px", borderRadius: 8, border: "2px solid",
                        borderColor: form.payment_method === key ? "var(--primary)" : "var(--border)",
                        background: form.payment_method === key ? "var(--primary)" : "white",
                        color: form.payment_method === key ? "white" : "var(--text-primary)",
                        fontWeight: 600, fontSize: 12, cursor: "pointer",
                      }}>
                      {ar ? label.ar : label.en}
                    </button>
                  ))}
                </div>
              </div>

              {/* المرجع والملاحظات */}
              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{ar ? "رقم المرجع" : "Reference"}</label>
                  <input className="form-input" value={form.reference} placeholder={ar ? "رقم الشيك / التحويل..." : "Cheque / transfer no..."}
                    onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
                  <input className="form-input" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>

              {/* أزرار */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {ar ? "إلغاء" : "Cancel"}
                </button>
                <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                  <Icon name="check" size={14} />
                  {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
