"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

const STATUS = [
  ["new", "جديد"], ["received", "تم الاستلام"], ["inspecting", "قيد الفحص"],
  ["waiting_customer", "بانتظار موافقة العميل"], ["in_repair", "قيد الصيانة"],
  ["waiting_part", "بانتظار قطعة"], ["ready", "جاهز للتسليم"],
  ["delivered", "تم التسليم"], ["closed", "مغلق"], ["rejected", "مرفوض"], ["cancelled", "ملغي"],
] as const;

const emptyForm = {
  customer_id: "", product_id: "", serial_item_id: "", invoice_id: "", device_name: "",
  serial_number: "", imei_1: "", imei_2: "", reported_problem: "", device_condition: "",
  accessories_received: "", lock_type: "none", lock_secret: "", warranty_case: false,
};

export default function MaintenanceWorkspace({ locale, repOnly = false }: { locale: string; repOnly?: boolean }) {
  const ar = locale === "ar";
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/maintenance", { params: { status: status || undefined } });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || (ar ? "تعذر تحميل طلبات الصيانة" : "Could not load maintenance requests"));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status]);

  const setField = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));
  const create = async () => {
    if (!form.customer_id || !form.reported_problem) {
      setError(ar ? "العميل ووصف المشكلة مطلوبان" : "Customer and problem are required"); return;
    }
    setSaving(true); setError("");
    try {
      await api.post("/maintenance", {
        ...form,
        product_id: form.product_id || undefined,
        serial_item_id: form.serial_item_id || undefined,
        invoice_id: form.invoice_id || undefined,
        serial_number: form.serial_number || undefined,
        imei_1: form.imei_1 || undefined,
        imei_2: form.imei_2 || undefined,
        lock_secret: form.lock_secret || undefined,
      });
      setForm({ ...emptyForm }); setShowForm(false); setSuccess(ar ? "تم إنشاء طلب الصيانة" : "Maintenance request created"); load();
    } catch (e: any) { setError(e?.response?.data?.detail || (ar ? "تعذر إنشاء الطلب" : "Could not create request")); }
    finally { setSaving(false); }
  };
  const changeStatus = async (row: any, next: string) => {
    try { await api.post(`/maintenance/${row.id}/status`, { status: next }); load(); }
    catch (e: any) { setError(e?.response?.data?.detail || (ar ? "تعذر تغيير الحالة" : "Could not change status")); }
  };

  return <div dir={ar ? "rtl" : "ltr"}>
    <div className="page-header">
      <div><div className="breadcrumb"><span>{ar ? "الصيانة" : "Maintenance"}</span><span className="breadcrumb-sep">/</span><span>{ar ? "طلبات الصيانة" : "Requests"}</span></div>
        <h1 className="page-title">{ar ? "طلبات صيانة الجوالات" : "Mobile Maintenance"}</h1>
        <p className="page-subtitle">{ar ? "تتبع الجهاز من الاستلام حتى الإصلاح أو الاستبدال والتسليم" : "Track each device from intake to repair, replacement and delivery"}</p>
      </div>
      <button className="btn btn-primary" onClick={() => { setShowForm(true); setError(""); }}>{ar ? "+ طلب صيانة" : "+ New Request"}</button>
    </div>
    {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
    {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success}</div>}
    <div className="card" style={{ marginBottom: 16 }}><div className="card-body" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <select className="form-input form-select" style={{ width: 190 }} value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">{ar ? "كل الحالات" : "All statuses"}</option>{STATUS.map(([v, l]) => <option key={v} value={v}>{ar ? l : v}</option>)}
      </select><span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{rows.length} {ar ? "طلب" : "requests"}</span>
    </div></div>
    <div className="card"><div className="table-wrapper"><table><thead><tr>
      <th>{ar ? "رقم الطلب" : "Request"}</th><th>{ar ? "الجهاز / السيريال" : "Device / Serial"}</th><th>{ar ? "المشكلة" : "Problem"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "كلمة المرور" : "Lock"}</th><th>{ar ? "إجراء" : "Action"}</th>
    </tr></thead><tbody>{loading ? <tr><td colSpan={6}>{ar ? "جاري التحميل..." : "Loading..."}</td></tr> : rows.length === 0 ? <tr><td colSpan={6}>{ar ? "لا توجد طلبات" : "No requests"}</td></tr> : rows.map(row => <tr key={row.id}>
      <td><strong>{row.request_number}</strong><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{row.customer_id}</div></td>
      <td>{row.device_name || "—"}<div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{row.serial_number || row.imei_1 || "—"}</div></td>
      <td style={{ maxWidth: 240 }}>{row.reported_problem}</td>
      <td><select className="form-input form-select" value={row.status} onChange={e => changeStatus(row, e.target.value)}>{STATUS.map(([v, l]) => <option key={v} value={v}>{ar ? l : v}</option>)}</select></td>
      <td>{row.lock_secret_provided ? (row.lock_secret_returned ? (ar ? "أعيدت للعميل" : "Returned") : (ar ? "موجودة" : "Provided")) : (ar ? "لا يوجد" : "None")}</td>
      <td><button className="btn btn-secondary btn-sm" onClick={() => window.print()}>{ar ? "طباعة" : "Print"}</button></td>
    </tr>)}</tbody></table></div></div>
    {showForm && <div className="modal-backdrop" onClick={() => setShowForm(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
      <div className="modal-header"><h2>{ar ? "إنشاء طلب صيانة" : "New Maintenance Request"}</h2><button className="btn btn-ghost" onClick={() => setShowForm(false)}>×</button></div>
      <div className="modal-body" style={{ display: "grid", gap: 12 }}>
        <div className="form-grid-2"><label>{ar ? "معرّف العميل*" : "Customer ID*"}<input className="form-input" value={form.customer_id} onChange={e => setField("customer_id", e.target.value)} /></label><label>{ar ? "معرّف المنتج" : "Product ID"}<input className="form-input" value={form.product_id} onChange={e => setField("product_id", e.target.value)} /></label></div>
        <div className="form-grid-2"><label>{ar ? "معرّف السيريال" : "Serial item ID"}<input className="form-input" value={form.serial_item_id} onChange={e => setField("serial_item_id", e.target.value)} /></label><label>{ar ? "رقم السيريال" : "Serial number"}<input className="form-input" value={form.serial_number} onChange={e => setField("serial_number", e.target.value)} /></label></div>
        <div className="form-grid-2"><label>{ar ? "اسم الجهاز" : "Device name"}<input className="form-input" value={form.device_name} onChange={e => setField("device_name", e.target.value)} /></label><label>{ar ? "IMEI 1" : "IMEI 1"}<input className="form-input" value={form.imei_1} onChange={e => setField("imei_1", e.target.value)} /></label></div>
        <label>{ar ? "وصف المشكلة*" : "Reported problem*"}<textarea className="form-input" rows={3} value={form.reported_problem} onChange={e => setField("reported_problem", e.target.value)} /></label>
        <div className="form-grid-2"><label>{ar ? "نوع القفل" : "Lock type"}<select className="form-input form-select" value={form.lock_type} onChange={e => setField("lock_type", e.target.value)}><option value="none">{ar ? "لا يوجد" : "None"}</option><option value="screen_pin">PIN</option><option value="password">{ar ? "كلمة مرور" : "Password"}</option><option value="pattern">{ar ? "نمط" : "Pattern"}</option><option value="user_account">{ar ? "حساب مستخدم" : "User account"}</option></select></label><label>{ar ? "كلمة المرور / الرمز" : "Password / lock"}<input className="form-input" type="password" value={form.lock_secret} onChange={e => setField("lock_secret", e.target.value)} /></label></div>
        <label>{ar ? "الملحقات المستلمة" : "Accessories received"}<input className="form-input" value={form.accessories_received} onChange={e => setField("accessories_received", e.target.value)} /></label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={form.warranty_case} onChange={e => setField("warranty_case", e.target.checked)} />{ar ? "الحالة ضمن الضمان" : "Warranty case"}</label>
      </div><div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowForm(false)}>{ar ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" disabled={saving} onClick={create}>{saving ? (ar ? "جارٍ الحفظ..." : "Saving...") : (ar ? "حفظ الطلب" : "Save request")}</button></div>
    </div></div>}
  </div>;
}
