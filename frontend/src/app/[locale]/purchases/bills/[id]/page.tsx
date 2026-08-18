"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBill, confirmBill, createBillPayment, getBillPayments, getVendor } from "@/lib/purchases";
import { getCompany } from "@/lib/settings";
import { getAccounts, getBankAccounts } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";
import SellerBlock from "@/components/documents/SellerBlock";
import CustomerBlock from "@/components/documents/CustomerBlock";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const STATUS_MAP: Record<string, { ar: string; badge: string }> = {
  draft:     { ar: "مسودة",   badge: "badge-warning" },
  confirmed: { ar: "مؤكدة",   badge: "badge-info" },
  paid:      { ar: "مدفوعة",  badge: "badge-success" },
  partial:   { ar: "جزئية",   badge: "badge-warning" },
  cancelled: { ar: "ملغاة",   badge: "badge-danger" },
};

const PAYMENT_METHODS = [
  { value: "bank_transfer", ar: "تحويل بنكي", en: "Bank Transfer" },
  { value: "cheque",        ar: "شيك",         en: "Cheque" },
  { value: "cash",          ar: "نقداً",        en: "Cash" },
  { value: "mada",          ar: "مدى",          en: "Mada" },
  { value: "stc_pay",       ar: "STC Pay",      en: "STC Pay" },
];

const emptyPayment = {
  amount: "",
  payment_method: "bank_transfer",
  reference: "",
  payment_date: new Date().toISOString().split("T")[0],
  bank_account_id: "",
  ap_account_id: "",
};

export default function BillDetailPage({ params: { locale, id } }: { params: { locale: string; id: string } }) {
  const ar = locale === "ar";
  const [bill, setBill] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ ...emptyPayment });
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  const load = async () => {
    try {
      const [billRes, payRes, compRes, accRes, bankRes] = await Promise.all([
        getBill(id),
        getBillPayments(id),
        getCompany(),
        getAccounts(),
        getBankAccounts(),
      ]);
      setBill(billRes.data);
      setPayments(payRes.data);
      setCompany(compRes.data);
      setAccounts(accRes.data);
      setBankAccounts(bankRes.data);
      if (billRes.data?.vendor_id) {
        const vendorRes = await getVendor(billRes.data.vendor_id);
        setVendor(vendorRes.data);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleConfirm = async () => {
    if (!confirm(ar ? "تأكيد الفاتورة الواردة؟" : "Confirm this bill?")) return;
    setActing(true);
    try { await confirmBill(id); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(false); }
  };

  const handleReprocess = async () => {
    if (!confirm(ar ? "إعادة معالجة المخزون لهذه الفاتورة؟ سيتم إضافة السيريالات والكميات الناقصة فقط." : "Reprocess inventory for this bill?")) return;
    setActing(true);
    try {
      const res = await import("@/lib/api").then(m => m.default.post(`/purchases/bills/${id}/reprocess-inventory`));
      alert(ar
        ? `✅ تمت المعالجة — ${res.data.added_serials ?? 0} سيريال، ${res.data.added_stock ?? 0} وحدة`
        : `✅ Done — ${res.data.added_serials ?? 0} serials, ${res.data.added_stock ?? 0} units`
      );
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(false); }
  };

  const handleAddPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) {
      return alert(ar ? "يرجى إدخال مبلغ صحيح" : "Please enter a valid amount");
    }
    setSaving(true);
    try {
      await createBillPayment(id, {
        amount: parseFloat(payForm.amount),
        payment_method: payForm.payment_method,
        reference: payForm.reference || null,
        payment_date: payForm.payment_date,
        bank_account_id: payForm.bank_account_id || null,
        ap_account_id: payForm.ap_account_id || null,
      });
      setShowPayModal(false);
      setPayForm({ ...emptyPayment });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  if (loading) {
    return <div className="empty-state" style={{ minHeight: "60vh" }}><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;
  }

  if (!bill) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-title">{ar ? "الفاتورة غير موجودة" : "Bill not found"}</div>
        <Link href={`/${locale}/purchases/bills`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
          {ar ? "العودة للفواتير" : "Back to Bills"}
        </Link>
      </div>
    );
  }

  const status = STATUS_MAP[bill.status] || { ar: bill.status, badge: "badge-gray" };
  const remaining = Number(bill.total || 0) - Number(bill.paid_amount || 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/purchases/bills`}>{ar ? "الفواتير الواردة" : "Bills"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{bill.bill_number}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <h1 className="page-title">{bill.bill_number}</h1>
            <span className={`badge ${status.badge}`}>{status.ar}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => window.open(`/${locale}/purchases/bills/${id}/print`, "_blank")}
          >
            <Icon name="print" size={14} /> {ar ? "طباعة" : "Print"}
          </button>
          {["confirmed","partial","paid"].includes(bill.status) && (
            <button className="btn btn-secondary btn-sm" onClick={handleReprocess} disabled={acting}
              title={ar ? "إعادة إضافة المخزون للفواتير القديمة" : "Reprocess missing inventory"}
              style={{ color: "#D97706", borderColor: "#D97706" }}>
              🔄 {ar ? "معالجة المخزون" : "Reprocess Stock"}
            </button>
          )}
          {bill.status !== "paid" && bill.status !== "cancelled" && (
            <Link href={`/${locale}/purchases/bills/${id}/edit`} className="btn btn-secondary btn-sm">
              <Icon name="edit" size={14} /> {ar ? "تعديل" : "Edit"}
            </Link>
          )}
          {bill.status === "draft" && (
            <button className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={acting}>
              <Icon name="check" size={14} /> {ar ? "تأكيد الفاتورة" : "Confirm Bill"}
            </button>
          )}
          {(bill.status === "confirmed" || bill.status === "partial") && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowPayModal(true)}>
              <Icon name="wallet" size={14} /> {ar ? "إضافة دفعة" : "Add Payment"}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        {/* Document Header */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border)", background: "#F8FAFC" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              {company?.logo_data && (
                <img src={company.logo_data} alt="Logo" style={{ height: 52, objectFit: "contain", borderRadius: 6 }} />
              )}
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#7C3AED" }}>
                  {ar ? "فاتورة واردة" : "Purchase Bill — فاتورة واردة"}
                </div>
                <span className={`badge ${status.badge}`} style={{ marginTop: 4 }}>{status.ar}</span>
              </div>
            </div>
            <div style={{ textAlign: "end" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{bill.bill_number}</div>
              {bill.vendor_invoice_number && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {ar ? "رقم فاتورة المورد:" : "Vendor Invoice:"} {bill.vendor_invoice_number}
                </div>
              )}
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {ar ? "تاريخ الفاتورة:" : "Bill Date:"} {bill.bill_date ? new Date(bill.bill_date).toLocaleDateString("en-SA") : "—"}
              </div>
              {bill.supply_date && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {ar ? "تاريخ التوريد:" : "Supply Date:"} {new Date(bill.supply_date).toLocaleDateString("en-SA")}
                </div>
              )}
              {bill.due_date && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {ar ? "تاريخ الاستحقاق:" : "Due Date:"} {new Date(bill.due_date).toLocaleDateString("en-SA")}
                </div>
              )}
              {bill.purchase_order_id && (
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{ar ? "أمر الشراء:" : "PO:"} </span>
                  <Link href={`/${locale}/purchases/orders/${bill.purchase_order_id}`} style={{ color: "var(--primary)", fontWeight: 600 }}>
                    {ar ? "عرض أمر الشراء" : "View PO"}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Company & Vendor */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--border)" }}>
          <div style={{ padding: "18px 28px", borderInlineEnd: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.08em" }}>
              {ar ? "الشركة / Buyer" : "Buyer / الشركة"}
            </div>
            <SellerBlock company={company} ar={ar} />
          </div>
          <div style={{ padding: "18px 28px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.08em" }}>
              {ar ? "المورد / Vendor" : "Vendor / المورد"}
            </div>
            <CustomerBlock customer={vendor} ar={ar} />
          </div>
        </div>

        {/* Lines Table */}
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
                <th style={{ textAlign: "end" }}>{ar ? "ضريبة%" : "VAT%"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
              </tr>
            </thead>
            <tbody>
              {(bill.lines || []).map((line: any, i: number) => (
                <tr key={i}>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{i + 1}</td>
                  <td><div style={{ fontWeight: 500 }}>{line.description_ar}</div></td>
                  <td style={{ textAlign: "end" }}>{fmt(line.quantity)}</td>
                  <td style={{ textAlign: "end" }}>{fmt(line.unit_price)}</td>
                  <td style={{ textAlign: "end", color: "var(--danger)" }}>
                    {Number(line.discount_pct) > 0 ? `${line.discount_pct}%` : "—"}
                  </td>
                  <td style={{ textAlign: "end" }}>{fmt(line.subtotal)}</td>
                  <td style={{ textAlign: "end", color: "#D97706" }}>
                    {Number(line.vat_rate) > 0
                      ? <>{fmt(line.vat_amount)} <span style={{ fontSize: 10, color: "#9CA3AF" }}>({Number(line.vat_rate)}%)</span></>
                      : <span style={{ color: "var(--text-muted)" }}>—</span>
                    }
                  </td>
                  <td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ padding: "20px 28px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 300, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{ar ? "المجموع قبل الضريبة" : "Subtotal (excl. VAT)"}</span>
              <span>{fmt(bill.subtotal)} SAR</span>
            </div>
            {Number(bill.discount_amount) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--danger)" }}>{ar ? "الخصم" : "Discount"}</span>
                <span style={{ color: "var(--danger)" }}>- {fmt(bill.discount_amount)} SAR</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#D97706", fontWeight: 600 }}>
              <span>{ar ? "ضريبة القيمة المضافة" : "VAT"}</span>
              <span>{fmt(bill.vat_amount)} SAR</span>
            </div>
            <div style={{ height: 1, background: "var(--border)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800 }}>
              <span>{ar ? "الإجمالي شامل الضريبة" : "TOTAL (incl. VAT)"}</span>
              <span style={{ color: "#7C3AED" }}>{fmt(bill.total)} SAR</span>
            </div>
            {Number(bill.paid_amount) > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--success)" }}>
                  <span>{ar ? "المدفوع" : "Paid"}</span>
                  <span>{fmt(bill.paid_amount)} SAR</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: remaining > 0 ? "var(--danger)" : "var(--success)" }}>
                  <span>{ar ? "المتبقي" : "Remaining"}</span>
                  <span>{fmt(remaining)} SAR</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">{ar ? "سجل المدفوعات" : "Payment History"}</span>
          {(bill.status === "confirmed" || bill.status === "partial") && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowPayModal(true)}>
              <Icon name="plus" size={14} /> {ar ? "إضافة دفعة" : "Add Payment"}
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
                      <td style={{ textAlign: "end", fontWeight: 700, color: "var(--danger)" }}>
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
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "تسجيل دفعة للمورد" : "Record Vendor Payment"}</h2>
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
                <input type="number" className="form-input" value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} min="0" max={remaining} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "طريقة الدفع" : "Payment Method"}</label>
                <select className="form-input form-select" value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.ar} / {m.en}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "رقم المرجع" : "Reference"}</label>
                <input className="form-input" value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder={ar ? "رقم الحوالة أو الشيك" : "Transfer or cheque number"} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الحساب البنكي" : "Bank Account"}</label>
                <select className="form-input form-select" value={payForm.bank_account_id} onChange={e => setPayForm(f => ({ ...f, bank_account_id: e.target.value }))}>
                  <option value="">{ar ? "— اختياري —" : "— Optional —"}</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "حساب الدائنين (AP)" : "AP Account"}</label>
                <select className="form-input form-select" value={payForm.ap_account_id} onChange={e => setPayForm(f => ({ ...f, ap_account_id: e.target.value }))}>
                  <option value="">{ar ? "— اختياري —" : "— Optional —"}</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>)}
                </select>
                <p className="form-hint">{ar ? "إذا حددت الحساب والبنك سيُنشأ سند صرف تلقائياً" : "If selected, a payment voucher will be auto-created"}</p>
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
