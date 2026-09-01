"use client";

import { useEffect, useState, use } from "react";
import { getPayment } from "@/lib/sales";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const METHOD: Record<string, string> = {
  cash: "نقداً", bank_transfer: "تحويل بنكي", cheque: "شيك",
  credit_card: "بطاقة ائتمان", mada: "مدى", stc_pay: "STC Pay",
};

export default function RepPaymentPrintPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);
  const { locale, id } = params;
  const ar = locale === "ar";
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPayment(id).then(res => setPayment(res.data)).catch(() => setPayment(null)).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (payment) {
      const timer = window.setTimeout(() => window.print(), 350);
      return () => window.clearTimeout(timer);
    }
  }, [payment]);

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>;
  if (!payment) return <div style={{ padding: 40, textAlign: "center" }}>{ar ? "السند غير موجود أو لا تملك صلاحية عرضه" : "Receipt not found or unavailable"}</div>;

  return (
    <main dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#fff", color: "#172033", fontFamily: "Arial, sans-serif", padding: 32 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <button onClick={() => window.print()} style={{ border: 0, borderRadius: 6, padding: "9px 24px", background: "#3E0865", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{ar ? "طباعة" : "Print"}</button>
      </div>
      <section style={{ maxWidth: 820, margin: "0 auto", border: "1px solid #D5C8DD" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "24px 28px", borderBottom: "2px solid #6F4A84" }}>
          <div><div style={{ fontSize: 25, fontWeight: 800, color: "#6F4A84" }}>{ar ? "سند قبض" : "Receipt Voucher"}</div><div style={{ fontSize: 12, color: "#667085", marginTop: 6 }}>{ar ? "سند تحصيل من عميل" : "Customer collection receipt"}</div></div>
          <div style={{ textAlign: ar ? "left" : "right" }}><div style={{ fontSize: 18, fontWeight: 800 }}>{payment.payment_number}</div><div style={{ fontSize: 12, color: "#667085", marginTop: 6 }}>{new Date(payment.payment_date).toLocaleDateString(ar ? "ar-SA" : "en-SA")}</div></div>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ padding: "18px 24px", borderInlineEnd: "1px solid #E5E7EB" }}><div style={{ fontSize: 11, color: "#667085", marginBottom: 7 }}>{ar ? "استلمنا من العميل" : "Received from customer"}</div><div style={{ fontSize: 16, fontWeight: 800 }}>{payment.customer_name_ar || payment.customer_id || "—"}</div></div>
          <div style={{ padding: "18px 24px" }}><div style={{ fontSize: 11, color: "#667085", marginBottom: 7 }}>{ar ? "المندوب" : "Sales rep"}</div><div style={{ fontSize: 16, fontWeight: 800 }}>{payment.rep_name || payment.rep_code || "—"}</div></div>
        </div>
        <div style={{ padding: "24px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><tbody>
            <tr><td style={{ padding: "9px 0", color: "#667085", width: "35%" }}>{ar ? "مصدر التحصيل" : "Collection source"}</td><td style={{ padding: "9px 0", fontWeight: 700 }}>{payment.invoice_id ? (ar ? "فاتورة" : "Invoice") : (ar ? "رصيد العميل" : "Customer balance")}{payment.invoice_number ? ` — ${payment.invoice_number}` : ""}</td></tr>
            <tr><td style={{ padding: "9px 0", color: "#667085" }}>{ar ? "طريقة الدفع" : "Payment method"}</td><td style={{ padding: "9px 0", fontWeight: 700 }}>{ar ? METHOD[payment.payment_method] || payment.payment_method : payment.payment_method}</td></tr>
            <tr><td style={{ padding: "9px 0", color: "#667085" }}>{ar ? "المرجع" : "Reference"}</td><td style={{ padding: "9px 0", fontWeight: 700 }}>{payment.reference || "—"}</td></tr>
          </tbody></table>
          <div style={{ marginTop: 26, border: "2px solid #E9DDF0", background: "#F7F2F8", padding: "20px", textAlign: "center" }}><div style={{ fontSize: 12, color: "#667085", marginBottom: 6 }}>{ar ? "المبلغ المقبوض" : "Amount collected"}</div><div style={{ fontSize: 32, fontWeight: 800, color: "#6F4A84" }}>{fmt(payment.amount)} <span style={{ fontSize: 14 }}>SAR</span></div></div>
          {payment.notes && <div style={{ marginTop: 22, paddingTop: 14, borderTop: "1px solid #E5E7EB", fontSize: 13 }}><strong>{ar ? "ملاحظات: " : "Notes: "}</strong>{payment.notes}</div>}
        </div>
        <footer style={{ padding: "14px 24px", borderTop: "1px solid #E5E7EB", color: "#667085", fontSize: 11, display: "flex", justifyContent: "space-between" }}><span>{ar ? "سند قبض مبيعات" : "Sales receipt"}</span><span>{payment.journal_entry_id ? (ar ? "مرتبط بقيد محاسبي" : "Journal linked") : ""}</span></footer>
      </section>
      <style jsx global>{`@media print { .no-print { display: none !important; } body { margin: 0; } main { padding: 0 !important; } }`}</style>
    </main>
  );
}
