"use client";
import { useEffect, useState } from "react";
import { getMyPayments } from "@/lib/reps";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const METHOD: Record<string, { ar: string; color: string; bg: string }> = {
  cash:          { ar: "نقداً",       color: "#059669", bg: "#D1FAE5" },
  bank_transfer: { ar: "تحويل بنكي", color: "#2563EB", bg: "#DBEAFE" },
  cheque:        { ar: "شيك",        color: "#7C3AED", bg: "#EDE9FE" },
  credit_card:   { ar: "بطاقة",      color: "#0891B2", bg: "#CFFAFE" },
  mada:          { ar: "مدى",        color: "#059669", bg: "#D1FAE5" },
  stc_pay:       { ar: "STC Pay",    color: "#7C3AED", bg: "#EDE9FE" },
};

export default function RepPaymentsPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyPayments()
      .then(res => setPayments(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{ar ? "سندات قبضي" : "My Receipts"}</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            {payments.length} {ar ? "سند" : "receipts"}
          </p>
        </div>
      </div>

      {/* بطاقة الإجمالي */}
      {payments.length > 0 && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 14,
          padding: "14px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#065F46", fontWeight: 600 }}>
            {ar ? "إجمالي المقبوض" : "Total Collected"}
          </span>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#059669" }}>
            {fmt(total)} SAR
          </span>
        </div>
      )}

      {/* القائمة */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          {ar ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : payments.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ marginBottom: 8 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto", display: "block" }}>
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {ar ? "لا توجد سندات قبض بعد" : "No receipts yet"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {payments.map((p: any) => {
            const m = METHOD[p.payment_method] || { ar: p.payment_method, color: "#6B7280", bg: "#F3F4F6" };
            return (
              <div key={p.id} style={{ background: "var(--surface)", borderRadius: 14,
                padding: "14px 16px", border: "1px solid var(--border)",
                display: "flex", alignItems: "center", gap: 14 }}>

                {/* أيقونة طريقة الدفع */}
                <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: m.bg, display: "flex", alignItems: "center",
                  justifyContent: "center", color: m.color }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                </div>

                {/* البيانات */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#2563EB" }}>
                      {p.payment_number || `#${p.id?.slice(-6)}`}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 15, color: "#059669" }}>
                      + {fmt(p.amount)} SAR
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px",
                        borderRadius: 20, background: m.bg, color: m.color }}>
                        {ar ? m.ar : p.payment_method}
                      </span>
                      {p.reference && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                          {p.reference}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {fmtDate(p.payment_date)}
                    </span>
                  </div>
                  {p.invoice_number && (
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>
                      {ar ? "فاتورة:" : "Invoice:"}{" "}
                      <span style={{ fontFamily: "monospace", color: "#2563EB" }}>{p.invoice_number}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
