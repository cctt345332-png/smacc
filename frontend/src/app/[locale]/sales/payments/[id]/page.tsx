"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getPayment } from "@/lib/sales";
import { Icon } from "@/components/ui/Icons";
import { useAuthStore } from "@/store/authStore";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const METHOD: Record<string, string> = {
  cash: "نقداً", bank_transfer: "تحويل بنكي", cheque: "شيك",
  credit_card: "بطاقة ائتمان", mada: "مدى", stc_pay: "STC Pay",
};

export default function SalesPaymentDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);
  const { locale, id } = params;
  const ar = locale === "ar";
  const { user } = useAuthStore();
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPayment(id).then(res => setPayment(res.data)).catch(() => setPayment(null)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="empty-state" style={{ minHeight: "60vh" }}>{ar ? "جاري تحميل السند..." : "Loading receipt..."}</div>;
  if (!payment) return (
    <div className="empty-state" style={{ minHeight: "60vh" }}>
      <div className="empty-state-title">{ar ? "السند غير موجود" : "Receipt not found"}</div>
      <Link href={`/${locale}/sales/payments`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>{ar ? "العودة للسندات" : "Back to receipts"}</Link>
    </div>
  );

  const canEdit = ["admin", "super_admin", "manager", "accountant", "sales"].includes((user as any)?.role);
  const source = payment.invoice_id ? (ar ? "فاتورة" : "Invoice") : (ar ? "رصيد العميل" : "Customer balance");

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/sales/payments`}>{ar ? "سندات القبض" : "Receipts"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{payment.payment_number}</span>
          </div>
          <h1 className="page-title">{payment.payment_number}</h1>
          <p className="page-subtitle">{ar ? "عرض تفاصيل سند القبض" : "Receipt details"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.open(`/${locale}/sales/payments/${id}/print`, "_blank")}>
            <Icon name="print" size={14} /> {ar ? "طباعة" : "Print"}
          </button>
          {canEdit && (
            <Link className="btn btn-primary btn-sm" href={`/${locale}/sales/payments/${id}/edit`}>
              <Icon name="edit" size={14} /> {ar ? "تعديل" : "Edit"}
            </Link>
          )}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ padding: "22px 28px", background: "#F7F2F8", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#6F4A84" }}>{ar ? "سند قبض" : "Receipt Voucher"}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>{payment.payment_number}</div>
          </div>
          <div style={{ textAlign: "end" }}>
            <span className="badge badge-success">{ar ? "مسجل" : "Recorded"}</span>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>{new Date(payment.payment_date).toLocaleDateString(ar ? "ar-SA" : "en-SA")}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ padding: "18px 24px", borderInlineEnd: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 7 }}>{ar ? "العميل" : "Customer"}</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{payment.customer_name_ar || payment.customer_id || "—"}</div>
          </div>
          <div style={{ padding: "18px 24px", borderInlineEnd: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 7 }}>{ar ? "مصدر السند" : "Receipt source"}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: payment.invoice_id ? "#3E0865" : "#6F4A84" }}>{source}</div>
            {payment.invoice_number && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{payment.invoice_number}</div>}
          </div>
          <div style={{ padding: "18px 24px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 7 }}>{ar ? "المندوب" : "Sales rep"}</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{payment.rep_name || payment.rep_code || "—"}</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", padding: "28px 20px" }}>
          <div style={{ minWidth: 260, textAlign: "center", padding: "20px 34px", background: "#F7F2F8", border: "2px solid #E9DDF0", borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 7 }}>{ar ? "المبلغ المقبوض" : "Amount collected"}</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: "#6F4A84" }}>{fmt(payment.amount)} <span style={{ fontSize: 15 }}>SAR</span></div>
          </div>
        </div>

        <div style={{ padding: "0 28px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{ar ? "طريقة الدفع" : "Payment method"}</div>
            <div style={{ fontWeight: 600 }}>{ar ? METHOD[payment.payment_method] || payment.payment_method : payment.payment_method}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{ar ? "المرجع" : "Reference"}</div>
            <div style={{ fontWeight: 600 }}>{payment.reference || "—"}</div>
          </div>
          {payment.notes && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{ar ? "ملاحظات" : "Notes"}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{payment.notes}</div>
            </div>
          )}
        </div>

        {payment.journal_entry_id && (
          <div style={{ padding: "13px 28px", borderTop: "1px solid var(--border)", background: "#F8FAFC", fontSize: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>{ar ? "القيد المحاسبي مرتبط بهذا السند" : "Journal entry linked to this receipt"}</span>
          </div>
        )}
      </div>
    </>
  );
}
