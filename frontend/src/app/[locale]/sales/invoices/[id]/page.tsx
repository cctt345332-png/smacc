"use client";
import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { getInvoice, confirmInvoice, createPayment, getPayments } from "@/lib/sales";
import { Icon } from "@/components/ui/Icons";
import SellerBlock from "@/components/documents/SellerBlock";
import CustomerBlock from "@/components/documents/CustomerBlock";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

// QR Code component — يولد QR من الـ TLV base64
function QRCodeDisplay({ data, size = 96 }: { data: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    import("qrcode").then(QRCode => {
      QRCode.toCanvas(canvasRef.current!, data, { width: size, margin: 1, errorCorrectionLevel: "M" }, () => {});
    });
  }, [data, size]);
  return <canvas ref={canvasRef} style={{ borderRadius: 4 }} />;
}

const STATUS_MAP: Record<string, { ar: string; badge: string }> = {
  draft:         { ar: "مسودة",   badge: "badge-warning" },
  confirmed:     { ar: "مؤكدة",   badge: "badge-info" },
  paid:          { ar: "مدفوعة",  badge: "badge-success" },
  cancelled:     { ar: "ملغاة",   badge: "badge-danger" },
  partial:       { ar: "جزئية",   badge: "badge-warning" },
  zatca_cleared: { ar: "زاتكا ✓", badge: "badge-success" },
};

const PAYMENT_METHODS = [
  { value: "cash",          ar: "نقداً",           en: "Cash" },
  { value: "bank_transfer", ar: "تحويل بنكي",      en: "Bank Transfer" },
  { value: "cheque",        ar: "شيك",             en: "Cheque" },
  { value: "mada",          ar: "مدى",             en: "Mada" },
  { value: "stc_pay",       ar: "STC Pay",         en: "STC Pay" },
];

const emptyPayment = {
  amount: "",
  payment_method: "bank_transfer",
  reference: "",
  payment_date: new Date().toISOString().split("T")[0],
  bank_account_id: "",
};

export default function InvoiceDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const ar = locale === "ar";
  const [invoice, setInvoice] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ ...emptyPayment });
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const load = async () => {
    try {
      const [invRes, payRes, compRes, banksRes] = await Promise.all([
        getInvoice(id),
        getPayments(id),
        import("@/lib/settings").then(m => m.getCompany()),
        import("@/lib/accounting").then(m => m.getBankAccounts()),
      ]);
      setInvoice(invRes.data);
      setPayments(payRes.data);
      setCompany(compRes.data);
      setBankAccounts(banksRes.data || []);
      // جلب بيانات العميل الكاملة
      if (invRes.data?.customer_id) {
        const { getCustomer } = await import("@/lib/sales");
        const custRes = await getCustomer(invRes.data.customer_id);
        setInvoice((prev: any) => ({ ...prev, customer: custRes.data }));
      }
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  // طباعة تلقائية إذا جاء ?print=1
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("print") === "1" && invoice) {
        window.location.replace(`/${locale}/sales/invoices/${id}/print`);
      }
    }
  }, [invoice]);

  const handleConfirm = async () => {
    if (!confirm(ar ? "تأكيد الفاتورة؟" : "Confirm this invoice?")) return;
    setActing(true);
    try { await confirmInvoice(id); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(false); }
  };

  const handleAddPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) {
      return alert(ar ? "يرجى إدخال مبلغ صحيح" : "Please enter a valid amount");
    }
    setSaving(true);
    try {
      await createPayment({
        invoice_id: id,
        amount: parseFloat(payForm.amount),
        payment_method: payForm.payment_method,
        reference: payForm.reference || null,
        payment_date: payForm.payment_date,
        bank_account_id: payForm.bank_account_id || null,
      });
      setShowPayModal(false);
      setPayForm({ ...emptyPayment });
      load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Error");
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-title">{ar ? "الفاتورة غير موجودة" : "Invoice not found"}</div>
        <Link href={`/${locale}/sales/invoices`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
          {ar ? "العودة للفواتير" : "Back to Invoices"}
        </Link>
      </div>
    );
  }

  const status = STATUS_MAP[invoice.status] || { ar: invoice.status, badge: "badge-gray" };
  const remaining = Number(invoice.total || 0) - Number(invoice.paid_amount || 0);

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
            <span>{invoice.invoice_number}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <h1 className="page-title">{invoice.invoice_number}</h1>
            <span className={`badge ${status.badge}`}>{status.ar}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => window.open(`/${locale}/sales/invoices/${id}/print`, "_blank")}
          >
            <Icon name="print" size={14} />
            {ar ? "طباعة" : "Print"}
          </button>
          {invoice.status === "draft" && (
            <button className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={acting}>
              <Icon name="check" size={14} />
              {ar ? "تأكيد الفاتورة" : "Confirm Invoice"}
            </button>
          )}
          {(invoice.status === "confirmed" || invoice.status === "partial") && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowPayModal(true)}>
              <Icon name="wallet" size={14} />
              {ar ? "إضافة دفعة" : "Add Payment"}
            </button>
          )}
        </div>
      </div>

      {/* Invoice Print View */}
      <div className="card" style={{ marginBottom: 20 }}>
        {/* ── رأس الفاتورة: شعار + عنوان + QR + أرقام ── */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border)", background: "#F8FAFC" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            {/* يسار: شعار + عنوان الفاتورة */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              {company?.logo_data && (
                <img src={company.logo_data} alt="Logo" style={{ height: 52, objectFit: "contain", borderRadius: 6 }} />
              )}
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)" }}>
                  {ar ? "فاتورة ضريبية" : "Tax Invoice — فاتورة ضريبية"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {invoice.invoice_type === "simplified" ? (ar ? "مبسطة" : "Simplified") : (ar ? "ضريبية كاملة" : "Standard")}
                </div>
              </div>
            </div>

            {/* وسط: QR Code */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              {invoice.qr_code ? (
                <QRCodeDisplay data={invoice.qr_code} size={88} />
              ) : (
                <div style={{ width: 88, height: 88, border: "1px dashed var(--border)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: "white" }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>QR</span>
                </div>
              )}
              <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{ar ? "رمز الاستجابة السريعة" : "ZATCA QR"}</div>
            </div>

            {/* يمين: رقم الفاتورة + التواريخ */}
            <div style={{ textAlign: "end" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{invoice.invoice_number}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {ar ? "تاريخ الإصدار:" : "Issue Date:"} {new Date(invoice.issue_date).toLocaleDateString("en-SA")}
              </div>
              {invoice.supply_date && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {ar ? "تاريخ التوريد:" : "Supply Date:"} {new Date(invoice.supply_date).toLocaleDateString("en-SA")}
                </div>
              )}
              {invoice.due_date && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {ar ? "تاريخ الاستحقاق:" : "Due Date:"} {new Date(invoice.due_date).toLocaleDateString("en-SA")}
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

          {/* العميل (المشتري) */}
          <div style={{ padding: "18px 28px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.08em" }}>
              {ar ? "العميل / Customer" : "Customer / العميل"}
            </div>
            <CustomerBlock customer={invoice.customer || {
              name_ar: invoice.buyer_name_ar,
              vat_number: invoice.buyer_vat_number,
              address_city: null,
              phone: null, email: null,
            }} ar={ar} />
          </div>
        </div>

        {/* ── جدول الأسطر ── */}
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{ar ? "الوصف" : "Description"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "سعر الوحدة" : "Unit Price"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الخصم" : "Disc."}</th>
                <th style={{ textAlign: "end" }}>{ar ? "قبل الضريبة" : "Taxable"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "ضريبة 15%" : "VAT 15%"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.lines || []).map((line: any, i: number) => (
                <tr key={i}>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{line.description_ar}</div>
                    {line.description_en && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{line.description_en}</div>}
                  </td>
                  <td style={{ textAlign: "end" }}>{fmt(line.quantity)}</td>
                  <td style={{ textAlign: "end" }}>{fmt(line.unit_price)}</td>
                  <td style={{ textAlign: "end", color: "var(--danger)" }}>
                    {Number(line.discount_pct) > 0 ? `${line.discount_pct}%` : "—"}
                  </td>
                  <td style={{ textAlign: "end" }}>{fmt(line.subtotal)}</td>
                  <td style={{ textAlign: "end", color: "#D97706" }}>{fmt(line.vat_amount)}</td>
                  <td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── الإجماليات ── */}
        <div style={{ padding: "20px 28px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 300, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{ar ? "المجموع قبل الضريبة" : "Subtotal (excl. VAT)"}</span>
              <span>{fmt(invoice.subtotal)} SAR</span>
            </div>
            {Number(invoice.discount_amount) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--danger)" }}>{ar ? "الخصم" : "Discount"}</span>
                <span style={{ color: "var(--danger)" }}>- {fmt(invoice.discount_amount)} SAR</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#D97706", fontWeight: 600 }}>
              <span>{ar ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)"}</span>
              <span>{fmt(invoice.vat_amount)} SAR</span>
            </div>
            <div style={{ height: 1, background: "var(--border)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800 }}>
              <span>{ar ? "الإجمالي شامل الضريبة" : "TOTAL (incl. VAT)"}</span>
              <span style={{ color: "var(--primary)" }}>{fmt(invoice.total)} SAR</span>
            </div>
            {Number(invoice.paid_amount) > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--success)" }}>
                  <span>{ar ? "المدفوع" : "Paid"}</span>
                  <span>{fmt(invoice.paid_amount)} SAR</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: remaining > 0 ? "var(--danger)" : "var(--success)" }}>
                  <span>{ar ? "المتبقي" : "Remaining"}</span>
                  <span>{fmt(remaining)} SAR</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* UUID */}
        {invoice.uuid && (
          <div style={{ padding: "10px 28px", borderTop: "1px solid var(--border)", background: "#F8FAFC" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>UUID: </span>
            <code style={{ fontSize: 11, color: "var(--text-secondary)" }}>{invoice.uuid}</code>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">{ar ? "سجل المدفوعات" : "Payment History"}</span>
          {(invoice.status === "confirmed" || invoice.status === "partial") && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowPayModal(true)}>
              <Icon name="plus" size={14} />
              {ar ? "إضافة دفعة" : "Add Payment"}
            </button>
          )}
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {payments.length === 0 ? (
            <div className="empty-state" style={{ padding: "32px 20px" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 10px" }}>
                <Icon name="wallet" size={20} />
              </div>
              <div className="empty-state-title" style={{ fontSize: 13 }}>{ar ? "لا توجد مدفوعات" : "No payments yet"}</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "طريقة الدفع" : "Method"}</th>
                  <th>{ar ? "المرجع" : "Reference"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => {
                  const method = PAYMENT_METHODS.find(m => m.value === p.payment_method);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.payment_date}</td>
                      <td>{ar ? method?.ar : method?.en || p.payment_method}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.reference || "—"}</td>
                      <td style={{ textAlign: "end", fontWeight: 700, color: "var(--success)" }}>
                        {fmt(p.amount)} SAR
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Payment Modal */}
      {showPayModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 440 }} className="animate-slide">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "إضافة دفعة" : "Add Payment"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowPayModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{ar ? "المتبقي:" : "Remaining:"}</span>
                  <span style={{ fontWeight: 700, color: "var(--danger)" }}>{fmt(remaining)} SAR</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "المبلغ (ر.س)" : "Amount (SAR)"} <span className="required">*</span></label>
                <input
                  type="number"
                  className="form-input"
                  value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  min="0"
                  max={remaining}
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "طريقة الدفع" : "Payment Method"}</label>
                <select className="form-input form-select" value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.ar} / {m.en}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الحساب البنكي" : "Bank Account"}</label>
                <select className="form-input form-select" value={payForm.bank_account_id} onChange={e => setPayForm(f => ({ ...f, bank_account_id: e.target.value }))}>
                  <option value="">{ar ? "— اختر الحساب البنكي —" : "— Select Bank Account —"}</option>
                  {bankAccounts.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "رقم المرجع" : "Reference"}</label>
                <input className="form-input" value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder={ar ? "رقم الحوالة أو الشيك" : "Transfer or cheque number"} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ الدفع" : "Payment Date"}</label>
                <input type="date" className="form-input" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => setShowPayModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={handleAddPayment} disabled={saving}>
                  {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "تسجيل الدفعة" : "Record Payment")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
