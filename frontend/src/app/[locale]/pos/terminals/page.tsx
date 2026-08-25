"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getTerminals, createTerminal, updateTerminal, deleteTerminal } from "@/lib/pos";
import { getAccounts, getFiscalYears, getBankAccounts } from "@/lib/accounting";
import { getWarehouses } from "@/lib/inventory";
import { getCompany } from "@/lib/settings";
import { Icon } from "@/components/ui/Icons";
import api from "@/lib/api";

const ACTIVITY_CFG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  mobile_phones: { label: "جوالات وإلكترونيات", icon: "mobile",       color: "#587795", bg: "#EFF6FF" },
  spare_parts:   { label: "قطع غيار",            icon: "spareParts",   color: "#5D7E9F", bg: "#F5F3FF" },
  pharmacy:      { label: "صيدلية",              icon: "pharmacy",     color: "#059669", bg: "#ECFDF5" },
  grocery:       { label: "بقالة",               icon: "grocery",      color: "#D97706", bg: "#FFFBEB" },
  spices:        { label: "عطارة وتوابل",         icon: "spices",       color: "#B45309", bg: "#FEF3C7" },
  clothing:      { label: "ملابس وأزياء",         icon: "clothing",     color: "#EC4899", bg: "#FDF2F8" },
  construction:  { label: "مواد بناء",            icon: "construction", color: "#64748B", bg: "#F1F5F9" },
  general:       { label: "عام",                 icon: "general",      color: "#0F172A", bg: "#F8FAFC" },
};

const POS_PURCHASE_ACTIVITIES = new Set(["mobile_phones", "spare_parts"]);

export default function POSTerminalsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";

  const [terminals,    setTerminals]    = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [companyBT,    setCompanyBT]    = useState("general");
  const [showModal,    setShowModal]    = useState(false);
  const [editing,      setEditing]      = useState<any>(null);
  const [saving,       setSaving]       = useState(false);
  const [accounts,     setAccounts]     = useState<any[]>([]);
  const [fiscalYears,  setFiscalYears]  = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [warehouses,   setWarehouses]   = useState<any[]>([]);
  const [users,        setUsers]        = useState<any[]>([]);

  const emptyForm = {
    name: "", branch_name: "",
    warehouse_id: "", cash_account_id: "", sales_account_id: "",
    vat_account_id: "", bank_account_id: "", fiscal_year_id: "",
    receipt_header: "", receipt_footer: "",
    print_receipt: true, allow_discount: true,
    max_discount_pct: "10",
    assigned_user_id: "",
  };
  const [form, setForm] = useState<any>(emptyForm);

  const load = async () => {
    try {
      const { data } = await getTerminals();
      setTerminals(data || []);
    } catch { setTerminals([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    getCompany().then((r) => setCompanyBT(r.data?.business_type || "general")).catch(() => {});
    Promise.all([getAccounts(), getFiscalYears(), getBankAccounts(), getWarehouses()])
      .then(([a, f, b, w]) => {
        setAccounts(a.data || []);
        setFiscalYears(f.data || []);
        setBankAccounts(b.data || []);
        setWarehouses(w.data || []);
      }).catch(() => {});
    // جلب المستخدمين ذوي دور cashier
    api.get("/auth/users").then((r) => {
      const cashiers = (r.data || []).filter((u: any) =>
        ["cashier", "manager", "admin"].includes(u.role)
      );
      setUsers(cashiers);
    }).catch(() => {});
  }, []);

  const cfg = ACTIVITY_CFG[companyBT] || ACTIVITY_CFG.general;
  const allowPurchase = POS_PURCHASE_ACTIVITIES.has(companyBT);

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const openCreate = () => {
    // ملء الحسابات تلقائياً من دليل الحسابات
    const cashAcc    = accounts.find((a: any) => a.code === "1111" || (a.account_type === "asset" && a.name_ar.includes("صندوق")));
    const salesAcc   = accounts.find((a: any) => a.code === "411"  || (a.account_type === "revenue" && a.name_ar.includes("مبيعات")));
    const vatAcc     = accounts.find((a: any) => a.code === "212"  || a.name_ar.includes("ضريبة القيمة المضافة المخرجات"));
    const defaultFY  = fiscalYears.find((f: any) => f.is_default) || fiscalYears[0];
    const defaultWH  = warehouses.find((w: any) => w.is_default) || warehouses[0];
    const defaultBank= bankAccounts[0];

    setEditing(null);
    setForm({
      ...emptyForm,
      cash_account_id:  cashAcc?.id  || "",
      sales_account_id: salesAcc?.id || "",
      vat_account_id:   vatAcc?.id   || "",
      fiscal_year_id:   defaultFY?.id || "",
      warehouse_id:     defaultWH?.id || "",
      bank_account_id:  defaultBank?.id || "",
    });
    setShowModal(true);
  };
  const openEdit = (t: any) => {
    setEditing(t);
    setForm({
      name: t.name || "", branch_name: t.branch_name || "",
      warehouse_id: t.warehouse_id || "",
      cash_account_id: t.cash_account_id || "",
      sales_account_id: t.sales_account_id || "",
      vat_account_id: t.vat_account_id || "",
      bank_account_id: t.bank_account_id || "",
      fiscal_year_id: t.fiscal_year_id || "",
      receipt_header: t.receipt_header || "",
      receipt_footer: t.receipt_footer || "",
      print_receipt: t.print_receipt ?? true,
      allow_discount: t.allow_discount ?? true,
      max_discount_pct: String(t.max_discount_pct ?? "10"),
      assigned_user_id: t.assigned_user_id || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return alert(ar ? "اسم الجهاز مطلوب" : "Terminal name required");
    setSaving(true);
    try {
      const payload = {
        ...form,
        business_type: companyBT,
        allow_purchase: allowPurchase,
        max_discount_pct: parseFloat(form.max_discount_pct) || 10,
        warehouse_id:     form.warehouse_id     || null,
        cash_account_id:  form.cash_account_id  || null,
        sales_account_id: form.sales_account_id || null,
        vat_account_id:   form.vat_account_id   || null,
        bank_account_id:  form.bank_account_id  || null,
        fiscal_year_id:   form.fiscal_year_id   || null,
        receipt_header:   form.receipt_header   || null,
        receipt_footer:   form.receipt_footer   || null,
        assigned_user_id: form.assigned_user_id || null,
      };
      if (editing) await updateTerminal(editing.id, payload);
      else await createTerminal(payload);
      setShowModal(false);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (t: any) => {
    if (!confirm(ar ? `حذف "${t.name}"؟` : `Delete "${t.name}"?`)) return;
    try { await deleteTerminal(t.id); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
  };

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/pos`}>{ar ? "نقطة البيع" : "POS"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الأجهزة" : "Terminals"}</span>
          </div>
          <h1 className="page-title">{ar ? "أجهزة نقطة البيع" : "POS Terminals"}</h1>
          <p className="page-subtitle">
            {ar ? "جميع الأجهزة مرتبطة بنشاط الشركة" : "All terminals inherit the company activity"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* بادج النشاط الحالي */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 20,
            background: cfg.bg, color: cfg.color,
            fontSize: 12, fontWeight: 600,
            border: `1px solid ${cfg.color}30`,
          }}>
            <Icon name={cfg.icon as any} size={14} />
            {cfg.label}
          </div>
          <Link href={`/${locale}/pos/cashier`} className="btn btn-secondary">
            <Icon name="cashier" size={16} />
            {ar ? "فتح الكاشير" : "Open Cashier"}
          </Link>
          <button className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" size={16} />
            {ar ? "جهاز جديد" : "New Terminal"}
          </button>
        </div>
      </div>

      {/* ── نشاط الشركة notice ─────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px", borderRadius: 10, marginBottom: 20,
        background: cfg.bg, border: `1px solid ${cfg.color}25`,
        fontSize: 13, color: cfg.color,
      }}>
        <Icon name="info" size={16} />
        <span>
          {ar
            ? `نشاط الشركة: ${cfg.label} — جميع الأجهزة ترث هذا النشاط تلقائياً. لتغييره اذهب إلى `
            : `Company activity: ${cfg.label} — all terminals inherit this automatically. To change it go to `}
          <Link href={`/${locale}/settings/company`} style={{ fontWeight: 700, color: cfg.color, textDecoration: "underline" }}>
            {ar ? "إعدادات الشركة" : "Company Settings"}
          </Link>
        </span>
        {allowPurchase && (
          <span style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600 }}>
            <Icon name="purchase" size={13} />
            {ar ? "الشراء من POS مفعّل" : "POS Purchase enabled"}
          </span>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="empty-state">
          <div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
        </div>
      ) : terminals.length === 0 ? (
        <div className="empty-state" style={{ minHeight: "45vh" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: cfg.bg, display: "flex", alignItems: "center",
            justifyContent: "center", color: cfg.color, margin: "0 auto 16px",
          }}>
            <Icon name="terminal" size={32} />
          </div>
          <div className="empty-state-title">{ar ? "لا توجد أجهزة" : "No terminals yet"}</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            {ar ? "أضف جهاز كاشير لبدء البيع" : "Add a terminal to start selling"}
          </p>
          <button className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" size={16} />
            {ar ? "إضافة جهاز" : "Add Terminal"}
          </button>
        </div>
      ) : (
        <div className="grid-3">
          {terminals.map((t) => {
            const tcfg = ACTIVITY_CFG[t.business_type] || ACTIVITY_CFG.general;
            return (
              <div key={t.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: tcfg.bg, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: tcfg.color,
                  }}>
                    <Icon name={tcfg.icon as any} size={24} />
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(t)}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "var(--danger)" }} onClick={() => handleDelete(t)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{t.name}</div>
                {t.branch_name && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>{t.branch_name}</div>
                )}
                {t.assigned_user_id && (
                  <div style={{ fontSize: 12, color: "var(--primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="user" size={12} />
                    {users.find((u: any) => u.id === t.assigned_user_id)?.full_name ||
                     users.find((u: any) => u.id === t.assigned_user_id)?.email ||
                     (ar ? "مخصص لكاشير" : "Assigned")}
                  </div>
                )}

                <div style={{ marginBottom: 10 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: tcfg.color,
                    background: tcfg.bg, padding: "3px 10px", borderRadius: 20,
                    border: `1px solid ${tcfg.color}30`,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    <Icon name={tcfg.icon as any} size={11} />
                    {tcfg.label}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {t.allow_purchase && (
                    <span className="badge badge-info">
                      <Icon name="purchase" size={11} />
                      {ar ? "شراء من POS" : "POS Purchase"}
                    </span>
                  )}
                  {t.allow_discount && (
                    <span className="badge badge-gray">
                      {ar ? `خصم ${t.max_discount_pct}%` : `Disc ${t.max_discount_pct}%`}
                    </span>
                  )}
                  {t.print_receipt && (
                    <span className="badge badge-success">
                      <Icon name="print" size={11} />
                      {ar ? "طباعة" : "Print"}
                    </span>
                  )}
                </div>

                <Link
                  href={`/${locale}/pos/cashier?terminal=${t.id}`}
                  className="btn btn-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <Icon name="cashier" size={15} />
                  {ar ? "فتح الكاشير" : "Open Cashier"}
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal ───────────────────────────────────────────────────── */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 200, display: "flex", alignItems: "center",
          justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: "white", borderRadius: 16, width: "100%",
            maxWidth: 600, maxHeight: "90vh", display: "flex", flexDirection: "column",
          }}>
            {/* Header */}
            <div style={{
              padding: "18px 24px", borderBottom: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>
                  {editing ? (ar ? "تعديل الجهاز" : "Edit Terminal") : (ar ? "جهاز جديد" : "New Terminal")}
                </h2>
                {/* النشاط من الشركة — للعرض فقط */}
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  marginTop: 6, padding: "3px 10px", borderRadius: 20,
                  background: cfg.bg, color: cfg.color,
                  fontSize: 11, fontWeight: 600,
                }}>
                  <Icon name={cfg.icon as any} size={12} />
                  {cfg.label}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>

              {/* الاسم والفرع */}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    {ar ? "اسم الجهاز" : "Terminal Name"} <span className="required">*</span>
                  </label>
                  <input className="form-input" value={form.name}
                    onChange={(e) => upd("name", e.target.value)}
                    placeholder={ar ? "كاشير 1 — الفرع الرئيسي" : "Cashier 1 — Main Branch"} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "الفرع" : "Branch"}</label>
                  <input className="form-input" value={form.branch_name}
                    onChange={(e) => upd("branch_name", e.target.value)}
                    placeholder={ar ? "الفرع الرئيسي" : "Main Branch"} />
                </div>
              </div>

              {/* المستخدم المخصص */}
              <div className="form-group">
                <label className="form-label">
                  {ar ? "الكاشير المخصص لهذا الجهاز" : "Assigned Cashier"}
                </label>
                <select className="form-input form-select" value={form.assigned_user_id}
                  onChange={(e) => upd("assigned_user_id", e.target.value)}>
                  <option value="">{ar ? "— بدون تخصيص (أي كاشير يقدر يفتحه) —" : "— No assignment (any cashier can open) —"}</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.email} — {u.role === "cashier" ? (ar ? "كاشير" : "Cashier") : u.role}
                    </option>
                  ))}
                </select>
                <p className="form-hint">
                  {ar
                    ? "إذا حددت مستخدماً، سيفتح الجهاز تلقائياً عند دخوله بدون اختيار"
                    : "If assigned, the terminal opens automatically when this user logs in"}
                </p>
              </div>

              {/* المستودع والسنة المالية */}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "المستودع الافتراضي" : "Default Warehouse"}</label>
                  <select className="form-input form-select" value={form.warehouse_id} onChange={(e) => upd("warehouse_id", e.target.value)}>
                    <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                    {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "السنة المالية" : "Fiscal Year"}</label>
                  <select className="form-input form-select" value={form.fiscal_year_id} onChange={(e) => upd("fiscal_year_id", e.target.value)}>
                    <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                    {fiscalYears.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <p className="form-hint">{ar ? "مطلوب لإنشاء الفواتير تلقائياً" : "Required for auto invoice creation"}</p>
                </div>
              </div>

              {/* الحسابات */}
              <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {ar ? "الحسابات المحاسبية" : "GL Accounts"}
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "حساب الصندوق" : "Cash Account"}</label>
                  <select className="form-input form-select" value={form.cash_account_id} onChange={(e) => upd("cash_account_id", e.target.value)}>
                    <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                    {accounts.filter((a: any) => a.account_type === "asset").map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "حساب الإيرادات" : "Sales Account"}</label>
                  <select className="form-input form-select" value={form.sales_account_id} onChange={(e) => upd("sales_account_id", e.target.value)}>
                    <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                    {accounts.filter((a: any) => a.account_type === "revenue").map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "حساب ضريبة القيمة المضافة" : "VAT Account"}</label>
                  <select className="form-input form-select" value={form.vat_account_id} onChange={(e) => upd("vat_account_id", e.target.value)}>
                    <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "الحساب البنكي (مدى/بطاقة)" : "Bank Account (Card)"}</label>
                  <select className="form-input form-select" value={form.bank_account_id} onChange={(e) => upd("bank_account_id", e.target.value)}>
                    <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                    {bankAccounts.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.bank_name} — {b.account_number}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* إعدادات الكاشير */}
              <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {ar ? "إعدادات الكاشير" : "Cashier Settings"}
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "الحد الأقصى للخصم %" : "Max Discount %"}</label>
                  <input type="number" className="form-input" value={form.max_discount_pct}
                    onChange={(e) => upd("max_discount_pct", e.target.value)} min="0" max="100" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 28 }}>
                  {[
                    { key: "allow_discount", label: ar ? "السماح بالخصم" : "Allow Discount" },
                    { key: "print_receipt",  label: ar ? "طباعة الإيصال تلقائياً" : "Auto Print Receipt" },
                  ].map(({ key, label }) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                      <input type="checkbox" checked={form[key]} onChange={(e) => upd(key, e.target.checked)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* الإيصال */}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "رأس الإيصال" : "Receipt Header"}</label>
                  <textarea className="form-input" rows={2} value={form.receipt_header}
                    onChange={(e) => upd("receipt_header", e.target.value)}
                    placeholder={ar ? "اسم الشركة، العنوان..." : "Company name, address..."}
                    style={{ resize: "none" }} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "ذيل الإيصال" : "Receipt Footer"}</label>
                  <textarea className="form-input" rows={2} value={form.receipt_footer}
                    onChange={(e) => upd("receipt_footer", e.target.value)}
                    placeholder={ar ? "شكراً لزيارتكم..." : "Thank you for your visit..."}
                    style={{ resize: "none" }} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: "14px 24px", borderTop: "1px solid var(--border)",
              display: "flex", gap: 8, justifyContent: "flex-end",
            }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                {ar ? "إلغاء" : "Cancel"}
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
