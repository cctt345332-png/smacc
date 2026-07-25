"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createVoucher } from "@/lib/treasury";
import { getAccounts, getFiscalYears, getCostCenters, getBankAccounts } from "@/lib/accounting";
import { getCustomers } from "@/lib/sales";
import { getVendors } from "@/lib/purchases";

const today = () => new Date().toISOString().split("T")[0];
const METHODS = [
  { value: "cash", ar: "نقداً", en: "Cash" },
  { value: "bank_transfer", ar: "تحويل بنكي", en: "Bank Transfer" },
  { value: "cheque", ar: "شيك", en: "Cheque" },
  { value: "mada", ar: "مدى", en: "Mada" },
  { value: "stc_pay", ar: "STC Pay", en: "STC Pay" },
];

export default function NewReceiptPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    voucher_date: today(),
    amount: "", vat_amount: "0",
    payment_method: "cash",
    bank_account_id: "",
    cheque_number: "", cheque_date: "",
    party_type: "customer", party_id: "", party_name: "",
    invoice_id: "",
    debit_account_id: "", credit_account_id: "",
    vat_account_id: "",
    cost_center_id: "", fiscal_year_id: "",
    description_ar: "", description_en: "",
    reference: "", notes: "",
  });

  useEffect(() => {
    Promise.all([getAccounts(), getFiscalYears(), getCostCenters(), getBankAccounts(), getCustomers(), getVendors()])
      .then(([a, f, cc, b, c, v]) => {
        setAccounts(a.data); setFiscalYears(f.data);
        setCostCenters(cc.data); setBankAccounts(b.data);
        setCustomers(c.data); setVendors(v.data);
        if (f.data.length) setForm(p => ({ ...p, fiscal_year_id: f.data[0].id }));
      });
  }, []);

  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleCustomerChange = (id: string) => {
    const c = customers.find(x => x.id === id);
    setForm(p => ({ ...p, party_id: id, party_name: c?.name_ar || "", credit_account_id: c?.ar_account_id || p.credit_account_id }));
  };

  const handleSave = async (post = false) => {
    if (!form.amount || !form.description_ar) return alert(ar ? "أدخل المبلغ والبيان" : "Enter amount and description");
    if (!form.debit_account_id || !form.credit_account_id) return alert(ar ? "حدد حساب المدين والدائن" : "Select debit and credit accounts");
    setSaving(true);
    try {
      const { data } = await createVoucher({
        ...form,
        voucher_type: "receipt",
        amount: parseFloat(form.amount),
        vat_amount: parseFloat(form.vat_amount) || 0,
        voucher_date: new Date(form.voucher_date).toISOString(),
        cheque_date: form.cheque_date ? new Date(form.cheque_date).toISOString() : null,
        bank_account_id: form.bank_account_id || null,
        party_id: form.party_id || null,
        party_name: form.party_name || null,
        invoice_id: form.invoice_id || null,
        debit_account_id: form.debit_account_id || null,
        credit_account_id: form.credit_account_id || null,
        vat_account_id: form.vat_account_id || null,
        cost_center_id: form.cost_center_id || null,
        cheque_number: form.cheque_number || null,
        reference: form.reference || null,
        notes: form.notes || null,
      });
      if (post) {
        const { postVoucher } = await import("@/lib/treasury");
        await postVoucher(data.id);
      }
      router.push(`/${locale}/treasury/receipts`);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const showBank = ["bank_transfer", "cheque", "mada", "stc_pay"].includes(form.payment_method);
  const showCheque = form.payment_method === "cheque";

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/treasury/receipts`}>{ar ? "سندات القبض" : "Receipts"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "سند قبض جديد" : "New Receipt"}</span>
          </div>
          <h1 className="page-title">{ar ? "سند قبض جديد" : "New Receipt Voucher"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/treasury/receipts`} className="btn btn-secondary btn-sm">{ar ? "إلغاء" : "Cancel"}</Link>
          <button className="btn btn-secondary btn-sm" onClick={() => handleSave(false)} disabled={saving}>{ar ? "حفظ كمسودة" : "Save Draft"}</button>
          <button className="btn btn-primary btn-sm" onClick={() => handleSave(true)} disabled={saving}>{ar ? "حفظ وترحيل" : "Save & Post"}</button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* بيانات السند */}
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "بيانات السند" : "Voucher Details"}</span></div>
          <div className="card-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "التاريخ" : "Date"} <span className="required">*</span></label>
                <input type="date" className="form-input" value={form.voucher_date} onChange={e => upd("voucher_date", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "المبلغ (ر.س)" : "Amount (SAR)"} <span className="required">*</span></label>
                <input type="number" className="form-input" value={form.amount} onChange={e => upd("amount", e.target.value)} min="0" step="0.01" placeholder="0.00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "البيان" : "Description"} <span className="required">*</span></label>
              <input className="form-input" value={form.description_ar} onChange={e => upd("description_ar", e.target.value)} placeholder={ar ? "وصف السند..." : "Voucher description..."} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "طريقة الدفع" : "Payment Method"}</label>
                <select className="form-input form-select" value={form.payment_method} onChange={e => upd("payment_method", e.target.value)}>
                  {METHODS.map(m => <option key={m.value} value={m.value}>{ar ? m.ar : m.en}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "المرجع" : "Reference"}</label>
                <input className="form-input" value={form.reference} onChange={e => upd("reference", e.target.value)} />
              </div>
            </div>
            {showBank && (
              <div className="form-group">
                <label className="form-label">{ar ? "الحساب البنكي" : "Bank Account"}</label>
                <select className="form-input form-select" value={form.bank_account_id} onChange={e => upd("bank_account_id", e.target.value)}>
                  <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>)}
                </select>
              </div>
            )}
            {showCheque && (
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "رقم الشيك" : "Cheque #"}</label>
                  <input className="form-input" value={form.cheque_number} onChange={e => upd("cheque_number", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "تاريخ الشيك" : "Cheque Date"}</label>
                  <input type="date" className="form-input" value={form.cheque_date} onChange={e => upd("cheque_date", e.target.value)} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* الجهة والحسابات */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">{ar ? "الجهة المدفوعة" : "Received From"}</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">{ar ? "نوع الجهة" : "Party Type"}</label>
                <select className="form-input form-select" value={form.party_type} onChange={e => {
                  upd("party_type", e.target.value);
                  setForm(p => ({ ...p, party_type: e.target.value, party_id: "", party_name: "" }));
                }}>
                  <option value="customer">{ar ? "عميل" : "Customer"}</option>
                  <option value="vendor">{ar ? "مورد" : "Vendor"}</option>
                  <option value="other">{ar ? "أخرى" : "Other"}</option>
                </select>
              </div>
              {form.party_type === "customer" ? (
                <div className="form-group">
                  <label className="form-label">{ar ? "العميل" : "Customer"}</label>
                  <select className="form-input form-select" value={form.party_id} onChange={e => handleCustomerChange(e.target.value)}>
                    <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.customer_number} — {c.name_ar}</option>)}
                  </select>
                </div>
              ) : form.party_type === "vendor" ? (
                <div className="form-group">
                  <label className="form-label">{ar ? "المورد" : "Vendor"}</label>
                  <select className="form-input form-select" value={form.party_id}
                    onChange={e => {
                      const v = vendors.find(x => x.id === e.target.value);
                      setForm(p => ({ ...p, party_id: e.target.value, party_name: v?.name_ar || "" }));
                    }}>
                    <option value="">{ar ? "— اختر المورد —" : "— Select Vendor —"}</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_number} — {v.name_ar}</option>)}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">{ar ? "اسم الجهة" : "Party Name"}</label>
                  <input className="form-input" value={form.party_name} onChange={e => upd("party_name", e.target.value)} />
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">{ar ? "الحسابات المحاسبية" : "GL Accounts"}</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">{ar ? "حساب مدين (البنك/الصندوق)" : "Debit Account (Bank/Cash)"} <span className="required">*</span></label>
                <select className="form-input form-select" value={form.debit_account_id} onChange={e => upd("debit_account_id", e.target.value)}>
                  <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "حساب دائن (القبض)" : "Credit Account (Receivable)"} <span className="required">*</span></label>
                <select className="form-input form-select" value={form.credit_account_id} onChange={e => upd("credit_account_id", e.target.value)}>
                  <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "السنة المالية" : "Fiscal Year"}</label>
                  <select className="form-input form-select" value={form.fiscal_year_id} onChange={e => upd("fiscal_year_id", e.target.value)}>
                    {fiscalYears.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "مركز التكلفة" : "Cost Center"}</label>
                  <select className="form-input form-select" value={form.cost_center_id} onChange={e => upd("cost_center_id", e.target.value)}>
                    <option value="">{ar ? "— اختياري —" : "— Optional —"}</option>
                    {costCenters.map(c => <option key={c.id} value={c.id}>{c.code} — {ar ? c.name_ar : c.name_en}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {form.notes !== undefined && (
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "ملاحظات" : "Notes"}</span></div>
          <div className="card-body">
            <textarea className="form-input" rows={2} value={form.notes} onChange={e => upd("notes", e.target.value)} />
          </div>
        </div>
      )}
    </>
  );
}
