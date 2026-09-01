"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getRep, getRepCustomerPermissions, updateRepCustomerPermissions } from "@/lib/reps";

const FIELDS = [
  ["name_ar", "اسم العميل بالعربي"],
  ["name_en", "اسم العميل بالإنجليزي"],
  ["phone", "الهاتف"],
  ["address_city", "المدينة"],
  ["vat_number", "الرقم الضريبي"],
  ["national_id", "رقم الهوية"],
  ["payment_terms_days", "شروط الدفع"],
  ["notes", "ملاحظات العميل"],
  ["latitude", "موقع العميل - خط العرض"],
  ["longitude", "موقع العميل - خط الطول"],
] as const;

export default function RepCustomerPermissionsPage(props: { params: Promise<{ locale: string; rep_id: string }> }) {
  const { locale, rep_id } = use(props.params);
  const ar = locale === "ar";
  const [rep, setRep] = useState<any>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({ latitude: true, longitude: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([getRep(rep_id), getRepCustomerPermissions(rep_id)])
      .then(([r, p]) => { setRep(r.data); setPermissions({ latitude: true, longitude: true, ...(p.data?.permissions || {}) }); })
      .catch(() => setMessage(ar ? "تعذر تحميل الإعدادات" : "Unable to load settings"))
      .finally(() => setLoading(false));
  }, [rep_id, ar]);

  const save = async () => {
    setSaving(true); setMessage("");
    try { await updateRepCustomerPermissions(rep_id, permissions); setMessage(ar ? "تم حفظ إعدادات المندوب" : "Rep settings saved"); }
    catch { setMessage(ar ? "تعذر حفظ الإعدادات" : "Unable to save settings"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="empty-state">{ar ? "جاري التحميل..." : "Loading..."}</div>;
  return <div className="page-container" style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
    <div className="breadcrumb"><Link href={`/${locale}/reps/manage`}>{ar ? "إدارة المناديب" : "Manage Reps"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "إعدادات المندوب" : "Rep Settings"}</span></div>
    <div className="page-header" style={{ marginTop: 12 }}><div><h1 className="page-title">{ar ? "إعدادات المندوب" : "Rep Settings"}</h1><p className="page-subtitle">{rep?.full_name} — {ar ? "صلاحيات تعديل حقول العملاء" : "Customer field edit permissions"}</p></div></div>
    <div className="card">
      <div className="card-header"><span className="card-title">{ar ? "السماح بتعديل بيانات العملاء" : "Allow customer field editing"}</span></div>
      <div className="card-body"><p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 0 }}>{ar ? "فعّل الحقول التي يستطيع هذا المندوب تعديلها. الموقع مفعل افتراضيًا حتى يتمكن من حفظ موقع المحل." : "Enable only the fields this rep may edit. Location is enabled by default so the rep can save the shop location."}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
          {FIELDS.map(([key, label]) => <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer" }}><input type="checkbox" checked={!!permissions[key]} onChange={e => setPermissions(p => ({ ...p, [key]: e.target.checked }))} /><span>{ar ? label : key}</span></label>)}
        </div>
        {message && <div style={{ marginTop: 16, color: message.includes("تعذر") || message.includes("Unable") ? "#B42318" : "#16794C" }}>{message}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ الإعدادات" : "Save settings")}</button><Link className="btn btn-secondary" href={`/${locale}/reps/manage`}>{ar ? "رجوع" : "Back"}</Link></div>
      </div>
    </div>
  </div>;
}
