"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getAccounts, createAccount, updateAccount, deleteAccount } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const TYPES = [
  { value: "asset", ar: "أصول", en: "Asset", color: "badge-info" },
  { value: "liability", ar: "خصوم", en: "Liability", color: "badge-danger" },
  { value: "equity", ar: "حقوق ملكية", en: "Equity", color: "badge-warning" },
  { value: "revenue", ar: "إيرادات", en: "Revenue", color: "badge-success" },
  { value: "expense", ar: "مصروفات", en: "Expense", color: "badge-gray" },
];

const NATURES = [
  { value: "debit", ar: "مدين", en: "Debit" },
  { value: "credit", ar: "دائن", en: "Credit" },
];

export default function ChartOfAccountsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [accounts, setAccounts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "", name_ar: "", name_en: "", account_type: "asset",
    nature: "debit", parent_id: "", opening_balance: "0",
    is_posting: true, allow_direct_posting: true, notes: "",
  });

  const load = async () => {
    try {
      const { data } = await getAccounts();
      setAccounts(data);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditItem(null);
    setForm({ code: "", name_ar: "", name_en: "", account_type: "asset", nature: "debit", parent_id: "", opening_balance: "0", is_posting: true, allow_direct_posting: true, notes: "" });
    setShowModal(true);
  };

  const openEdit = (acc: any) => {
    setEditItem(acc);
    setForm({ code: acc.code, name_ar: acc.name_ar, name_en: acc.name_en, account_type: acc.account_type, nature: acc.nature, parent_id: acc.parent_id || "", opening_balance: String(acc.opening_balance), is_posting: acc.is_posting, allow_direct_posting: acc.allow_direct_posting, notes: acc.notes || "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, opening_balance: parseFloat(form.opening_balance) || 0, parent_id: form.parent_id || null };
      if (editItem) await updateAccount(editItem.id, payload);
      else await createAccount(payload);
      setShowModal(false);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Error");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(ar ? "هل أنت متأكد من الحذف؟" : "Are you sure?")) return;
    try { await deleteAccount(id); load(); } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
  };

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.code.includes(q) || a.name_ar.includes(q) || a.name_en.toLowerCase().includes(q);
    const matchType = !filterType || a.account_type === filterType;
    return matchSearch && matchType;
  });

  const typeInfo = (type: string) => TYPES.find(t => t.value === type);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "دليل الحسابات" : "Chart of Accounts"}</span>
          </div>
          <h1 className="page-title">{ar ? "دليل الحسابات" : "Chart of Accounts"}</h1>
          <p className="page-subtitle">{ar ? "إدارة الهيكل المحاسبي للشركة" : "Manage your company's accounting structure"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <StructuredReportPrintButton locale={locale} title={ar ? "دليل الحسابات" : "Chart of Accounts"} subtitle={ar ? "الهيكل المحاسبي للشركة" : "Company account structure"} period={ar ? "كما في تاريخ الطباعة" : "As of print date"} orientation="landscape" reportCode={`COA-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`} metrics={[{ label: ar ? "إجمالي الحسابات" : "Total accounts", value: String(filtered.length), tone: "green" }, ...TYPES.map(t => ({ label: ar ? t.ar : t.en, value: String(accounts.filter(a => a.account_type === t.value).length), tone: "neutral" as const }))]} tables={[{ headers: [ar ? "الكود" : "Code", ar ? "اسم الحساب" : "Account name", ar ? "النوع" : "Type", ar ? "الطبيعة" : "Nature", ar ? "افتتاحي" : "Opening", ar ? "قابل للترحيل" : "Posting"], rows: filtered.map(a => [String(a.code), String(ar ? a.name_ar : a.name_en || a.name_ar), String(ar ? typeInfo(a.account_type)?.ar : typeInfo(a.account_type)?.en || a.account_type), a.nature === "debit" ? (ar ? "مدين" : "Debit") : (ar ? "دائن" : "Credit"), Number(a.opening_balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 }), a.is_posting ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")]) }]} />
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ {ar ? "حساب جديد" : "New Account"}</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input className="form-input" style={{ width: 240 }} placeholder={ar ? "بحث بالكود أو الاسم..." : "Search by code or name..."}
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-input form-select" style={{ width: 160 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">{ar ? "كل الأنواع" : "All Types"}</option>
            {TYPES.map(t => <option key={t.value} value={t.value}>{ar ? t.ar : t.en}</option>)}
          </select>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {filtered.length} {ar ? "حساب" : "accounts"}
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {TYPES.map(t => {
          const count = accounts.filter(a => a.account_type === t.value).length;
          return (
            <div key={t.value} className="card" style={{ padding: "14px 16px", cursor: "pointer" }}
              onClick={() => setFilterType(filterType === t.value ? "" : t.value)}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{ar ? t.ar : t.en}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{count}</div>
              <div style={{ marginTop: 6 }}><span className={`badge ${t.color}`}>{ar ? t.ar : t.en}</span></div>
            </div>
          );
        })}
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{ar ? "الإجمالي" : "Total"}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{accounts.length}</div>
          <div style={{ marginTop: 6 }}><span className="badge badge-info">{ar ? "حساب" : "Accounts"}</span></div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border)", margin: "0 auto 12px" }} /><div>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}><Icon name="journal" size={24} /></div>
              <div className="empty-state-title">{ar ? "لا توجد حسابات" : "No accounts found"}</div>
              <div className="empty-state-desc">{ar ? "أضف حسابك الأول لبدء العمل" : "Add your first account to get started"}</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الكود" : "Code"}</th>
                  <th>{ar ? "اسم الحساب" : "Account Name"}</th>
                  <th>{ar ? "النوع" : "Type"}</th>
                  <th>{ar ? "الطبيعة" : "Nature"}</th>
                  <th>{ar ? "المستوى" : "Level"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الرصيد الافتتاحي" : "Opening Balance"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(acc => {
                  const t = typeInfo(acc.account_type);
                  return (
                    <tr key={acc.id}>
                      <td><code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{acc.code}</code></td>
                      <td style={{ paddingInlineStart: `${(acc.level - 1) * 20 + 16}px` }}>
                        {acc.level > 1 && <span style={{ color: "var(--text-muted)", marginInlineEnd: 6 }}>└</span>}
                        <span style={{ fontWeight: acc.level === 1 ? 700 : 400 }}>{ar ? acc.name_ar : acc.name_en}</span>
                      </td>
                      <td><span className={`badge ${t?.color || "badge-gray"}`}>{ar ? t?.ar : t?.en}</span></td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                        {acc.nature === "debit" ? (ar ? "مدين" : "Debit") : (ar ? "دائن" : "Credit")}
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>{acc.level}</td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>
                        {Number(acc.opening_balance).toLocaleString("en-US", { minimumFractionDigits: 2 })} {ar ? "ر.س" : "SAR"}
                      </td>
                      <td>
                        <span className={`badge ${acc.is_active ? "badge-success" : "badge-gray"}`}>
                          {acc.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(acc)} title={ar ? "تعديل" : "Edit"}><Icon name="edit" size={14} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(acc.id)} title={ar ? "حذف" : "Delete"}><Icon name="trash" size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto" }} className="animate-slide">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{editItem ? (ar ? "تعديل حساب" : "Edit Account") : (ar ? "حساب جديد" : "New Account")}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "كود الحساب" : "Account Code"} <span className="required">*</span></label>
                  <input className="form-input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="1000" />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "الحساب الأب" : "Parent Account"}</label>
                  <select className="form-input form-select" value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                    <option value="">{ar ? "— بدون —" : "— None —"}</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {ar ? a.name_ar : a.name_en}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "الاسم بالعربي" : "Arabic Name"} <span className="required">*</span></label>
                  <input className="form-input" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} placeholder="النقدية" />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "الاسم بالإنجليزي" : "English Name"} <span className="required">*</span></label>
                  <input className="form-input" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} placeholder="Cash" />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "نوع الحساب" : "Account Type"}</label>
                  <select className="form-input form-select" value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}>
                    {TYPES.map(t => <option key={t.value} value={t.value}>{ar ? t.ar : t.en}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "طبيعة الحساب" : "Account Nature"}</label>
                  <select className="form-input form-select" value={form.nature} onChange={e => setForm(f => ({ ...f, nature: e.target.value }))}>
                    {NATURES.map(n => <option key={n.value} value={n.value}>{ar ? n.ar : n.en}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الرصيد الافتتاحي" : "Opening Balance"}</label>
                <input type="number" className="form-input" value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
                <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
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
