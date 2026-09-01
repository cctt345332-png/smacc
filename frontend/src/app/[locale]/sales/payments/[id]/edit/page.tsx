"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPayment, updatePayment } from "@/lib/sales";

const METHOD: Record<string, string> = {
  cash: "نقداً", bank_transfer: "تحويل بنكي", cheque: "شيك",
  credit_card: "بطاقة ائتمان", mada: "مدى", stc_pay: "STC Pay",
};

export default function EditSalesPaymentPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);
  const { locale, id } = params;
  const ar = locale === "ar";
  const router = useRouter();
  const [payment, setPayment] = useState<any>(null);
  const [form, setForm] = useState({ payment_date: "", amount: "", payment_method: "cash", reference: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getPayment(id).then(res => {
      const value = res.data;
      setPayment(value);
      setForm({
        payment_date: String(value.payment_date || "").slice(0, 10),
        amount: String(value.amount || ""),
        payment_method: value.payment_method || "cash",
        reference: value.reference || "",
        notes: value.notes || "",
      });
    }).catch((e: any) => setError(e?.response?.data?.detail || (ar ? "تعذر تحميل السند" : "Could not load receipt"))).finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    if (!form.payment_date || !form.amount || Number(form.amount) <= 0) {
      setError(ar ? "أدخل التاريخ والمبلغ بشكل صحيح" : "Enter a valid date and amount");
      return;
    }
    setSaving(true); setError("");
    try {
      await updatePayment(id, {
        payment_date: new Date(`${form.payment_date}T00:00:00`).toISOString(),
        amount: Number(form.amount),
        payment_method: form.payment_method,
        reference: form.reference || null,
        notes: form.notes || null,
      });
      router.push(`/${locale}/sales/payments/${id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || (ar ? "تعذر حفظ التعديل" : "Could not save changes"));
    } finally { setSaving(false); }
  };

  if (loading) return <div className="empty-state" style={{ minHeight: "60vh" }}>{ar ? "جاري تحميل السند..." : "Loading receipt..."}</div>;
  if (!payment) return <div className="empty-state" style={{ minHeight: "60vh" }}><div className="empty-state-title">{error || (ar ? "السند غير موجود" : "Receipt not found")}</div><Link href={`/${locale}/sales/payments`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>{ar ? "العودة" : "Back"}</Link></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><Link href={`/${locale}/sales/payments`}>{ar ? "سندات القبض" : "Receipts"}</Link><span className="breadcrumb-sep">/</span><Link href={`/${locale}/sales/payments/${id}`}>{payment.payment_number}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "تعديل" : "Edit"}</span></div>
          <h1 className="page-title">{ar ? `تعديل ${payment.payment_number}` : `Edit ${payment.payment_number}`}</h1>
          <p className="page-subtitle">{ar ? "تعديل بيانات سند القبض من الإدارة" : "Edit receipt details from administration"}</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ padding: "18px 24px", background: "#F7F2F8", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 800, color: "#6F4A84" }}>{payment.customer_name_ar || payment.customer_id}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 5 }}>{payment.invoice_id ? `${ar ? "فاتورة" : "Invoice"}: ${payment.invoice_number || payment.invoice_id}` : (ar ? "تحصيل مباشر من رصيد العميل" : "Direct customer balance collection")}</div>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 13 }}>{error}</div>}
          <div className="form-group" style={{ margin: 0 }}><label className="form-label">{ar ? "التاريخ" : "Date"}</label><input type="date" className="form-input" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} /></div>
          <div className="form-group" style={{ margin: 0 }}><label className="form-label">{ar ? "المبلغ" : "Amount"}</label><input type="number" min="0.01" step="0.01" className="form-input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
          <div className="form-group" style={{ margin: 0 }}><label className="form-label">{ar ? "طريقة الدفع" : "Payment method"}</label><select className="form-input form-select" disabled={Boolean(payment.journal_entry_id)} value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>{Object.entries(METHOD).map(([value, label]) => <option key={value} value={value}>{ar ? label : value}</option>)}</select>{payment.journal_entry_id && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>{ar ? "لا يمكن تغيير طريقة الدفع بعد ترحيل القيد المحاسبي." : "Payment method cannot change after journal posting."}</div>}</div>
          <div className="form-group" style={{ margin: 0 }}><label className="form-label">{ar ? "المرجع" : "Reference"}</label><input className="form-input" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder={ar ? "رقم الشيك أو التحويل" : "Cheque or transfer reference"} /></div>
          <div className="form-group" style={{ margin: 0 }}><label className="form-label">{ar ? "ملاحظات" : "Notes"}</label><textarea className="form-input" rows={4} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}><Link href={`/${locale}/sales/payments/${id}`} className="btn btn-secondary">{ar ? "إلغاء" : "Cancel"}</Link><button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التعديل" : "Save changes")}</button></div>
        </div>
      </div>
    </>
  );
}
