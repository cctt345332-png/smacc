"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getBankAccounts, createBankAccount } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";

export default function BankAccountsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bank_name: "", account_name: "", account_number: "", iban: "", opening_balance: "0" });

  const load = async () => { try { const { data } = await getBankAccounts(); setItems(data); } catch {} finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.bank_name || !form.account_number) return alert(ar ? "أدخل اسم البنك ورقم الحساب" : "Enter bank name and account number");
    setSaving(true);
    try {
      await createBankAccount({ ...form, opening_balance: parseFloat(form.opening_balance) || 0, iban: form.iban || null });
      setShowModal(false);
      setForm({ bank_name: "", account_name: "", account_number: "", iban: "", opening_balance: "0" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const fmt = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 });

  const BANKS = ["البنك الأهلي السعودي", "بنك الراجحي", "بنك الرياض", "البنك السعودي الفرنسي", "بنك البلاد", "بنك الجزيرة", "بنك ساب", "بنك الإنماء"];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الحسابات البنكية" : "Bank Accounts"}</span>
          </div>
          <h1 className="page-title">{ar ? "الحسابات البنكية" : "Bank Accounts"}</h1>
          <p className="page-subtitle">{ar ? "إدارة الحسابات البنكية للشركة" : "Manage company bank accounts"}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ {ar ? "حساب بنكي جديد" : "New Bank Account"}</button>
      </div>

      {/* Summary */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#5A187E18", color: "#5A187E" }}><Icon name="bank" size={20} /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "عدد الحسابات" : "Total Accounts"}</div>
            <div className="stat-value">{items.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#6F4A8418", color: "#6F4A84" }}><Icon name="money" size={20} /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "إجمالي الأرصدة" : "Total Balance"}</div>
            <div className="stat-value">{fmt(items.reduce((s, i) => s + Number(i.opening_balance), 0))} {ar ? "ر.س" : "SAR"}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#D9770618", color: "#D97706" }}><Icon name="check" size={20} /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "حسابات نشطة" : "Active Accounts"}</div>
            <div className="stat-value">{items.filter(i => i.is_active).length}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border)", margin: "0 auto 12px" }} /></div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border)", margin: "0 auto 12px" }} />
              <div className="empty-state-title">{ar ? "لا توجد حسابات بنكية" : "No bank accounts"}</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowModal(true)}>+ {ar ? "إضافة حساب" : "Add Account"}</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "البنك" : "Bank"}</th>
                  <th>{ar ? "اسم الحساب" : "Account Name"}</th>
                  <th>{ar ? "رقم الحساب" : "Account Number"}</th>
                  <th>{ar ? "الآيبان" : "IBAN"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الرصيد الافتتاحي" : "Opening Balance"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.bank_name}</td>
                    <td>{item.account_name}</td>
                    <td><code style={{ fontSize: 12 }}>{item.account_number}</code></td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.iban || "—"}</td>
                    <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(Number(item.opening_balance))} {ar ? "ر.س" : "SAR"}</td>
                    <td><span className={`badge ${item.is_active ? "badge-success" : "badge-gray"}`}>{item.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 520 }} className="animate-slide">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "حساب بنكي جديد" : "New Bank Account"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group">
                <label className="form-label">{ar ? "البنك" : "Bank"} <span className="required">*</span></label>
                <input className="form-input" list="banks-list" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder={ar ? "اسم البنك" : "Bank name"} />
                <datalist id="banks-list">{BANKS.map(b => <option key={b} value={b} />)}</datalist>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "اسم الحساب" : "Account Name"}</label>
                  <input className="form-input" value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "رقم الحساب" : "Account Number"} <span className="required">*</span></label>
                  <input className="form-input" value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "رقم الآيبان" : "IBAN"}</label>
                <input className="form-input" value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))} placeholder="SA0000000000000000000000" maxLength={24} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الرصيد الافتتاحي" : "Opening Balance"}</label>
                <input type="number" className="form-input" value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))} min="0" step="0.01" />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "..." : (ar ? "حفظ" : "Save")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
