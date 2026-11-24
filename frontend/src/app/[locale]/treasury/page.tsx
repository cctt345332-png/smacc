"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getTreasuries, createTreasury, updateTreasury, getTreasuryMovements } from "@/lib/treasury";
import { getAccounts } from "@/lib/accounting";

const money = (value: any) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TreasuryPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name_ar: "", branch_name: "", account_id: "", opening_balance: "0", notes: "" });

  const load = async () => {
    const [t, a] = await Promise.all([getTreasuries(), getAccounts()]);
    setTreasuries(t.data || []);
    setAccounts((a.data || []).filter((row: any) => row.is_active && row.is_posting && row.account_type === "asset"));
  };
  useEffect(() => { load().catch(() => {}); }, []);

  const openMovements = async (treasury: any) => {
    setSelected(treasury);
    const result = await getTreasuryMovements(treasury.id);
    setMovements(result.data?.movements || []);
  };
  const save = async () => {
    if (!form.name_ar.trim() || !form.account_id) return alert("أدخل اسم الخزينة واختر الحساب المحاسبي");
    setSaving(true);
    try {
      await createTreasury({ ...form, opening_balance: Number(form.opening_balance || 0) });
      setForm({ name_ar: "", branch_name: "", account_id: "", opening_balance: "0", notes: "" });
      setShowForm(false); await load();
    } catch (error: any) { alert(error?.response?.data?.detail || "تعذر إنشاء الخزينة"); }
    finally { setSaving(false); }
  };
  const toggle = async (treasury: any) => {
    try { await updateTreasury(treasury.id, { is_active: !treasury.is_active }); await load(); }
    catch (error: any) { alert(error?.response?.data?.detail || "تعذر تحديث الخزينة"); }
  };

  return <div>
    <div className="page-header">
      <div><div className="breadcrumb"><span>{ar ? "الخزينة والمدفوعات" : "Treasury"}</span></div><h1 className="page-title">{ar ? "الخزائن" : "Treasury Accounts"}</h1><p className="page-subtitle">{ar ? "إدارة خزائن المكتب والفروع وربطها بالحسابات المحاسبية" : "Manage office and branch cashboxes linked to accounting accounts"}</p></div>
      <div style={{ display: "flex", gap: 8 }}><Link href={`/${locale}/treasury/receipts/new`} className="btn btn-secondary">سند قبض</Link><Link href={`/${locale}/treasury/payments/new`} className="btn btn-secondary">سند صرف</Link><button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ إضافة خزينة</button></div>
    </div>
    {showForm && <div className="card" style={{ padding: 18, marginBottom: 18 }}><h2 style={{ marginTop: 0 }}>إضافة خزينة جديدة</h2><div className="grid-2"><div className="form-group"><label className="form-label">اسم الخزينة *</label><input className="form-input" value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} placeholder="خزينة المكتب الرئيسي" /></div><div className="form-group"><label className="form-label">الفرع</label><input className="form-input" value={form.branch_name} onChange={e => setForm({ ...form, branch_name: e.target.value })} placeholder="الفرع الرئيسي" /></div><div className="form-group"><label className="form-label">الحساب المحاسبي *</label><select className="form-input form-select" value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}><option value="">اختر حساب الخزينة من شجرة الحسابات</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.code} — {account.name_ar}</option>)}</select><div className="form-hint">يجب اختيار حساب أصول قابل للترحيل.</div></div><div className="form-group"><label className="form-label">الرصيد الافتتاحي</label><input className="form-input" type="number" min="0" step="0.01" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })} /></div></div><div className="form-group"><label className="form-label">ملاحظات</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div><div style={{ display: "flex", gap: 8 }}><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ الخزينة"}</button><button className="btn btn-secondary" onClick={() => setShowForm(false)}>إلغاء</button></div></div>}
    {treasuries.length === 0 ? <div className="card empty-state">لا توجد خزائن مضافة. أضف خزينة المكتب واربطها بحسابها المحاسبي.</div> : <div className="grid-3">{treasuries.map(treasury => <div className="card" key={treasury.id} style={{ padding: 18, opacity: treasury.is_active ? 1 : .6 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><h3 style={{ margin: 0 }}>{treasury.name_ar}</h3><div className="form-hint">{treasury.branch_name || "بدون فرع محدد"}</div></div><span className={`badge ${treasury.is_active ? "badge-success" : "badge-gray"}`}>{treasury.is_active ? "فعالة" : "موقوفة"}</span></div><div style={{ fontSize: 27, fontWeight: 800, color: "#3E0865", margin: "18px 0 8px" }}>{money(treasury.balance)} <small style={{ fontSize: 12 }}>ر.س</small></div><div className="form-hint">الوارد {money(treasury.incoming)} — الصادر {money(treasury.outgoing)}</div><div className="form-hint" style={{ marginTop: 5 }}>الحساب: {treasury.account_id}</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }}><button className="btn btn-primary btn-sm" onClick={() => openMovements(treasury)}>كشف الحركات</button><Link href={`/${locale}/treasury/receipts/new?treasury_id=${treasury.id}`} className="btn btn-secondary btn-sm">قبض</Link><Link href={`/${locale}/treasury/payments/new?treasury_id=${treasury.id}`} className="btn btn-secondary btn-sm">صرف</Link><button className="btn btn-ghost btn-sm" onClick={() => toggle(treasury)}>{treasury.is_active ? "إيقاف" : "تفعيل"}</button></div></div>)}</div>}
    {selected && <div className="card" style={{ padding: 18, marginTop: 20 }}><div className="card-header" style={{ padding: 0, marginBottom: 12 }}><h2 className="card-title">كشف خزينة: {selected.name_ar}</h2><button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>إغلاق</button></div><div className="table-wrapper"><table><thead><tr><th>التاريخ</th><th>رقم المستند</th><th>البيان</th><th>وارد</th><th>صادر</th><th>الرصيد</th></tr></thead><tbody>{movements.map((row: any, index) => <tr key={`${row.voucher_id || "opening"}-${index}`}><td>{row.date ? new Date(row.date).toLocaleDateString("ar-SA") : "—"}</td><td>{row.voucher_number}</td><td>{row.description_ar}</td><td style={{ color: "#15803d" }}>{row.incoming ? `${money(row.incoming)} ر.س` : "—"}</td><td style={{ color: "#b91c1c" }}>{row.outgoing ? `${money(row.outgoing)} ر.س` : "—"}</td><td><b>{money(row.balance)} ر.س</b></td></tr>)}</tbody></table></div></div>}
  </div>;
}
