"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createVoucher } from "@/lib/treasury";
import { getAccounts, getFiscalYears, getCostCenters, getBankAccounts } from "@/lib/accounting";
import { getAssets } from "@/lib/assets";
import { getVendors } from "@/lib/purchases";
import { getCustomers } from "@/lib/sales";

const today = () => new Date().toISOString().split("T")[0];
const METHODS = [
  { value: "cash", ar: "نقداً" }, { value: "bank_transfer", ar: "تحويل بنكي" },
  { value: "cheque", ar: "شيك" }, { value: "mada", ar: "مدى" }, { value: "stc_pay", ar: "STC Pay" },
];

export default function NewPaymentPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [isAssetPurchase, setIsAssetPurchase] = useState(false);
  const [partyType, setPartyType] = useState<"vendor" | "customer" | "other">("vendor");
  const [form, setForm] = useState({
    voucher_date: today(), amount: "", payment_method: "cash",
    bank_account_id: "", cheque_number: "", cheque_date: "",
    party_id: "", party_name: "", asset_id: "",
    debit_account_id: "", credit_account_id: "",
    cost_center_id: "", fiscal_year_id: "",
    description_ar: "", reference: "", notes: "",
  });

  useEffect(() => {
    Promise.all([getAccounts(), getFiscalYears(), getCostCenters(), getBankAccounts(), getAssets(), getVendors(), getCustomers()])
      .then(([a, f, cc, b, ast, v, c]) => {
        setAccounts(a.data); setFiscalYears(f.data); setCostCenters(cc.data);
        setBankAccounts(b.data); setAssets(ast.data);
        setVendors(v.data); setCustomers(c.data);
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
        ...form, voucher_type: "payment",
        amount: parseFloat(form.amount), vat_amount: 0,
        voucher_date: new Date(form.voucher_date).toISOString(),
        cheque_date: form.cheque_date ? new Date(form.cheque_date).toISOString() : null,
        bank_account_id: form.bank_account_id || null,
        party_type: partyType,
        party_id: form.party_id || null,
        party_name: form.party_name || null,
        asset_id: isAssetPurchase && form.asset_id ? form.asset_id : null,
        cost_center_id: form.cost_center_id || null,
        cheque_number: form.cheque_number || null,
        reference: form.reference || null, notes: form.notes || null,
      });
      if (post) { const { postVoucher } = await import("@/lib/treasury"); await postVoucher(data.id); }
      router.push(`/${locale}/treasury/payments`);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/treasury/payments`}>{ar ? "سندات الصرف" : "Payments"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "سند صرف جديد" : "New Payment"}</span>
          </div>
          <h1 className="page-title">{ar ? "سند صرف جديد" : "New Payment Voucher"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/treasury/payments`} className="btn btn-secondary btn-sm">{ar ? "إلغاء" : "Cancel"}</Link>
          <button className="btn btn-secondary btn-sm" onClick={() => handleSave(false)} disabled={saving}>{ar ? "حفظ كمسودة" : "Save Draft"}</button>
          <button className="btn btn-primary btn-sm" onClick={() => handleSave(true)} disabled={saving}>{ar ? "حفظ وترحيل" : "Save & Post"}</button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "بيانات السند" : "Voucher Details"}</span></div>
          <div className="card-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "التاريخ" : "Date"} <span className="required">*</span></label>
                <input type="date" className="form-input" value={form.voucher_date} onChange={e => upd("voucher_date", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "المبلغ (ر.س)" : "Amount"} <span className="required">*</span></label>
                <input type="number" className="form-input" value={form.amount} onChange={e => upd("amount", e.target.value)} min="0" step="0.01" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "البيان" : "Description"} <span className="required">*</span></label>
              <input className="form-input" value={form.description_ar} onChange={e => upd("description_ar", e.target.value)} />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "طريقة الدفع" : "Method"}</label>
                <select className="form-input form-select" value={form.payment_method} onChange={e => upd("payment_method", e.target.value)}>
                  {METHODS.map(m => <option key={m.value} value={m.value}>{m.ar}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الجهة المدفوع لها" : "Paid To"}</label>
                {/* نوع الجهة */}
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {[
                    { key: "vendor",   ar: "مورد",  en: "Vendor" },
                    { key: "customer", ar: "عميل",  en: "Customer" },
                    { key: "other",    ar: "أخرى",  en: "Other" },
                  ].map(t => (
                    <button key={t.key} type="button"
                      onClick={() => { setPartyType(t.key as any); setForm(p => ({ ...p, party_id: "", party_name: "" })); }}
                      style={{
                        padding: "4px 12px", borderRadius: 6, border: "1px solid",
                        borderColor: partyType === t.key ? "var(--primary)" : "var(--border)",
                        background: partyType === t.key ? "var(--primary)" : "white",
                        color: partyType === t.key ? "white" : "var(--text-secondary)",
                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>
                      {ar ? t.ar : t.en}
                    </button>
                  ))}
                </div>
                {partyType === "vendor" && (
                  <select className="form-input form-select" value={form.party_id}
                    onChange={e => {
                      const v = vendors.find(x => x.id === e.target.value);
                      upd("party_id", e.target.value);
                      upd("party_name", v?.name_ar || "");
                    }}>
                    <option value="">{ar ? "— اختر المورد —" : "— Select Vendor —"}</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.vendor_number} — {v.name_ar}</option>)}
                  </select>
                )}
                {partyType === "customer" && (
                  <select className="form-input form-select" value={form.party_id}
                    onChange={e => {
                      const c = customers.find(x => x.id === e.target.value);
                      upd("party_id", e.target.value);
                      upd("party_name", c?.name_ar || "");
                    }}>
                    <option value="">{ar ? "— اختر العميل —" : "— Select Customer —"}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.customer_number} — {c.name_ar}</option>)}
                  </select>
                )}
                {partyType === "other" && (
                  <input className="form-input" value={form.party_name}
                    onChange={e => upd("party_name", e.target.value)}
                    placeholder={ar ? "اسم الجهة أو الشخص" : "Party or person name"} />
                )}
              </div>
            </div>
            {form.payment_method !== "cash" && (
              <div className="form-group">
                <label className="form-label">{ar ? "الحساب البنكي" : "Bank Account"}</label>
                <select className="form-input form-select" value={form.bank_account_id} onChange={e => upd("bank_account_id", e.target.value)}>
                  <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>)}
                </select>
              </div>
            )}

            {/* ── ربط الأصول الثابتة ── */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
                <input type="checkbox" checked={isAssetPurchase} onChange={e => setIsAssetPurchase(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
                {ar ? "هذا السند لشراء / صيانة أصل ثابت" : "This payment is for a fixed asset"}
              </label>
              {isAssetPurchase && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{ar ? "الأصل الثابت" : "Fixed Asset"}</label>
                  <select className="form-input form-select" value={form.asset_id} onChange={e => upd("asset_id", e.target.value)}>
                    <option value="">{ar ? "— اختر الأصل —" : "— Select Asset —"}</option>
                    {assets.map(a => <option key={a.id} value={a.id}>{a.asset_number} — {a.name_ar}</option>)}
                  </select>
                  {form.asset_id && (
                    <p className="form-hint" style={{ color: "#059669" }}>
                      {ar ? "سيتم تسجيل هذه الدفعة في سجل الأصل تلقائياً عند الترحيل" : "Payment will be recorded in asset history upon posting"}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "الحسابات المحاسبية" : "GL Accounts"}</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">{ar ? "حساب مدين (المصروف/الأصل)" : "Debit Account"} <span className="required">*</span></label>
              <select className="form-input form-select" value={form.debit_account_id} onChange={e => upd("debit_account_id", e.target.value)}>
                <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "حساب دائن (البنك/الصندوق)" : "Credit Account"} <span className="required">*</span></label>
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
