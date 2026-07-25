"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getFiscalYears, createFiscalYear, closeFiscalYear } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";

export default function FiscalYearsPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({
    name: `${ar ? "السنة المالية" : "Fiscal Year"} ${now.getFullYear()}`,
    start_date: `${now.getFullYear()}-01-01`,
    end_date: `${now.getFullYear()}-12-31`,
    is_default: true,
  });

  const load = async () => { try { const { data } = await getFiscalYears(); setItems(data); } catch {} finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await createFiscalYear({ ...form, start_date: new Date(form.start_date).toISOString(), end_date: new Date(form.end_date).toISOString() });
      setShowModal(false); load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const handleClose = async (id: string) => {
    if (!confirm(ar ? "إغلاق السنة المالية؟ لا يمكن التراجع." : "Close fiscal year? Cannot be undone.")) return;
    try { await closeFiscalYear(id); load(); } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
  };

  const statusColor = (s: string) => s === "open" ? "badge-success" : "badge-gray";
  const statusLabel = (s: string) => s === "open" ? (ar ? "مفتوحة" : "Open") : (ar ? "مغلقة" : "Closed");

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "السنوات المالية" : "Fiscal Years"}</span>
          </div>
          <h1 className="page-title">{ar ? "السنوات المالية" : "Fiscal Years"}</h1>
          <p className="page-subtitle">{ar ? "إدارة الفترات المحاسبية وإغلاق السنوات" : "Manage accounting periods and year-end closing"}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ {ar ? "سنة مالية جديدة" : "New Fiscal Year"}</button>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border)", margin: "0 auto 12px" }} /></div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}><Icon name="calendar" size={24} /></div>
              <div className="empty-state-title">{ar ? "لا توجد سنوات مالية" : "No fiscal years"}</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowModal(true)}>+ {ar ? "إضافة سنة" : "Add Year"}</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "اسم السنة" : "Name"}</th>
                  <th>{ar ? "تاريخ البداية" : "Start Date"}</th>
                  <th>{ar ? "تاريخ النهاية" : "End Date"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "افتراضية" : "Default"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(item.start_date).toLocaleDateString("en-SA")}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(item.end_date).toLocaleDateString("en-SA")}</td>
                    <td><span className={`badge ${statusColor(item.status)}`}>{statusLabel(item.status)}</span></td>
                    <td>{item.is_default ? <span className="badge badge-info">{ar ? "افتراضية" : "Default"}</span> : "—"}</td>
                    <td>
                      {item.status === "open" && (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleClose(item.id)}>
                          {ar ? "إغلاق" : "Close"}
                        </button>
                      )}
                    </td>
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
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "سنة مالية جديدة" : "New Fiscal Year"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group">
                <label className="form-label">{ar ? "اسم السنة المالية" : "Fiscal Year Name"} <span className="required">*</span></label>
                <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "تاريخ البداية" : "Start Date"}</label>
                  <input type="date" className="form-input" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "تاريخ النهاية" : "End Date"}</label>
                  <input type="date" className="form-input" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                  <input type="checkbox" checked={form.is_default} onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))} style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
                  {ar ? "تعيين كسنة مالية افتراضية" : "Set as default fiscal year"}
                </label>
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
