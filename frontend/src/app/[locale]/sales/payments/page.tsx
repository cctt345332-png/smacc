"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getPayments, createPayment, getInvoices, getCustomers, getCustomerStatement } from "@/lib/sales";
import { getReps } from "@/lib/reps";
import { Icon } from "@/components/ui/Icons";
import SearchableSelect from "@/components/ui/SearchableSelect";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const METHODS: Record<string, { ar: string; en: string }> = {
  cash:          { ar: "نقداً",         en: "Cash" },
  bank_transfer: { ar: "تحويل بنكي",    en: "Bank Transfer" },
  cheque:        { ar: "شيك",           en: "Cheque" },
  credit_card:   { ar: "بطاقة ائتمان", en: "Credit Card" },
  mada:          { ar: "مدى",           en: "Mada" },
  stc_pay:       { ar: "STC Pay",       en: "STC Pay" },
};

const emptyForm = {
  payment_type: "receipt",
  invoice_id: "",
  customer_id: "",
  payment_date: new Date().toISOString().split("T")[0],
  amount: "",
  payment_method: "cash",
  reference: "",
  notes: "",
};

export default function PaymentsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [filterRep, setFilterRep] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    try {
      const [{ data }, repsResponse] = await Promise.all([getPayments(), getReps().catch(() => ({ data: [] }))]);
      setPayments(Array.isArray(data) ? data : []);
      setReps(Array.isArray(repsResponse.data) ? repsResponse.data : []);
    } catch {} finally { setLoading(false); }
  };

  const loadInvoices = async () => {
    try {
      const [{ data: invoiceData }, { data: customerData }] = await Promise.all([
        getInvoices({ status: "confirmed" }),
        getCustomers(),
      ]);
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      setCustomers(Array.isArray(customerData) ? customerData : []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const openModal = () => {
    loadInvoices();
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (!form.invoice_id && !form.customer_id) return alert(ar ? "اختر عميلاً أو فاتورة" : "Select a customer or invoice");
    if (!form.amount || Number(form.amount) <= 0) return alert(ar ? "أدخل مبلغاً صحيحاً" : "Enter valid amount");
    setSaving(true);
    try {
      await createPayment({
        ...form,
        amount: parseFloat(form.amount),
        payment_date: new Date(form.payment_date).toISOString(),
        reference: form.reference || null,
        notes: form.notes || null,
      });
      setShowModal(false);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Error");
    } finally { setSaving(false); }
  };

  const selectCustomer = async (customerId: string) => {
    if (!customerId) {
      setForm(f => ({ ...f, customer_id: "", invoice_id: "", amount: "" }));
      return;
    }
    setForm(f => ({ ...f, customer_id: customerId, invoice_id: "", amount: "" }));
    try {
      const { data } = await getCustomerStatement(customerId, "1970-01-01", form.payment_date);
      const balance = Number(data?.summary?.closing_balance ?? data?.closing_balance ?? 0);
      if (balance > 0) setForm(f => ({ ...f, customer_id: customerId, invoice_id: "", amount: balance.toFixed(2) }));
    } catch {}
  };

  const filteredPayments = payments.filter((p: any) => {
    const matchesRep = !filterRep || String(p.rep_id || "") === String(filterRep);
    const paymentMethod = typeof p.payment_method === "string" ? p.payment_method : p.payment_method?.value;
    const matchesMethod = !filterMethod || paymentMethod === filterMethod;
    const paymentDate = String(p.payment_date || "").slice(0, 10);
    const matchesFrom = !fromDate || paymentDate >= fromDate;
    const matchesTo = !toDate || paymentDate <= toDate;
    return matchesRep && matchesMethod && matchesFrom && matchesTo;
  });
  const total = filteredPayments.reduce((s: number, p: any) => s + (p.payment_type === "discount" ? 0 : Number(p.amount || 0)), 0);
  const reportRows = filteredPayments.map((p: any) => [
    p.payment_number || "—",
    p.payment_type === "discount" ? (ar ? "سند خصم" : "Discount") : (ar ? "سند قبض" : "Receipt"),
    p.customer_name_ar || p.customer_id || "—",
    p.rep_name || p.rep_code || "—",
    p.payment_date ? new Date(p.payment_date).toLocaleDateString(ar ? "ar-SA" : "en-GB") : "—",
    ar ? METHODS[p.payment_method]?.ar || p.payment_method || "—" : METHODS[p.payment_method]?.en || p.payment_method || "—",
    p.reference || "—",
    `${fmt(p.amount)} SAR`,
  ]);
  const reportPeriod = fromDate || toDate
    ? `${fromDate || (ar ? "البداية" : "Start")} — ${toDate || (ar ? "حتى اليوم" : "Today")}`
    : (ar ? "كل الفترات" : "All periods");

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/sales`}>{ar ? "المبيعات" : "Sales"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "سندات القبض" : "Receipts"}</span>
          </div>
          <h1 className="page-title">{ar ? "سندات القبض" : "Receipt Payments"}</h1>
          <p className="page-subtitle">{ar ? "المبالغ المقبوضة من العملاء مقابل الفواتير أو الأرصدة المباشرة" : "Payments collected against invoices or customer balances"}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openModal}>
          <Icon name="plus" size={14} /> {ar ? "سند قبض جديد" : "New Receipt"}
        </button>
      </div>

      {/* إحصائيات */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          { label: ar ? "إجمالي المقبوض" : "Total Collected", value: `${fmt(total)} SAR`, color: "#6F4A84" },
          { label: ar ? "عدد السندات" : "Total Receipts", value: filteredPayments.length, color: "#5A187E" },
          { label: ar ? "آخر قبض" : "Latest", value: filteredPayments[0] ? new Date(filteredPayments[0].payment_date).toLocaleDateString("ar-SA") : "—", color: "#75617F" },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-content">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* فلاتر السندات */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
            <label className="form-label">{ar ? "المندوب" : "Sales Rep"}</label>
            <select className="form-input form-select" value={filterRep} onChange={e => setFilterRep(e.target.value)}>
              <option value="">{ar ? "كل المناديب" : "All reps"}</option>
              {reps.map((rep: any) => (
                <option key={rep.id} value={rep.id}>{rep.full_name || rep.name || rep.rep_code}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
            <label className="form-label">{ar ? "طريقة الدفع" : "Payment method"}</label>
            <select className="form-input form-select" value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
              <option value="">{ar ? "كل طرق الدفع" : "All methods"}</option>
              {Object.entries(METHODS).map(([value, labels]) => (
                <option key={value} value={value}>{ar ? labels.ar : labels.en}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 155 }}>
            <label className="form-label">{ar ? "من تاريخ" : "From date"}</label>
            <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 155 }}>
            <label className="form-label">{ar ? "إلى تاريخ" : "To date"}</label>
            <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          {(filterRep || filterMethod || fromDate || toDate) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setFilterRep(""); setFilterMethod(""); setFromDate(""); setToDate(""); }}>
              {ar ? "مسح الفرز" : "Clear filters"}
            </button>
          )}
          <StructuredReportPrintButton
            locale={locale}
            title={ar ? "تقرير التحصيل" : "Collection Report"}
            subtitle={ar ? "سندات القبض والخصم حسب المندوب والفترة" : "Receipts and discounts by representative and period"}
            period={reportPeriod}
            orientation="landscape"
            reportCode={`COL-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`}
            metrics={[
              { label: ar ? "إجمالي التحصيل" : "Total collected", value: `${fmt(total)} SAR`, tone: "green" },
              { label: ar ? "عدد السندات" : "Receipts count", value: String(filteredPayments.length), tone: "blue" },
              { label: ar ? "المندوب" : "Sales rep", value: reps.find((rep: any) => String(rep.id) === String(filterRep))?.full_name || (filterRep ? "—" : (ar ? "الكل" : "All")), tone: "neutral" },
            ]}
            tables={[{
              title: ar ? "تفاصيل التحصيل" : "Collection details",
              headers: ar ? ["رقم السند", "النوع", "العميل", "المندوب", "التاريخ", "طريقة الدفع", "المرجع", "المبلغ"] : ["Receipt #", "Type", "Customer", "Sales rep", "Date", "Payment method", "Reference", "Amount"],
              rows: reportRows,
              totals: [ar ? "الإجمالي" : "Total", "", "", "", "", "", "", `${fmt(total)} SAR`],
            }]}
          />
          <div style={{ marginInlineStart: "auto", fontSize: 12, color: "var(--text-muted)" }}>
            {filteredPayments.length} {ar ? "سند معروض" : "receipts shown"}
          </div>
        </div>
      </div>

      {/* الجدول */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state">
              <div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{(filterRep || filterMethod || fromDate || toDate) ? (ar ? "لا توجد سندات بهذا الفرز" : "No receipts match these filters") : (ar ? "لا توجد سندات قبض" : "No receipts yet")}</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={openModal}>
                + {ar ? "سند جديد" : "New Receipt"}
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم السند" : "Receipt #"}</th>
                  <th>{ar ? "النوع" : "Type"}</th>
                  <th>{ar ? "المصدر" : "Source"}</th>
                  <th>{ar ? "العميل" : "Customer"}</th>
                  <th>{ar ? "المندوب" : "Sales Rep"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "طريقة الدفع" : "Method"}</th>
                  <th>{ar ? "المرجع" : "Reference"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المبلغ" : "Amount"}</th>
                  <th>{ar ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#6F4A84" }}>
                        {p.payment_number}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.payment_type === "discount" ? "badge-warning" : "badge-success"}`}>
                        {p.payment_type === "discount" ? (ar ? "سند خصم" : "Discount") : (ar ? "سند قبض" : "Receipt")}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {p.invoice_id ? (
                        <Link href={`/${locale}/sales/invoices/${p.invoice_id}`} style={{ color: "var(--primary)", textDecoration: "none" }}>
                          {p.invoice_number || p.invoice_id.slice(-8)}
                        </Link>
                      ) : (
                        <span className="badge badge-warning">{ar ? "رصيد العميل" : "Customer balance"}</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>{p.customer_name_ar || p.customer_id?.slice(-8) || "—"}</td>
                    <td style={{ fontSize: 13 }}>
                      {p.rep_name || p.rep_code || (p.rep_id ? p.rep_id.slice(-8) : "—")}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {new Date(p.payment_date).toLocaleDateString("ar-SA")}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: 11 }}>
                        {ar ? METHODS[p.payment_method]?.ar : METHODS[p.payment_method]?.en || p.payment_method}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{p.reference || "—"}</td>
                    <td style={{ textAlign: "end", fontWeight: 700, color: "#6F4A84" }}>
                      {fmt(p.amount)} SAR
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Link href={`/${locale}/sales/payments/${p.id}`} className="btn btn-secondary btn-sm" style={{ textDecoration: "none", padding: "5px 8px", fontSize: 11 }}>
                          {ar ? "عرض" : "View"}
                        </Link>
                        <button className="btn btn-secondary btn-sm" onClick={() => window.open(`/${locale}/sales/payments/${p.id}/print`, "_blank")} style={{ padding: "5px 8px", fontSize: 11 }}>
                          {ar ? "طباعة" : "Print"}
                        </button>
                        <Link href={`/${locale}/sales/payments/${p.id}/edit`} className="btn btn-primary btn-sm" style={{ textDecoration: "none", padding: "5px 8px", fontSize: 11 }}>
                          {ar ? "تعديل" : "Edit"}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                  <td colSpan={9} style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                  <td style={{ textAlign: "end", padding: "12px 16px", color: "#6F4A84" }}>
                    {fmt(total)} SAR
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Modal سند قبض جديد */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 480 }} className="animate-slide">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{form.payment_type === "discount" ? (ar ? "سند خصم جديد" : "New Discount Voucher") : (ar ? "سند قبض جديد" : "New Receipt")}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "نوع السند" : "Voucher type"} <span className="required">*</span></label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ value: "receipt", ar: "سند قبض", en: "Receipt" }, { value: "discount", ar: "سند خصم", en: "Discount" }].map((type) => (
                    <button key={type.value} type="button" onClick={() => setForm(f => ({ ...f, payment_type: type.value, invoice_id: "" }))} className="btn btn-secondary" style={{ flex: 1, border: "2px solid", borderColor: form.payment_type === type.value ? "var(--primary)" : "var(--border)", background: form.payment_type === type.value ? "var(--primary)" : "white", color: form.payment_type === type.value ? "white" : "var(--text-primary)" }}>
                      {ar ? type.ar : type.en}
                    </button>
                  ))}
                </div>
                {form.payment_type === "discount" && <div className="form-hint">{ar ? "يُخصم المبلغ من رصيد العميل ولا يدخل في النقدية أو البنك." : "Reduces the customer balance without affecting cash or bank."}</div>}
              </div>
              {/* العميل أو الفاتورة */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "العميل (تحصيل من الرصيد)" : "Customer (collect from balance)"} <span className="required">*</span></label>
                <SearchableSelect
                  value={form.customer_id}
                  onChange={selectCustomer}
                  locale={locale}
                  placeholder={ar ? "اكتب اسم العميل أو رقمه للبحث..." : "Search customer by name or number..."}
                  options={customers.map((customer: any) => ({
                    value: customer.id,
                    label: `${customer.customer_number || ""} — ${customer.name_ar || customer.name_en || ""}`,
                    searchText: `${customer.name_ar || ""} ${customer.name_en || ""} ${customer.customer_number || ""} ${customer.phone || ""}`,
                  }))}
                />
                <div className="form-hint">{ar ? "يمكنك ترك الفاتورة فارغة وسيُسجل السند على رصيد العميل العام." : "Leave the invoice empty to record the receipt against the customer's general balance."}</div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "الفاتورة (اختياري)" : "Invoice (optional)"}</label>
                <SearchableSelect
                  value={form.invoice_id}
                  onChange={(invoiceId) => {
                    const inv = invoices.find((item: any) => item.id === invoiceId);
                    setForm(f => ({ ...f, invoice_id: invoiceId, customer_id: inv?.customer_id || f.customer_id, amount: inv ? String(Math.max(0, Number(inv.total) - Number(inv.paid_amount || 0))) : f.amount }));
                  }}
                  locale={locale}
                  placeholder={ar ? "اكتب رقم الفاتورة أو اسم العميل للبحث..." : "Search invoice or customer..."}
                  options={invoices.map((inv: any) => ({
                    value: inv.id,
                    label: `${inv.invoice_number} — ${inv.buyer_name_ar || ""} — ${fmt(Math.max(0, Number(inv.total) - Number(inv.paid_amount || 0)))} SAR`,
                    searchText: `${inv.invoice_number || ""} ${inv.buyer_name_ar || ""} ${inv.buyer_name_en || ""}`,
                  }))}
                />
              </div>

              {/* التاريخ والمبلغ */}
              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{ar ? "تاريخ القبض" : "Payment Date"} <span className="required">*</span></label>
                  <input type="date" className="form-input" value={form.payment_date}
                    onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{ar ? "المبلغ" : "Amount"} <span className="required">*</span></label>
                  <input type="number" className="form-input" value={form.amount} min="0.01" step="0.01"
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>

              {/* طريقة الدفع */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "طريقة الدفع" : "Payment Method"} <span className="required">*</span></label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {Object.entries(METHODS).map(([key, label]) => (
                    <button key={key} type="button"
                      onClick={() => setForm(f => ({ ...f, payment_method: key }))}
                      style={{
                        padding: "6px 12px", borderRadius: 8, border: "2px solid",
                        borderColor: form.payment_method === key ? "var(--primary)" : "var(--border)",
                        background: form.payment_method === key ? "var(--primary)" : "white",
                        color: form.payment_method === key ? "white" : "var(--text-primary)",
                        fontWeight: 600, fontSize: 12, cursor: "pointer",
                      }}>
                      {ar ? label.ar : label.en}
                    </button>
                  ))}
                </div>
              </div>

              {/* المرجع والملاحظات */}
              <div className="grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{ar ? "رقم المرجع" : "Reference"}</label>
                  <input className="form-input" value={form.reference} placeholder={ar ? "رقم الشيك / التحويل..." : "Cheque / transfer no..."}
                    onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
                  <input className="form-input" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>

              {/* أزرار */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  {ar ? "إلغاء" : "Cancel"}
                </button>
                <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                  <Icon name="check" size={14} />
                  {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
