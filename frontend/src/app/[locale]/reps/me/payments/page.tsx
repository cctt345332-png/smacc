"use client";
import { useEffect, useState, use } from "react";
import { getMyPayments, getMyInvoices } from "@/lib/reps";
import { createPayment, getCustomers } from "@/lib/sales";
import api from "@/lib/api";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const METHOD: Record<string, { ar: string; color: string; bg: string }> = {
  cash:          { ar: "نقداً",       color: "#059669", bg: "#D1FAE5" },
  bank_transfer: { ar: "تحويل بنكي", color: "#425E7A", bg: "#DBEAFE" },
  cheque:        { ar: "شيك",        color: "#356B63", bg: "#EDE9FE" },
  credit_card:   { ar: "بطاقة",      color: "#0891B2", bg: "#CFFAFE" },
  mada:          { ar: "مدى",        color: "#059669", bg: "#D1FAE5" },
  stc_pay:       { ar: "STC Pay",    color: "#356B63", bg: "#EDE9FE" },
};

const today = () => new Date().toISOString().split("T")[0];

export default function RepPaymentsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [mode, setMode]         = useState<"invoice" | "customer">("invoice");

  const [form, setForm] = useState({
    invoice_id: "", customer_id: "",
    amount: "", payment_method: "cash",
    payment_date: today(), reference: "", notes: "",
  });

  // بيانات العميل المختار
  const [customerBalance, setCustomerBalance] = useState<any>(null);
  const [customerInvoices, setCustomerInvoices] = useState<any[]>([]);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      getMyPayments().catch(() => ({ data: [] })),
      getMyInvoices().catch(() => ({ data: [] })),
      getCustomers().catch(() => ({ data: [] })),
    ]).then(([p, i, c]) => {
      setPayments(Array.isArray(p.data) ? p.data : []);
      const invs = Array.isArray(i.data) ? i.data : [];
      setInvoices(invs.filter((x: any) =>
        ["confirmed","partial","overdue","approved"].includes(x.status) &&
        Number(x.total||0) - Number(x.paid_amount||0) > 0.01
      ));
      setCustomers(Array.isArray(c.data) ? c.data : []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // عند اختيار عميل — جلب رصيده وفواتيره
  const onSelectCustomer = async (cid: string) => {
    setForm(f => ({ ...f, customer_id: cid, invoice_id: "", amount: "" }));
    setCustomerBalance(null); setCustomerInvoices([]);
    if (!cid) return;
    setLoadingBalance(true);
    try {
      const [stmtRes] = await Promise.all([
        api.get(`/sales/customers/${cid}/statement`, {
          params: { from_date: "2020-01-01T00:00:00", to_date: new Date().toISOString() }
        }).catch(() => ({ data: null })),
      ]);
      const custInvs = invoices.filter(i => i.customer_id === cid);
      setCustomerInvoices(custInvs);
      const totalDue = custInvs.reduce((s: number, i: any) =>
        s + Math.max(0, Number(i.total||0) - Number(i.paid_amount||0)), 0);
      setCustomerBalance({ total_due: totalDue, invoice_count: custInvs.length });
      if (custInvs.length > 0) {
        setForm(f => ({ ...f, amount: totalDue.toFixed(2) }));
      }
    } finally { setLoadingBalance(false); }
  };

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const invoiceId = mode === "invoice" ? form.invoice_id :
      (customerInvoices.length === 1 ? customerInvoices[0].id : form.invoice_id);
    if (!invoiceId) { setError(ar ? "اختر الفاتورة" : "Select invoice"); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError(ar ? "أدخل مبلغاً صحيحاً" : "Enter valid amount"); return; }
    setSaving(true); setError("");
    try {
      await createPayment({
        invoice_id: invoiceId, amount: Number(form.amount),
        payment_method: form.payment_method,
        payment_date: new Date(form.payment_date).toISOString(),
        reference: form.reference || null, notes: form.notes || null,
      });
      setShowModal(false);
      setForm({ invoice_id:"", customer_id:"", amount:"", payment_method:"cash", payment_date:today(), reference:"", notes:"" });
      setCustomerBalance(null); setCustomerInvoices([]);
      load();
    } catch (e: any) { setError(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const total = payments.reduce((s, p) => s + Number(p.amount||0), 0);

  return (
    <>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, margin:0 }}>{ar ? "سندات قبضي" : "My Receipts"}</h1>
          <p style={{ fontSize:12, color:"var(--text-muted)", margin:"4px 0 0" }}>
            {payments.length} {ar ? "سند" : "receipts"}
          </p>
        </div>
        <button onClick={() => { setShowModal(true); setError(""); setMode("invoice"); }}
          style={{ padding:"8px 16px", borderRadius:10, border:"none", background:"#425E7A",
            color:"white", fontWeight:700, fontSize:13, cursor:"pointer",
            display:"flex", alignItems:"center", gap:6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {ar ? "سند جديد" : "New Receipt"}
        </button>
      </div>

      {payments.length > 0 && (
        <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:14,
          padding:"14px 18px", marginBottom:16, display:"flex", justifyContent:"space-between" }}>
          <span style={{ fontSize:13, color:"#065F46", fontWeight:600 }}>{ar ? "إجمالي المقبوض" : "Total Collected"}</span>
          <span style={{ fontSize:20, fontWeight:800, color:"#059669" }}>{fmt(total)} SAR</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding:40, textAlign:"center", color:"var(--text-muted)", fontSize:13 }}>
          {ar ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : payments.length === 0 ? (
        <div style={{ padding:40, textAlign:"center" }}>
          <div style={{ fontSize:13, color:"var(--text-muted)", marginBottom:14 }}>
            {ar ? "لا توجد سندات بعد" : "No receipts yet"}
          </div>
          <button onClick={() => setShowModal(true)}
            style={{ padding:"8px 16px", borderRadius:10, border:"none", background:"#425E7A", color:"white", fontWeight:700, fontSize:13, cursor:"pointer" }}>
            + {ar ? "سند جديد" : "New Receipt"}
          </button>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {payments.map((p: any) => {
            const m = METHOD[p.payment_method] || { ar:p.payment_method, color:"#6B7280", bg:"#F3F4F6" };
            return (
              <div key={p.id} style={{ background:"var(--surface)", borderRadius:14,
                padding:"14px 16px", border:"1px solid var(--border)", display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:12, flexShrink:0,
                  background:m.bg, display:"flex", alignItems:"center", justifyContent:"center", color:m.color }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontFamily:"monospace", fontWeight:700, fontSize:13, color:"#425E7A" }}>
                      {p.payment_number || `#${p.id?.slice(-6)}`}
                    </span>
                    <span style={{ fontWeight:800, fontSize:15, color:"#059669" }}>+ {fmt(p.amount)} SAR</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20, background:m.bg, color:m.color }}>
                      {ar ? m.ar : p.payment_method}
                    </span>
                    <span style={{ fontSize:11, color:"var(--text-muted)" }}>{fmtDate(p.payment_date)}</span>
                  </div>
                  {p.invoice_number && (
                    <div style={{ fontSize:11, color:"var(--text-secondary)", marginTop:3 }}>
                      {ar ? "فاتورة:" : "Invoice:"}{" "}
                      <span style={{ fontFamily:"monospace", color:"#425E7A" }}>{p.invoice_number}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal سند جديد ── */}
      {showModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:800,
          display:"flex", alignItems:"flex-end", justifyContent:"center" }}
          onClick={() => setShowModal(false)}>
          <div style={{ background:"var(--surface)", borderRadius:"20px 20px 0 0",
            width:"100%", maxWidth:580, maxHeight:"95vh", overflowY:"auto", padding:"0 0 36px" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ padding:"14px 20px 0", textAlign:"center" }}>
              <div style={{ width:40, height:4, background:"var(--border)", borderRadius:2, margin:"0 auto 16px" }} />
            </div>

            <div style={{ padding:"0 20px 14px", borderBottom:"1px solid var(--border)",
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <h2 style={{ fontSize:17, fontWeight:800, margin:0 }}>{ar ? "سند قبض جديد" : "New Receipt"}</h2>
              <button onClick={() => setShowModal(false)}
                style={{ width:30, height:30, borderRadius:8, border:"1px solid var(--border)",
                  background:"transparent", cursor:"pointer", fontSize:16, color:"var(--text-muted)" }}>×</button>
            </div>

            <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:14 }}>
              {error && (
                <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10,
                  padding:"10px 14px", color:"#DC2626", fontSize:13 }}>{error}</div>
              )}

              {/* طريقة الاختيار */}
              <div style={{ display:"flex", gap:8 }}>
                {[
                  { v:"invoice",  ar:"عن طريق الفاتورة", en:"By Invoice" },
                  { v:"customer", ar:"عن طريق العميل",   en:"By Customer" },
                ].map(m => (
                  <button key={m.v} type="button" onClick={() => {
                    setMode(m.v as any);
                    setForm(f => ({ ...f, invoice_id:"", customer_id:"", amount:"" }));
                    setCustomerBalance(null); setCustomerInvoices([]);
                  }}
                    style={{ flex:1, padding:"9px", borderRadius:8, border:"2px solid",
                      borderColor: mode === m.v ? "#425E7A" : "var(--border)",
                      background: mode === m.v ? "#EDF3F8" : "var(--surface)",
                      color: mode === m.v ? "#425E7A" : "var(--text-primary)",
                      fontWeight:700, fontSize:12, cursor:"pointer" }}>
                    {ar ? m.ar : m.en}
                  </button>
                ))}
              </div>

              {/* اختيار عبر الفاتورة */}
              {mode === "invoice" && (
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>
                    {ar ? "الفاتورة *" : "Invoice *"}
                  </label>
                  {invoices.length === 0 ? (
                    <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:10,
                      padding:"10px 14px", fontSize:13, color:"#92400E" }}>
                      {ar ? "لا توجد فواتير بمبالغ متبقية" : "No invoices with remaining balance"}
                    </div>
                  ) : (
                    <select className="form-input form-select" value={form.invoice_id}
                      onChange={e => {
                        const inv = invoices.find(i => i.id === e.target.value);
                        const rem = inv ? Number(inv.total||0) - Number(inv.paid_amount||0) : 0;
                        setForm(f => ({ ...f, invoice_id: e.target.value, amount: rem > 0 ? rem.toFixed(2) : "" }));
                      }}>
                      <option value="">{ar ? "— اختر الفاتورة —" : "— Select Invoice —"}</option>
                      {invoices.map((inv: any) => {
                        const rem = Number(inv.total||0) - Number(inv.paid_amount||0);
                        return (
                          <option key={inv.id} value={inv.id}>
                            {inv.invoice_number} — {inv.buyer_name_ar} — {fmt(rem)} SAR
                          </option>
                        );
                      })}
                    </select>
                  )}
                  {form.invoice_id && (() => {
                    const inv = invoices.find(i => i.id === form.invoice_id);
                    if (!inv) return null;
                    const rem = Number(inv.total||0) - Number(inv.paid_amount||0);
                    return (
                      <div style={{ marginTop:8, background:"#EDF3F8", borderRadius:10,
                        padding:"10px 14px", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                        <div>
                          <div style={{ fontSize:10, color:"#6B7280" }}>{ar ? "الإجمالي" : "Total"}</div>
                          <div style={{ fontWeight:700, fontSize:13 }}>{fmt(inv.total)} SAR</div>
                        </div>
                        <div>
                          <div style={{ fontSize:10, color:"#6B7280" }}>{ar ? "المدفوع" : "Paid"}</div>
                          <div style={{ fontWeight:700, fontSize:13, color:"#059669" }}>{fmt(inv.paid_amount)} SAR</div>
                        </div>
                        <div>
                          <div style={{ fontSize:10, color:"#6B7280" }}>{ar ? "المتبقي" : "Remaining"}</div>
                          <div style={{ fontWeight:700, fontSize:13, color:"#DC2626" }}>{fmt(rem)} SAR</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* اختيار عبر العميل */}
              {mode === "customer" && (
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>
                    {ar ? "العميل *" : "Customer *"}
                  </label>
                  <select className="form-input form-select" value={form.customer_id}
                    onChange={e => onSelectCustomer(e.target.value)}>
                    <option value="">{ar ? "— اختر العميل —" : "— Select Customer —"}</option>
                    {customers.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name_ar}</option>
                    ))}
                  </select>

                  {loadingBalance && (
                    <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:8, textAlign:"center" }}>
                      {ar ? "جاري تحميل الرصيد..." : "Loading balance..."}
                    </div>
                  )}

                  {customerBalance && !loadingBalance && (
                    <div style={{ marginTop:8, background:"#EDF3F8", borderRadius:10, padding:"12px 14px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                        <span style={{ fontSize:13, fontWeight:600 }}>{ar ? "رصيد العميل المستحق" : "Customer Balance Due"}</span>
                        <span style={{ fontSize:16, fontWeight:800, color:"#DC2626" }}>
                          {fmt(customerBalance.total_due)} SAR
                        </span>
                      </div>
                      <div style={{ fontSize:12, color:"#6B7280" }}>
                        {customerBalance.invoice_count} {ar ? "فاتورة معلقة" : "pending invoices"}
                      </div>
                    </div>
                  )}

                  {/* فواتير العميل المستحقة */}
                  {customerInvoices.length > 1 && (
                    <div style={{ marginTop:10 }}>
                      <label style={{ fontSize:12, fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>
                        {ar ? "اختر الفاتورة *" : "Select Invoice *"}
                      </label>
                      <select className="form-input form-select" value={form.invoice_id}
                        onChange={e => {
                          const inv = customerInvoices.find(i => i.id === e.target.value);
                          const rem = inv ? Number(inv.total||0) - Number(inv.paid_amount||0) : 0;
                          setForm(f => ({ ...f, invoice_id: e.target.value, amount: rem.toFixed(2) }));
                        }}>
                        <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                        {customerInvoices.map((inv: any) => {
                          const rem = Number(inv.total||0) - Number(inv.paid_amount||0);
                          return (
                            <option key={inv.id} value={inv.id}>
                              {inv.invoice_number} — {fmt(rem)} SAR
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {customerInvoices.length === 0 && form.customer_id && !loadingBalance && (
                    <div style={{ marginTop:8, fontSize:12, color:"#059669", fontWeight:600 }}>
                      {ar ? "لا توجد مبالغ مستحقة لهذا العميل" : "No outstanding balance for this customer"}
                    </div>
                  )}
                </div>
              )}

              {/* المبلغ */}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>
                  {ar ? "المبلغ المقبوض (SAR) *" : "Amount Received (SAR) *"}
                </label>
                <input type="number" className="form-input" min="0.01" step="0.01"
                  value={form.amount} onChange={e => upd("amount", e.target.value)}
                  placeholder="0.00" style={{ fontSize:18, fontWeight:700, color:"#059669" }} />
              </div>

              {/* طريقة الدفع */}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>
                  {ar ? "طريقة الدفع *" : "Payment Method *"}
                </label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {[
                    { v:"cash", ar:"نقداً", icon:"💵" }, { v:"bank_transfer", ar:"تحويل", icon:"🏦" },
                    { v:"cheque", ar:"شيك", icon:"📝" }, { v:"mada", ar:"مدى", icon:"💳" },
                    { v:"stc_pay", ar:"STC", icon:"📱" }, { v:"credit_card", ar:"بطاقة", icon:"💳" },
                  ].map(m => (
                    <button key={m.v} type="button" onClick={() => upd("payment_method", m.v)}
                      style={{ padding:"8px 4px", borderRadius:8, border:"2px solid",
                        borderColor: form.payment_method === m.v ? "#425E7A" : "var(--border)",
                        background: form.payment_method === m.v ? "#EDF3F8" : "var(--surface)",
                        color: form.payment_method === m.v ? "#425E7A" : "var(--text-primary)",
                        fontWeight:700, fontSize:11, cursor:"pointer",
                        display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                      <span style={{ fontSize:16 }}>{m.icon}</span>
                      <span>{ar ? m.ar : m.v}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* مرجع */}
              {["bank_transfer","cheque"].includes(form.payment_method) && (
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>
                    {form.payment_method === "cheque" ? (ar ? "رقم الشيك" : "Cheque #") : (ar ? "رقم التحويل" : "Ref #")}
                  </label>
                  <input className="form-input" dir="ltr"
                    value={form.reference} onChange={e => upd("reference", e.target.value)} />
                </div>
              )}

              {/* التاريخ */}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>
                  {ar ? "تاريخ القبض" : "Receipt Date"}
                </label>
                <input type="date" className="form-input" value={form.payment_date} onChange={e => upd("payment_date", e.target.value)} />
              </div>

              {/* ملاحظات */}
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:"var(--text-secondary)", display:"block", marginBottom:6 }}>
                  {ar ? "ملاحظات" : "Notes"}
                </label>
                <textarea className="form-input" rows={2} value={form.notes} onChange={e => upd("notes", e.target.value)}
                  placeholder={ar ? "ملاحظات اختيارية..." : "Optional..."} />
              </div>

              {/* أزرار */}
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setShowModal(false)}
                  style={{ flex:1, padding:"12px", borderRadius:10, border:"1px solid var(--border)",
                    background:"var(--bg)", fontSize:14, fontWeight:600, cursor:"pointer", color:"var(--text-secondary)" }}>
                  {ar ? "إلغاء" : "Cancel"}
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ flex:2, padding:"12px", borderRadius:10, border:"none",
                    background: saving ? "#93C5FD" : "#425E7A", color:"white", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                  {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ السند" : "Save Receipt")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
