"use client";
import { useEffect, useState } from "react";
import { getMyPayments } from "@/lib/reps";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const methodLabel: Record<string, { ar: string; en: string }> = {
  cash: { ar: "نقداً", en: "Cash" },
  bank_transfer: { ar: "تحويل بنكي", en: "Bank Transfer" },
  cheque: { ar: "شيك", en: "Cheque" },
  credit_card: { ar: "بطاقة", en: "Card" },
  mada: { ar: "مدى", en: "Mada" },
  stc_pay: { ar: "STC Pay", en: "STC Pay" },
};

export default function RepPaymentsPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyPayments()
      .then((res) => setPayments(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const total = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "سندات قبضي" : "My Receipts"}</h1>
          <p className="page-subtitle">
            {ar ? "كل المبالغ التي قبضتها من العملاء" : "All payments collected from customers"}
          </p>
        </div>
        {payments.length > 0 && (
          <div
            style={{
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--text-secondary)" }}>{ar ? "إجمالي المقبوض: " : "Total Collected: "}</span>
            <strong style={{ color: "#059669" }}>{fmt(total)} SAR</strong>
          </div>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {ar ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : payments.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {ar ? "لا توجد سندات قبض بعد" : "No receipts yet"}
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم السند" : "Receipt #"}</th>
                  <th>{ar ? "رقم الفاتورة" : "Invoice #"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "طريقة الدفع" : "Method"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{p.payment_number}</span>
                    </td>
                    <td style={{ color: "#2563EB", fontSize: 12 }}>{p.invoice_id?.slice(-8)}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                      {new Date(p.payment_date).toLocaleDateString("ar-SA")}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: 11 }}>
                        {ar
                          ? methodLabel[p.payment_method]?.ar || p.payment_method
                          : methodLabel[p.payment_method]?.en || p.payment_method}
                      </span>
                    </td>
                    <td style={{ textAlign: "end", fontWeight: 700, color: "#059669" }}>
                      {fmt(p.amount)} SAR
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--bg-secondary)" }}>
                  <td colSpan={4} style={{ fontWeight: 700 }}>
                    {ar ? "الإجمالي" : "Total"}
                  </td>
                  <td style={{ textAlign: "end", fontWeight: 800, color: "#059669" }}>
                    {fmt(total)} SAR
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
