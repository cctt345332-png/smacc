"use client";
import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { createRefundRequest, getInvoice, getRefundRequests } from "@/lib/sales";
import { getCompany } from "@/lib/settings";
import { Icon } from "@/components/ui/Icons";
import SellerBlock from "@/components/documents/SellerBlock";
import CustomerBlock from "@/components/documents/CustomerBlock";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

function QRCodeDisplay({ data, size = 88 }: { data: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    import("qrcode").then(QRCode => {
      QRCode.toCanvas(canvasRef.current!, data, { width: size, margin: 1 }, () => {});
    });
  }, [data, size]);
  return <canvas ref={canvasRef} style={{ borderRadius: 4 }} />;
}

export default function CreditNoteDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const ar = locale === "ar";
  const [creditNote, setCreditNote] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [originalInvoice, setOriginalInvoice] = useState<any>(null);
  const [refundRequests, setRefundRequests] = useState<any[]>([]);
  const [requestingRefund, setRequestingRefund] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [cnRes, compRes] = await Promise.all([
        api.get(`/sales/credit-notes/${id}`),
        getCompany(),
      ]);
      setCreditNote(cnRes.data);
      setCompany(compRes.data);
      try {
        const refundsRes = await getRefundRequests(cnRes.data.id);
        setRefundRequests(refundsRes.data || []);
      } catch { setRefundRequests([]); }
      if (cnRes.data?.original_invoice_id) {
        const invRes = await getInvoice(cnRes.data.original_invoice_id);
        setOriginalInvoice(invRes.data);
        // جلب بيانات العميل الكاملة
        if (invRes.data?.customer_id) {
          const { getCustomer } = await import("@/lib/sales");
          const custRes = await getCustomer(invRes.data.customer_id);
          setOriginalInvoice((prev: any) => ({ ...prev, customer: custRes.data }));
        }
      }
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const requestRefund = async () => {
    if (!creditNote) return;
    const amountRaw = window.prompt(ar ? "مبلغ طلب الاسترداد (ر.س)" : "Refund request amount (SAR)", String(Number(creditNote.total || 0).toFixed(2)));
    if (amountRaw === null) return;
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) { alert(ar ? "أدخل مبلغًا صحيحًا أكبر من صفر" : "Enter a valid positive amount"); return; }
    const reason = window.prompt(ar ? "ملاحظة طلب الاسترداد (اختياري)" : "Refund request note (optional)") || undefined;
    setRequestingRefund(true);
    try {
      await createRefundRequest(creditNote.id, { amount, reason });
      await load();
      alert(ar ? "تم إنشاء طلب الاسترداد بانتظار الاعتماد. لم يُنشأ سند صرف تلقائيًا." : "Refund request created pending approval. No payment voucher was created automatically.");
    } catch (e: any) {
      alert(e?.response?.data?.detail || (ar ? "تعذر إنشاء طلب الاسترداد" : "Could not create refund request"));
    } finally { setRequestingRefund(false); }
  };

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
      </div>
    );
  }

  if (!creditNote) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-title">{ar ? "مرتجع المبيعات غير موجود" : "Sales return not found"}</div>
        <Link href={`/${locale}/sales/credit-notes`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
          {ar ? "العودة للمرتجعات" : "Back to Returns"}
        </Link>
      </div>
    );
  }

  // بيانات المشتري من الفاتورة الأصلية
  const buyerName = originalInvoice?.buyer_name_ar || creditNote.buyer_name || "—";
  const buyerVat  = originalInvoice?.buyer_vat_number || creditNote.buyer_vat_number;
  const buyerAddr = originalInvoice?.buyer_address || creditNote.buyer_address;

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/sales/credit-notes`}>{ar ? "مرتجعات المبيعات" : "Sales Returns"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{creditNote.credit_note_number}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <h1 className="page-title" style={{ color: "#DC2626" }}>{creditNote.credit_note_number}</h1>
            <span className="badge badge-danger">{ar ? "مرتجع مبيعات" : "Sales Return"}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.open(`/${locale}/sales/credit-notes/${id}/print`, "_blank")}>
            <Icon name="print" size={14} />
            {ar ? "طباعة" : "Print"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={requestRefund} disabled={requestingRefund}>
            <Icon name="money" size={14} />
            {requestingRefund ? (ar ? "جاري الإرسال..." : "Sending...") : (ar ? "طلب استرداد" : "Request refund")}
          </button>
        </div>
      </div>

      {/* Document Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        {/* ── رأس المستند ── */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border)", background: "#FFF5F5" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            {/* يسار: شعار + عنوان */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              {company?.logo_data && (
                <img src={company.logo_data} alt="Logo" style={{ height: 52, objectFit: "contain", borderRadius: 6 }} />
              )}
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#DC2626" }}>
                  {ar ? "مرتجع مبيعات" : "Sales Return — مرتجع مبيعات"}
                </div>
                <div style={{ fontSize: 12, color: "#DC2626", marginTop: 2, opacity: 0.7 }}>
                  {ar ? "إشعار دائن ضريبي — ZATCA" : "Tax Credit Note — ZATCA"}
                </div>
              </div>
            </div>

            {/* وسط: QR Code */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {creditNote.qr_code ? (
                <QRCodeDisplay data={creditNote.qr_code} size={88} />
              ) : (
                <div style={{ width: 88, height: 88, border: "1px dashed #FCA5A5", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "white" }}>
                  <span style={{ fontSize: 10, color: "#FCA5A5" }}>QR</span>
                </div>
              )}
              <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{ar ? "رمز الاستجابة السريعة" : "ZATCA QR"}</div>
            </div>

            {/* يمين: الرقم والتواريخ */}
            <div style={{ textAlign: "end" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#DC2626" }}>{creditNote.credit_note_number}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {ar ? "تاريخ الإصدار:" : "Issue Date:"} {new Date(creditNote.issue_date).toLocaleDateString("en-SA")}
              </div>
              {originalInvoice && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {ar ? "الفاتورة الأصلية:" : "Original Invoice:"}{" "}
                  <Link href={`/${locale}/sales/invoices/${originalInvoice.id}`} style={{ color: "#DC2626", fontWeight: 600 }}>
                    {originalInvoice.invoice_number}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── الشركة والعميل ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--border)" }}>
          {/* الشركة (البائع) */}
          <div style={{ padding: "18px 28px", borderInlineEnd: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.08em" }}>
              {ar ? "الشركة / Seller" : "Seller / الشركة"}
            </div>
            <SellerBlock company={company} ar={ar} />
          </div>

          {/* العميل (من الفاتورة الأصلية) */}
          <div style={{ padding: "18px 28px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.08em" }}>
              {ar ? "العميل / Customer" : "Customer / العميل"}
            </div>
            <CustomerBlock customer={originalInvoice?.customer || {
              name_ar: buyerName,
              vat_number: buyerVat,
              address_city: null,
              phone: null, email: null,
            }} ar={ar} />
          </div>
        </div>

        {/* ── سبب الإشعار ── */}
        {creditNote.reason && (
          <div style={{ padding: "14px 28px", borderBottom: "1px solid var(--border)", background: "#FEF2F2" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>
              {ar ? "سبب الإرجاع: " : "Return Reason: "}
            </span>
            <span style={{ fontSize: 13, color: "#7F1D1D" }}>{creditNote.reason}</span>
          </div>
        )}

        {/* ── جدول الأسطر ── */}
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{ar ? "الوصف" : "Description"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "سعر الوحدة" : "Unit Price"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "ضريبة%" : "VAT%"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "قبل الضريبة" : "Subtotal"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الضريبة" : "VAT"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
              </tr>
            </thead>
            <tbody>
              {(creditNote.lines || []).map((line: any, i: number) => (
                <tr key={i}>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{line.description_ar}</div>
                    {line.description_en && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{line.description_en}</div>}
                  </td>
                  <td style={{ textAlign: "end" }}>{fmt(line.quantity)}</td>
                  <td style={{ textAlign: "end" }}>{fmt(line.unit_price)}</td>
                  <td style={{ textAlign: "end" }}>{line.vat_rate ?? 15}%</td>
                  <td style={{ textAlign: "end", color: "#DC2626" }}>{fmt(line.subtotal)}</td>
                  <td style={{ textAlign: "end", color: "#DC2626" }}>{fmt(line.vat_amount)}</td>
                  <td style={{ textAlign: "end", fontWeight: 700, color: "#DC2626" }}>{fmt(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── الإجماليات (بالأحمر) ── */}
        <div style={{ padding: "20px 28px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 300, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{ar ? "المجموع قبل الضريبة" : "Subtotal (excl. VAT)"}</span>
              <span style={{ color: "#DC2626" }}>- {fmt(creditNote.subtotal)} SAR</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: "var(--text-secondary)" }}>{ar ? "ضريبة القيمة المضافة" : "VAT"}</span>
              <span style={{ color: "#DC2626" }}>- {fmt(creditNote.vat_amount)} SAR</span>
            </div>
            <div style={{ height: 1, background: "#FECACA" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800 }}>
              <span>{ar ? "إجمالي الإشعار" : "CREDIT TOTAL"}</span>
              <span style={{ color: "#DC2626" }}>- {fmt(creditNote.total)} SAR</span>
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 28px", borderTop: "1px solid var(--border)", background: "#FFFEFA" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{ar ? "طلبات الاسترداد" : "Refund requests"}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 3 }}>{ar ? `المقبوض على الفاتورة الأصلية: ${fmt(originalInvoice?.paid_amount)} SAR. الاعتماد لا ينشئ سند صرف تلقائيًا.` : `Paid on original invoice: ${fmt(originalInvoice?.paid_amount)} SAR. Approval does not create a payment voucher automatically.`}</div>
            </div>
            <span className="badge badge-gray">{refundRequests.length} {ar ? "طلب" : "requests"}</span>
          </div>
          {refundRequests.length > 0 && <div className="table-wrapper" style={{ marginTop: 10 }}><table><thead><tr><th>{ar ? "المبلغ" : "Amount"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "السبب" : "Reason"}</th><th>{ar ? "تاريخ الطلب" : "Requested at"}</th></tr></thead><tbody>{refundRequests.map((request: any) => <tr key={request.id}><td style={{ fontFamily: "monospace", fontWeight: 700 }}>{fmt(request.amount)} SAR</td><td>{request.status === "requested" ? (ar ? "بانتظار الاعتماد" : "Pending") : request.status === "approved" ? (ar ? "مُعتمد" : "Approved") : request.status === "rejected" ? (ar ? "مرفوض" : "Rejected") : request.status}</td><td>{request.reason || "—"}</td><td>{request.created_at ? new Date(request.created_at).toLocaleDateString("en-SA") : "—"}</td></tr>)}</tbody></table></div>}
        </div>

        {/* UUID */}
        {creditNote.uuid && (
          <div style={{ padding: "10px 28px", borderTop: "1px solid var(--border)", background: "#FFF5F5" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>UUID: </span>
            <code style={{ fontSize: 11, color: "#DC2626" }}>{creditNote.uuid}</code>
          </div>
        )}
      </div>
    </>
  );
}
