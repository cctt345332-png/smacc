"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyInvoices } from "@/lib/reps";
import api from "@/lib/api";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

/* ── زر تحميل PDF ────────────────────────────────────────────────── */
function PDFButton({ invoiceId, invoiceNumber, locale }: { invoiceId: string; invoiceNumber: string; locale: string }) {
  const ar = locale === "ar";
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sales/invoices/${invoiceId}/pdf`, { responseType: "text" });
      const blob = new Blob([res.data], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      alert(ar ? "تعذّر تحميل PDF" : "Could not download PDF");
    } finally { setLoading(false); }
  };

  return (
    <button onClick={handleDownload} disabled={loading}
      style={{
        width: "100%", padding: "12px", borderRadius: 10, border: "1px solid #BFDBFE",
        background: "#EFF6FF", color: "#2563EB", fontWeight: 700, fontSize: 14,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      {loading ? (ar ? "جاري التحميل..." : "Downloading...") : (ar ? "تحميل PDF" : "Download PDF")}
    </button>
  );
}

const STATUS: Record<string, { ar: string; color: string; bg: string }> = {
  draft:     { ar: "مسودة",              color: "#6B7280", bg: "#F3F4F6" },
  submitted: { ar: "بانتظار المراجعة",   color: "#D97706", bg: "#FEF3C7" },
  approved:  { ar: "موافق عليها",        color: "#2563EB", bg: "#EFF6FF" },
  rejected:  { ar: "مرفوضة",             color: "#DC2626", bg: "#FEF2F2" },
  confirmed: { ar: "مؤكدة",              color: "#059669", bg: "#F0FDF4" },
  paid:      { ar: "مدفوعة",             color: "#059669", bg: "#F0FDF4" },
  partial:   { ar: "جزئي",               color: "#D97706", bg: "#FEF3C7" },
  overdue:   { ar: "متأخرة",             color: "#DC2626", bg: "#FEF2F2" },
  cancelled: { ar: "ملغاة",              color: "#6B7280", bg: "#F3F4F6" },
};

/* ── modal عرض الفاتورة ─────────────────────────────────────────── */
function InvoiceModal({ inv, locale, onClose }: { inv: any; locale: string; onClose: () => void }) {
  const ar = locale === "ar";
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/sales/invoices/${inv.id}`)
      .then(r => setDetail(r.data))
      .catch(() => setDetail(inv))
      .finally(() => setLoading(false));
  }, [inv.id]);

  const st = STATUS[inv.status] || STATUS.draft;
  const data = detail || inv;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 800,
      display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0",
        width: "100%", maxWidth: 580, maxHeight: "92vh", overflowY: "auto",
        padding: "0 0 32px" }}
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div style={{ padding: "14px 20px 0", textAlign: "center" }}>
          <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 16px" }} />
        </div>

        {/* رأس الـ modal */}
        <div style={{ padding: "0 20px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 18, color: "#2563EB" }}>
              {inv.invoice_number}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{data.buyer_name_ar}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
              background: st.bg, color: st.color }}>
              {ar ? st.ar : inv.status}
            </span>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8,
              border: "1px solid var(--border)", background: "transparent", cursor: "pointer",
              fontSize: 18, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              ×
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {ar ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : (
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

            {/* بيانات أساسية */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: ar ? "التاريخ" : "Date",        value: fmtDate(data.issue_date) },
                { label: ar ? "طريقة الدفع" : "Payment", value: data.payment_type === "cash" ? (ar ? "نقدي" : "Cash") : (ar ? "آجل" : "Credit") },
                { label: ar ? "تاريخ الاستحقاق" : "Due", value: fmtDate(data.due_date) },
                { label: ar ? "الفرع" : "Branch",        value: data.warehouse_name || "—" },
              ].map(f => (
                <div key={f.label} style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{f.label}</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{f.value}</div>
                </div>
              ))}
            </div>

            {/* سبب الرفض */}
            {data.status === "rejected" && data.rejection_note && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10,
                padding: "10px 14px", color: "#DC2626", fontSize: 13 }}>
                <strong>{ar ? "سبب الرفض: " : "Rejection reason: "}</strong>
                {data.rejection_note}
              </div>
            )}

            {/* أسطر الفاتورة */}
            {data.lines && data.lines.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  {ar ? "أسطر الفاتورة" : "Invoice Lines"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {data.lines.map((line: any, i: number) => (
                    <div key={i} style={{ background: "var(--bg)", borderRadius: 10,
                      padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {line.description_ar}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {line.quantity} × {fmt(line.unit_price)} SAR
                          {line.discount_pct > 0 && ` — خصم ${line.discount_pct}%`}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#2563EB", flexShrink: 0, marginInlineStart: 12 }}>
                        {fmt(line.total || (line.quantity * line.unit_price))} SAR
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ملخص المبالغ */}
            <div style={{ background: "var(--bg)", borderRadius: 12, padding: "14px 16px",
              display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: ar ? "المبلغ قبل الضريبة" : "Subtotal", value: fmt(data.subtotal || 0), color: "var(--text-primary)" },
                { label: ar ? "الخصم" : "Discount",              value: `- ${fmt(data.discount_amount || 0)}`, color: "#DC2626" },
                { label: ar ? "ضريبة القيمة المضافة" : "VAT",    value: fmt(data.vat_amount || 0), color: "#D97706" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{r.label}</span>
                  <span style={{ fontWeight: 600, color: r.color }}>{r.value} SAR</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4,
                display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{ar ? "الإجمالي" : "Total"}</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: "#2563EB" }}>{fmt(data.total)} SAR</span>
              </div>
              {Number(data.paid_amount || 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#059669", fontWeight: 600 }}>{ar ? "المدفوع" : "Paid"}</span>
                  <span style={{ fontWeight: 700, color: "#059669" }}>{fmt(data.paid_amount)} SAR</span>
                </div>
              )}
              {Number(data.total || 0) - Number(data.paid_amount || 0) > 0.01 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#DC2626", fontWeight: 600 }}>{ar ? "المتبقي" : "Remaining"}</span>
                  <span style={{ fontWeight: 700, color: "#DC2626" }}>
                    {fmt(Number(data.total || 0) - Number(data.paid_amount || 0))} SAR
                  </span>
                </div>
              )}
            </div>

            {/* ملاحظات */}
            {data.notes && (
              <div style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>
                  {ar ? "ملاحظات" : "Notes"}
                </div>
                <div style={{ fontSize: 13 }}>{data.notes}</div>
              </div>
            )}

            {/* زر تحميل PDF — بعد الموافقة */}
            {["approved", "confirmed", "paid", "partial"].includes(inv.status) && (
              <PDFButton invoiceId={inv.id} invoiceNumber={inv.invoice_number} locale={locale} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function RepInvoicesPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    getMyInvoices()
      .then(res => setInvoices(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{ar ? "فواتيري" : "My Invoices"}</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            {invoices.length} {ar ? "فاتورة" : "invoices"}
          </p>
        </div>
        <Link href={`/${locale}/reps/me/invoices/new`}
          style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#2563EB",
            color: "white", fontWeight: 700, fontSize: 13, textDecoration: "none",
            display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {ar ? "فاتورة جديدة" : "New Invoice"}
        </Link>
      </div>

      {/* القائمة */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          {ar ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : invoices.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
            {ar ? "لا توجد فواتير بعد" : "No invoices yet"}
          </div>
          <Link href={`/${locale}/reps/me/invoices/new`}
            style={{ padding: "10px 20px", borderRadius: 10, background: "#2563EB",
              color: "white", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
            + {ar ? "إنشاء فاتورة" : "Create Invoice"}
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {invoices.map((inv: any) => {
            const st = STATUS[inv.status] || STATUS.draft;
            const remaining = Number(inv.total || 0) - Number(inv.paid_amount || 0);
            return (
              <div key={inv.id} onClick={() => setSelected(inv)}
                style={{ background: "var(--surface)", borderRadius: 14, padding: "14px 16px",
                  border: "1px solid var(--border)", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 14,
                  transition: "border-color 0.15s" }}
                onTouchStart={e => (e.currentTarget.style.borderColor = st.color)}
                onTouchEnd={e => (e.currentTarget.style.borderColor = "var(--border)")}
                onMouseEnter={e => (e.currentTarget.style.borderColor = st.color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>

                {/* أيقونة الحالة */}
                <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: st.bg, display: "flex", alignItems: "center",
                  justifyContent: "center", color: st.color }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>

                {/* البيانات */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#2563EB" }}>
                      {inv.invoice_number}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{fmt(inv.total)} SAR</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>
                      {inv.buyer_name_ar} · {fmtDate(inv.issue_date)}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px",
                      borderRadius: 20, background: st.bg, color: st.color, flexShrink: 0 }}>
                      {ar ? st.ar : inv.status}
                    </span>
                  </div>
                  {remaining > 0.01 && inv.status !== "cancelled" && (
                    <div style={{ fontSize: 11, color: "#DC2626", marginTop: 3, fontWeight: 600 }}>
                      {ar ? "متبقي:" : "Due:"} {fmt(remaining)} SAR
                    </div>
                  )}
                </div>

                {/* سهم */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal تفاصيل الفاتورة */}
      {selected && (
        <InvoiceModal inv={selected} locale={locale} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
