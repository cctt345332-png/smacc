"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createVoucher } from "@/lib/treasury";
import { getAccounts, getFiscalYears, getCostCenters, getBankAccounts } from "@/lib/accounting";

const today = () => new Date().toISOString().split("T")[0];
const CATS = [
  { value: "rent", ar: "إيجار" }, { value: "utilities", ar: "كهرباء وماء" },
  { value: "salaries", ar: "رواتب" }, { value: "maintenance", ar: "صيانة" },
  { value: "transport", ar: "مواصلات" }, { value: "marketing", ar: "تسويق" },
  { value: "office", ar: "مستلزمات مكتبية" }, { value: "insurance", ar: "تأمين" },
  { value: "government", ar: "رسوم حكومية" }, { value: "other", ar: "أخرى" },
];
const METHODS = [{ value: "cash", ar: "نقداً" }, { value: "bank_transfer", ar: "تحويل بنكي" }, { value: "cheque", ar: "شيك" }];

export default function NewExpensePage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    voucher_date: today(), amount: "", vat_amount: "0",
    payment_method: "cash", bank_account_id: "",
    expense_category: "other", party_name: "",
    debit_account_id: "", credit_account_id: "", vat_account_id: "",
    cost_center_id: "", fiscal_year_id: "",
    description_ar: "", reference: "", notes: "",
  });

  useEffect(() => {
    Promise.all([getAccounts(), getFiscalYears(), getCostCenters(), getBankAccounts()])
      .then(([a, f, cc, b]) => {
        setAccounts(a.data); setFiscalYears(f.data); setCostCenters(cc.data); setBankAccounts(b.data);
        if (f.data.length) setForm(p => ({ ...p, fiscal_year_id: f.data[0].id }));
      });
  }, []);

  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const vatAmt = parseFloat(form.vat_amount) || 0;
  const total = (parseFloat(form.amount) || 0) + vatAmt;

  const handleSave = async (post = false) => {
    if (!form.amount || !form.description_ar) return alert(ar ? "أدخل المبلغ والبيان" : "Enter amount and description");
    if (!form.debit_account_id || !form.credit_account_id) return alert(ar ? "حدد الحسابات" : "Select accounts");
    setSaving(true);
    try {
      const { data } = await createVoucher({
        ...form, voucher_type: "expense",
        amount: parseFloat(form.amount), vat_amount: vatAmt,
        voucher_date: new Date(form.voucher_date).toISOString(),
        bank_account_id: form.bank_account_id || null,
        party_type: "other", party_id: null,
        party_name: form.party_name || null,
        vat_account_id: form.vat_account_id || null,
        cost_center_id: form.cost_center_id || null,
        reference: form.reference || null, notes: form.notes || null,
      });
      if (post) { const { postVoucher } = await import("@/lib/treasury"); await postVoucher(data.id); }
      router.push(`/${locale}/treasury/expenses`);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/treasury/expenses`}>{ar ? "المصروفات" : "Expenses"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "مصروف جديد" : "New Expense"}</span>
          </div>
          <h1 className="page-title">{ar ? "تسجيل مصروف جديد" : "New Expense"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/treasury/expenses`} className="btn btn-secondary btn-sm">{ar ? "إلغاء" : "Cancel"}</Link>
          <button className="btn btn-secondary btn-sm" onClick={() => handleSave(false)} disabled={saving}>{ar ? "حفظ كمسودة" : "Save Draft"}</button>
          <button className="btn btn-primary btn-sm" onClick={() => handleSave(true)} disabled={saving}>{ar ? "حفظ وترحيل" : "Save & Post"}</button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "بيانات المصروف" : "Expense Details"}</span></div>
          <div className="card-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "التاريخ" : "Date"} <span className="required">*</span></label>
                <input type="date" className="form-input" value={form.voucher_date} onChange={e => upd("voucher_date", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "فئة المصروف" : "Category"}</label>
                <select className="form-input form-select" value={form.expense_category} onChange={e => upd("expense_category", e.target.value)}>
                  {CATS.map(c => <option key={c.value} value={c.value}>{c.ar}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "البيان" : "Description"} <span className="required">*</span></label>
              <input className="form-input" value={form.description_ar} onChange={e => upd("description_ar", e.target.value)} placeholder={ar ? "وصف المصروف..." : "Expense description..."} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "المبلغ قبل الضريبة (ر.س)" : "Amount (excl. VAT)"} <span className="required">*</span></label>
                <input type="number" className="form-input" value={form.amount} onChange={e => upd("amount", e.target.value)} min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "ضريبة القيمة المضافة (ر.س)" : "VAT Amount"}</label>
                <input type="number" className="form-input" value={form.vat_amount} onChange={e => upd("vat_amount", e.target.value)} min="0" step="0.01" />
              </div>
            </div>
            {total > 0 && (
              <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "10px 14px", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>{ar ? "الإجمالي شامل الضريبة:" : "Total incl. VAT:"}</span>
                <span style={{ fontWeight: 700, color: "var(--primary)" }}>{total.toLocaleString("en-US", { minimumFractionDigits: 2 })} SAR</span>
              </div>
            )}
            <div className="grid-2" style={{ marginTop: 12 }}>
              <div className="form-group">
                <label className="form-label">{ar ? "طريقة الدفع" : "Method"}</label>
                <select className="form-input form-select" value={form.payment_method} onChange={e => upd("payment_method", e.target.value)}>
                  {METHODS.map(m => <option key={m.value} value={m.value}>{m.ar}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الجهة" : "Paid To"}</label>
                <input className="form-input" value={form.party_name} onChange={e => upd("party_name", e.target.value)} placeholder={ar ? "اسم الجهة" : "Party name"} />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "الحسابات المحاسبية" : "GL Accounts"}</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">{ar ? "حساب مدين (المصروف)" : "Debit Account (Expense)"} <span className="required">*</span></label>
              <select className="form-input form-select" value={form.debit_account_id} onChange={e => upd("debit_account_id", e.target.value)}>
                <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                {accounts.filter(a => a.account_type === "expense").map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>)}
              </select>
            </div>
            {vatAmt > 0 && (
              <div className="form-group">
                <label className="form-label">{ar ? "حساب ضريبة المدخلات" : "Input VAT Account"}</label>
                <select className="form-input form-select" value={form.vat_account_id} onChange={e => upd("vat_account_id", e.target.value)}>
                  <option value="">{ar ? "— اختياري —" : "— Optional —"}</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">{ar ? "حساب دائن (البنك/الصندوق)" : "Credit Account (Bank/Cash)"} <span className="required">*</span></label>
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
    </>
  );
}
