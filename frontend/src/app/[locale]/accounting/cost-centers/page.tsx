"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getCostCenters, createCostCenter } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";

export default function CostCentersPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", name_ar: "", name_en: "", parent_id: "" });

  const load = async () => { try { const { data } = await getCostCenters(); setItems(data); } catch {} finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.code || !form.name_ar) return alert(ar ? "أدخل الكود والاسم" : "Enter code and name");
    setSaving(true);
    try {
      await createCostCenter({ ...form, parent_id: form.parent_id || null });
      setShowModal(false);
      setForm({ code: "", name_ar: "", name_en: "", parent_id: "" });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "مراكز التكلفة" : "Cost Centers"}</span>
          </div>
          <h1 className="page-title">{ar ? "مراكز التكلفة" : "Cost Centers"}</h1>
          <p className="page-subtitle">{ar ? "توزيع المصروفات على مراكز التكلفة" : "Distribute expenses across cost centers"}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ {ar ? "مركز جديد" : "New Center"}</button>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border)", margin: "0 auto 12px" }} /></div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}><Icon name="building" size={24} /></div>
              <div className="empty-state-title">{ar ? "لا توجد مراكز تكلفة" : "No cost centers"}</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowModal(true)}>+ {ar ? "إضافة مركز" : "Add Center"}</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الكود" : "Code"}</th>
                  <th>{ar ? "الاسم" : "Name"}</th>
                  <th>{ar ? "المركز الأب" : "Parent"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td><code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{item.code}</code></td>
                    <td style={{ fontWeight: 500 }}>{ar ? item.name_ar : item.name_en}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                      {item.parent_id ? items.find(i => i.id === item.parent_id)?.[ar ? "name_ar" : "name_en"] || "—" : "—"}
                    </td>
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
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 480 }} className="animate-slide">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "مركز تكلفة جديد" : "New Cost Center"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "الكود" : "Code"} <span className="required">*</span></label>
                  <input className="form-input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="CC-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "المركز الأب" : "Parent"}</label>
                  <select className="form-input form-select" value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                    <option value="">{ar ? "— بدون —" : "— None —"}</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.code} — {ar ? i.name_ar : i.name_en}</option>)}
                  </select>
                </div>
              </div>
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
