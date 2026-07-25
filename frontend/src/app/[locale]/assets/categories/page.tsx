"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getAssetCategories, createAssetCategory } from "@/lib/assets";
import { getAccounts } from "@/lib/accounting";

const DEFAULT_CATEGORIES = [
  { name_ar: "مباني وعقارات", name_en: "Buildings & Real Estate", useful_life_years: 25, depreciation_rate: 4 },
  { name_ar: "سيارات ومركبات", name_en: "Vehicles", useful_life_years: 5, depreciation_rate: 20 },
  { name_ar: "أجهزة وحاسبات", name_en: "Computers & Equipment", useful_life_years: 3, depreciation_rate: 33 },
  { name_ar: "أثاث ومعدات مكتبية", name_en: "Furniture & Office Equipment", useful_life_years: 10, depreciation_rate: 10 },
  { name_ar: "آلات ومعدات", name_en: "Machinery & Equipment", useful_life_years: 10, depreciation_rate: 10 },
];

export default function AssetCategoriesPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name_ar: "", name_en: "", depreciation_method: "straight_line",
    useful_life_years: "5", depreciation_rate: "20",
    asset_account_id: "", accumulated_dep_account_id: "",
    depreciation_expense_account_id: "", gain_on_disposal_account_id: "", loss_on_disposal_account_id: "",
  });

  const load = async () => {
    try {
      const [c, a] = await Promise.all([getAssetCategories(), getAccounts()]);
      setCategories(c.data); setAccounts(a.data);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name_ar) return alert(ar ? "أدخل اسم الفئة" : "Enter category name");
    setSaving(true);
    try {
      await createAssetCategory({
        ...form,
        useful_life_years: parseInt(form.useful_life_years),
        depreciation_rate: parseFloat(form.depreciation_rate),
        asset_account_id: form.asset_account_id || null,
        accumulated_dep_account_id: form.accumulated_dep_account_id || null,
        depreciation_expense_account_id: form.depreciation_expense_account_id || null,
        gain_on_disposal_account_id: form.gain_on_disposal_account_id || null,
        loss_on_disposal_account_id: form.loss_on_disposal_account_id || null,
      });
      setShowModal(false);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const loadDefault = (cat: any) => {
    setForm(f => ({ ...f, name_ar: cat.name_ar, name_en: cat.name_en, useful_life_years: String(cat.useful_life_years), depreciation_rate: String(cat.depreciation_rate) }));
    setShowModal(true);
  };

  const accOptions = accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/assets`}>{ar ? "الأصول الثابتة" : "Fixed Assets"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "فئات الأصول" : "Asset Categories"}</span>
          </div>
          <h1 className="page-title">{ar ? "فئات الأصول الثابتة" : "Asset Categories"}</h1>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm({ name_ar: "", name_en: "", depreciation_method: "straight_line", useful_life_years: "5", depreciation_rate: "20", asset_account_id: "", accumulated_dep_account_id: "", depreciation_expense_account_id: "", gain_on_disposal_account_id: "", loss_on_disposal_account_id: "" }); setShowModal(true); }}>
          + {ar ? "فئة جديدة" : "New Category"}
        </button>
      </div>

      {/* الفئات الافتراضية */}
      {categories.length === 0 && !loading && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">{ar ? "فئات جاهزة — اضغط لإضافة" : "Ready-made Categories — Click to Add"}</span>
          </div>
          <div className="card-body">
            <div className="grid-3">
              {DEFAULT_CATEGORIES.map(cat => (
                <div key={cat.name_ar} className="card" style={{ padding: 14, cursor: "pointer", border: "1px dashed var(--border)" }}
                  onClick={() => loadDefault(cat)}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{ar ? cat.name_ar : cat.name_en}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                    {ar ? `${cat.useful_life_years} سنة — ${cat.depreciation_rate}%` : `${cat.useful_life_years} years — ${cat.depreciation_rate}%`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border)", margin: "0 auto 12px" }} /></div>
          ) : categories.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{ar ? "لا توجد فئات" : "No categories"}</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الفئة" : "Category"}</th>
                  <th>{ar ? "طريقة الاستهلاك" : "Method"}</th>
                  <th>{ar ? "العمر الإنتاجي" : "Useful Life"}</th>
                  <th>{ar ? "نسبة الاستهلاك" : "Rate"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => (
                  <tr key={cat.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{ar ? cat.name_ar : cat.name_en}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? cat.name_en : cat.name_ar}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {cat.depreciation_method === "straight_line" ? (ar ? "قسط ثابت" : "Straight Line") : (ar ? "قسط متناقص" : "Declining")}
                    </td>
                    <td>{cat.useful_life_years} {ar ? "سنة" : "years"}</td>
                    <td>{cat.depreciation_rate}%</td>
                    <td><span className={`badge ${cat.is_active ? "badge-success" : "badge-gray"}`}>{cat.is_active ? (ar ? "نشطة" : "Active") : (ar ? "موقوفة" : "Inactive")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "90vh", overflow: "auto" }} className="animate-slide">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "فئة أصول جديدة" : "New Asset Category"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "الاسم بالعربي" : "Arabic Name"} <span className="required">*</span></label>
                  <input className="form-input" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "الاسم بالإنجليزي" : "English Name"}</label>
                  <input className="form-input" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} />
                </div>
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">{ar ? "طريقة الاستهلاك" : "Method"}</label>
                  <select className="form-input form-select" value={form.depreciation_method} onChange={e => setForm(f => ({ ...f, depreciation_method: e.target.value }))}>
                    <option value="straight_line">{ar ? "قسط ثابت" : "Straight Line"}</option>
                    <option value="declining_balance">{ar ? "قسط متناقص" : "Declining Balance"}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "العمر الإنتاجي (سنة)" : "Useful Life (Years)"}</label>
                  <input type="number" className="form-input" value={form.useful_life_years} onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))} min="1" />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "نسبة الاستهلاك %" : "Rate %"}</label>
                  <input type="number" className="form-input" value={form.depreciation_rate} onChange={e => setForm(f => ({ ...f, depreciation_rate: e.target.value }))} min="0" max="100" />
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>
                  {ar ? "ربط الحسابات المحاسبية" : "GL Account Mapping"}
                </div>
                {[
                  { key: "asset_account_id", label: ar ? "حساب الأصل" : "Asset Account" },
                  { key: "accumulated_dep_account_id", label: ar ? "مجمع الاستهلاك" : "Accumulated Depreciation" },
                  { key: "depreciation_expense_account_id", label: ar ? "مصروف الاستهلاك" : "Depreciation Expense" },
                  { key: "gain_on_disposal_account_id", label: ar ? "ربح التخلص" : "Gain on Disposal" },
                  { key: "loss_on_disposal_account_id", label: ar ? "خسارة التخلص" : "Loss on Disposal" },
                ].map(field => (
                  <div key={field.key} className="form-group">
                    <label className="form-label">{field.label}</label>
                    <select className="form-input form-select" value={(form as any)[field.key]} onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}>
                      <option value="">{ar ? "— اختياري —" : "— Optional —"}</option>
                      {accOptions}
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
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
