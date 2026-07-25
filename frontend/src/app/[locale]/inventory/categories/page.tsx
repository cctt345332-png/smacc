"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getCategories, createCategory } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";

export default function CategoriesPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name_ar: "", name_en: "", parent_id: "" });

  const load = async () => {
    try { const { data } = await getCategories(); setCategories(data); }
    catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name_ar) return alert(ar ? "اسم التصنيف مطلوب" : "Category name required");
    setSaving(true);
    try {
      await createCategory({ ...form, parent_id: form.parent_id || null });
      setShowModal(false);
      setForm({ name_ar: "", name_en: "", parent_id: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  // بناء شجرة التصنيفات
  const roots = categories.filter(c => !c.parent_id);
  const children = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/inventory`}>{ar ? "المخزون" : "Inventory"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "التصنيفات" : "Categories"}</span>
          </div>
          <h1 className="page-title">{ar ? "تصنيفات المنتجات" : "Product Categories"}</h1>
          <p className="page-subtitle">{ar ? "تنظيم الأصناف في تصنيفات رئيسية وفرعية" : "Organize items into main and sub categories"}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          <Icon name="plus" size={14} /> {ar ? "+ تصنيف جديد" : "+ New Category"}
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : categories.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}>
                <Icon name="box" size={24} />
              </div>
              <div className="empty-state-title">{ar ? "لا توجد تصنيفات" : "No categories yet"}</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                {ar ? "أضف تصنيفات لتنظيم منتجاتك" : "Add categories to organize your products"}
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                {ar ? "إضافة تصنيف" : "Add Category"}
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "التصنيف" : "Category"}</th>
                  <th>{ar ? "الاسم بالإنجليزي" : "English Name"}</th>
                  <th>{ar ? "النوع" : "Type"}</th>
                  <th>{ar ? "الأصناف" : "Items"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {roots.map(cat => (
                  <>
                    <tr key={cat.id} style={{ background: "#F8FAFC" }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary)" }} />
                          <span style={{ fontWeight: 700 }}>{cat.name_ar}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{cat.name_en || "—"}</td>
                      <td><span className="badge badge-info">{ar ? "رئيسي" : "Main"}</span></td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>—</td>
                      <td>
                        <button className="btn btn-ghost btn-sm btn-icon" title={ar ? "إضافة فرعي" : "Add Sub"}
                          onClick={() => { setForm(f => ({ ...f, parent_id: cat.id })); setShowModal(true); }}>
                          <Icon name="plus" size={14} />
                        </button>
                      </td>
                    </tr>
                    {children(cat.id).map(sub => (
                      <tr key={sub.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingInlineStart: 24 }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#94A3B8" }} />
                            <span style={{ fontSize: 13 }}>{sub.name_ar}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{sub.name_en || "—"}</td>
                        <td><span className="badge badge-gray">{ar ? "فرعي" : "Sub"}</span></td>
                        <td style={{ fontSize: 12, color: "var(--text-muted)" }}>—</td>
                        <td></td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 400 }} className="animate-slide">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>
                {form.parent_id
                  ? (ar ? "إضافة تصنيف فرعي" : "Add Sub Category")
                  : (ar ? "تصنيف جديد" : "New Category")}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowModal(false); setForm({ name_ar: "", name_en: "", parent_id: "" }); }}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              {form.parent_id && (
                <div style={{ background: "#EFF6FF", borderRadius: 8, padding: "8px 12px", marginBottom: 16, fontSize: 12, color: "#1E40AF" }}>
                  {ar ? "تصنيف فرعي تحت:" : "Sub category under:"} <strong>{categories.find(c => c.id === form.parent_id)?.name_ar}</strong>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{ar ? "الاسم بالعربي" : "Arabic Name"} <span className="required">*</span></label>
                <input className="form-input" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))}
                  placeholder={ar ? "مثال: جوالات آبل" : "e.g. Apple Phones"} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الاسم بالإنجليزي" : "English Name"}</label>
                <input className="form-input" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
                  placeholder="e.g. Apple Phones" />
              </div>
              {!form.parent_id && categories.length > 0 && (
                <div className="form-group">
                  <label className="form-label">{ar ? "تصنيف رئيسي (اختياري)" : "Parent Category (optional)"}</label>
                  <select className="form-input form-select" value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                    <option value="">{ar ? "— تصنيف رئيسي —" : "— Main Category —"}</option>
                    {roots.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => { setShowModal(false); setForm({ name_ar: "", name_en: "", parent_id: "" }); }}>
                  {ar ? "إلغاء" : "Cancel"}
                </button>
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
