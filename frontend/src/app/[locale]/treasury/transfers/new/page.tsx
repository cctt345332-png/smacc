"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createVoucher } from "@/lib/treasury";
import { getAccounts, getFiscalYears, getBankAccounts } from "@/lib/accounting";

const today = () => new Date().toISOString().split("T")[0];

export default function NewTransferPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    voucher_date: today(), amount: "",
    bank_account_id: "", to_bank_account_id: "",
    debit_account_id: "", credit_account_id: "",
    fiscal_year_id: "", description_ar: "", reference: "", notes: "",
  });

  useEffect(() => {
    Promise.all([getAccounts(), getFiscalYears(), getBankAccounts()])
      .then(([a, f, b]) => {
        setAccounts(a.data); setFiscalYears(f.data); setBankAccounts(b.data);
        if (f.data.length) setForm(p => ({ ...p, fiscal_year_id: f.data[0].id }));
      });
  }, []);

  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async (post = false) => {
    if (!form.amount || !form.description_ar) return alert(ar ? "أدخل المبلغ والبيان" : "Enter amount and description");
    if (!form.debit_account_id || !form.credit_account_id) return alert(ar ? "حدد الحسابات" : "Select accounts");
    setSaving(true);
    try {
      const { data } = await createVoucher({
        ...form, voucher_type: "transfer", payment_method: "bank_transfer",
        amount: parseFloat(form.amount), vat_amount: 0,
        voucher_date: new Date(form.voucher_date).toISOString(),
        bank_account_id: form.bank_account_id || null,
        to_bank_account_id: form.to_bank_account_id || null,
        reference: form.reference || null, notes: form.notes || null,
      });
      if (post) { const { postVoucher } = await import("@/lib/treasury"); await postVoucher(data.id); }
      router.push(`/${locale}/treasury/transfers`);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/treasury/transfers`}>{ar ? "التحويلات" : "Transfers"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "تحويل جديد" : "New Transfer"}</span>
          </div>
          <h1 className="page-title">{ar ? "تحويل بنكي جديد" : "New Bank Transfer"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/treasury/transfers`} className="btn btn-secondary btn-sm">{ar ? "إلغاء" : "Cancel"}</Link>
          <button className="btn btn-secondary btn-sm" onClick={() => handleSave(false)} disabled={saving}>{ar ? "حفظ كمسودة" : "Save Draft"}</button>
          <button className="btn btn-primary btn-sm" onClick={() => handleSave(true)} disabled={saving}>{ar ? "حفظ وترحيل" : "Save & Post"}</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "بيانات التحويل" : "Transfer Details"}</span></div>
          <div className="card-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "التاريخ" : "Date"}</label>
                <input type="date" className="form-input" value={form.voucher_date} onChange={e => upd("voucher_date", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "المبلغ (ر.س)" : "Amount"} <span className="required">*</span></label>
                <input type="number" className="form-input" value={form.amount} onChange={e => upd("amount", e.target.value)} min="0" step="0.01" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "البيان" : "Description"} <span className="required">*</span></label>
              <input className="form-input" value={form.description_ar} onChange={e => upd("description_ar", e.target.value)} placeholder={ar ? "سبب التحويل..." : "Transfer reason..."} />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "من حساب بنكي" : "From Bank Account"}</label>
              <select className="form-input form-select" value={form.bank_account_id} onChange={e => upd("bank_account_id", e.target.value)}>
                <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "إلى حساب بنكي" : "To Bank Account"}</label>
              <select className="form-input form-select" value={form.to_bank_account_id} onChange={e => upd("to_bank_account_id", e.target.value)}>
                <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                {bankAccounts.filter(b => b.id !== form.bank_account_id).map(b => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "الحسابات المحاسبية" : "GL Accounts"}</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">{ar ? "حساب مدين (الحساب المستلم)" : "Debit Account (Receiving)"} <span className="required">*</span></label>
              <select className="form-input form-select" value={form.debit_account_id} onChange={e => upd("debit_account_id", e.target.value)}>
                <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "حساب دائن (الحساب المحوَّل منه)" : "Credit Account (Sending)"} <span className="required">*</span></label>
              <select className="form-input form-select" value={form.credit_account_id} onChange={e => upd("credit_account_id", e.target.value)}>
                <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "السنة المالية" : "Fiscal Year"}</label>
              <select className="form-input form-select" value={form.fiscal_year_id} onChange={e => upd("fiscal_year_id", e.target.value)}>
                {fiscalYears.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
