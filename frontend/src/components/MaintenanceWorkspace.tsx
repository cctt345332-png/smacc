"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { getCustomers } from "@/lib/sales";
import { getItems, getSerials } from "@/lib/inventory";

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
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [serials, setSerials] = useState<any[]>([]);
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
      const [requestResult, customerResult, itemResult] = await Promise.allSettled([
        api.get("/maintenance", { params: { status: status || undefined } }),
        getCustomers(),
        repOnly ? api.get("/inventory/items/picker") : getItems(),
      ]);
      if (requestResult.status === "fulfilled") setRows(Array.isArray(requestResult.value.data) ? requestResult.value.data : []);
      if (customerResult.status === "fulfilled") setCustomers(Array.isArray(customerResult.value.data) ? customerResult.value.data : []);
      if (itemResult.status === "fulfilled") setItems(Array.isArray(itemResult.value.data) ? itemResult.value.data : []);
      if (requestResult.status === "rejected") throw requestResult.reason;
    } catch (e: any) {
      setError(e?.response?.data?.detail || (ar ? "تعذر تحميل طلبات الصيانة" : "Could not load maintenance requests"));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status]);
  useEffect(() => {
    if (!form.product_id) { setSerials([]); return; }
    const serialRequest = repOnly
      ? api.get(`/inventory/items/${form.product_id}/available-serials`)
      : getSerials(form.product_id, "in_stock");
    serialRequest.then(res => setSerials(Array.isArray(res.data) ? res.data : [])).catch(() => setSerials([]));
  }, [form.product_id]);

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
      <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Link className="btn btn-secondary btn-sm" href={`/${locale}/maintenance/${row.id}/print?copy=rep`}>{ar ? "نسخة المندوب" : "Rep copy"}</Link><Link className="btn btn-ghost btn-sm" href={`/${locale}/maintenance/${row.id}/print?copy=maintenance`}>{ar ? "نسخة الصيانة" : "Technician copy"}</Link></td>
    </tr>)}</tbody></table></div></div>
    {showForm && <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(15, 23, 42, .42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}><div onClick={e => e.stopPropagation()} style={{ width: "min(820px, 100%)", maxHeight: "calc(100vh - 40px)", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 24px 60px rgba(15,23,42,.22)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}><div><h2 style={{ margin: 0, fontSize: 18, color: "var(--text-primary)" }}>{ar ? "إنشاء طلب صيانة" : "New Maintenance Request"}</h2><p style={{ margin: "5px 0 0", color: "var(--text-secondary)", fontSize: 12 }}>{ar ? "أدخل بيانات الجهاز والمشكلة قبل إرساله للصيانة" : "Enter the device and problem details before submitting"}</p></div><button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)} aria-label={ar ? "إغلاق" : "Close"}>×</button></div>
      <div style={{ display: "grid", gap: 16, padding: 22 }}>
        <div className="grid-2"><label className="form-group"><span className="form-label">{ar ? "العميل" : "Customer"} <span className="required">*</span></span><select className="form-input form-select" value={form.customer_id} onChange={e => setField("customer_id", e.target.value)}><option value="">{customers.length ? (ar ? "اختر العميل" : "Select customer") : (ar ? "لا توجد عملاء متاحة" : "No customers available")}</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name_ar || c.name_en} — {c.customer_number}</option>)}</select></label><label className="form-group"><span className="form-label">{ar ? "المنتج" : "Product"}</span><select className="form-input form-select" value={form.product_id} onChange={e => { setField("product_id", e.target.value); setField("serial_item_id", ""); setField("serial_number", ""); }}><option value="">{items.length ? (ar ? "اختر المنتج" : "Select product") : (ar ? "لا توجد منتجات متاحة" : "No products available")}</option>{items.map(i => <option key={i.id} value={i.id}>{i.name_ar || i.name_en}{i.sku ? ` — ${i.sku}` : ""}</option>)}</select></label></div>
        <div className="grid-2"><label className="form-group"><span className="form-label">{ar ? "السيريال" : "Serial"}</span><select className="form-input form-select" value={form.serial_item_id} onChange={e => { const s = serials.find(x => x.id === e.target.value || x.serial_id === e.target.value); setField("serial_item_id", e.target.value); setField("serial_number", s?.serial_number || ""); }} disabled={!form.product_id}><option value="">{form.product_id ? (serials.length ? (ar ? "اختر السيريال" : "Select serial") : (ar ? "لا توجد سيريالات متاحة" : "No serials available")) : (ar ? "اختر المنتج أولاً" : "Select product first")}</option>{serials.map(s => <option key={s.id || s.serial_id} value={s.id || s.serial_id}>{s.serial_number}</option>)}</select></label><label className="form-group"><span className="form-label">{ar ? "رقم الفاتورة" : "Invoice number"}</span><input className="form-input" value={form.invoice_id} onChange={e => setField("invoice_id", e.target.value)} placeholder={ar ? "اختياري" : "Optional"} /></label></div>
        <div className="grid-2"><label className="form-group"><span className="form-label">{ar ? "اسم الجهاز" : "Device name"}</span><input className="form-input" value={form.device_name} onChange={e => setField("device_name", e.target.value)} placeholder={ar ? "مثال: iPhone 15 Pro" : "e.g. iPhone 15 Pro"} /></label><label className="form-group"><span className="form-label">IMEI 1</span><input className="form-input" value={form.imei_1} onChange={e => setField("imei_1", e.target.value)} /></label></div>
        <label className="form-group"><span className="form-label">{ar ? "وصف المشكلة" : "Reported problem"} <span className="required">*</span></span><textarea className="form-input" rows={4} value={form.reported_problem} onChange={e => setField("reported_problem", e.target.value)} placeholder={ar ? "اشرح العطل كما وصفه العميل" : "Describe the issue reported by the customer"} /></label>
        <div className="grid-2"><label className="form-group"><span className="form-label">{ar ? "نوع القفل" : "Lock type"}</span><select className="form-input form-select" value={form.lock_type} onChange={e => setField("lock_type", e.target.value)}><option value="none">{ar ? "لا يوجد" : "None"}</option><option value="screen_pin">PIN</option><option value="password">{ar ? "كلمة مرور" : "Password"}</option><option value="pattern">{ar ? "نمط" : "Pattern"}</option><option value="user_account">{ar ? "حساب مستخدم" : "User account"}</option></select></label><label className="form-group"><span className="form-label">{ar ? "كلمة المرور / الرمز" : "Password / lock"}</span><input className="form-input" type="password" value={form.lock_secret} onChange={e => setField("lock_secret", e.target.value)} /></label></div>
        <label className="form-group"><span className="form-label">{ar ? "الملحقات المستلمة" : "Accessories received"}</span><input className="form-input" value={form.accessories_received} onChange={e => setField("accessories_received", e.target.value)} placeholder={ar ? "شاحن، كرتون، كابل..." : "Charger, box, cable..."} /></label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)" }}><input type="checkbox" checked={form.warranty_case} onChange={e => setField("warranty_case", e.target.checked)} />{ar ? "الحالة ضمن الضمان" : "Warranty case"}</label>
      </div><div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--border)", background: "var(--bg)" }}><button className="btn btn-secondary" onClick={() => setShowForm(false)}>{ar ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" disabled={saving} onClick={create}>{saving ? (ar ? "جارٍ الحفظ..." : "Saving...") : (ar ? "حفظ الطلب" : "Save request")}</button></div>
    </div></div>}
  </div>;
}
