"use client";

import { use, useEffect, useState } from "react";
import {
  createBiometricDevice, deleteBiometricDevice, deleteBiometricLink,
  getBiometricDevices, getBiometricLinks, getEmployees,
  processBiometricLogs, saveBiometricLink,
} from "@/lib/hr";

export default function BiometricPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [devices, setDevices] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [device, setDevice] = useState({ name: "", serial_number: "", device_type: "zkteco", connection_mode: "adms", host: "", port: "443" });
  const [link, setLink] = useState({ device_id: "", employee_id: "", device_user_id: "" });
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [d, e, l] = await Promise.all([
        getBiometricDevices(), getEmployees({ status: "active" }), getBiometricLinks(),
      ]);
      setDevices(d.data || []); setEmployees(e.data || []); setLinks(l.data || []);
    } catch (e: any) { setMessage(e?.response?.data?.detail || "تعذر تحميل بيانات البصمة"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addDevice = async (ev: React.FormEvent) => {
    ev.preventDefault(); setMessage("");
    try {
      const r = await createBiometricDevice({ ...device, port: Number(device.port) || null });
      setKey(r.data?.device_key || "");
      setMessage(ar ? "تم حفظ الجهاز. احفظ مفتاح الجهاز إذا كنت تستخدم برنامج Windows." : "Device saved.");
      setDevice({ name: "", serial_number: "", device_type: "zkteco", connection_mode: "adms", host: "", port: "443" });
      await load();
    } catch (e: any) { setMessage(e?.response?.data?.detail || "تعذر حفظ الجهاز"); }
  };

  const addLink = async (ev: React.FormEvent) => {
    ev.preventDefault(); setMessage("");
    try {
      await saveBiometricLink(link);
      setMessage(ar ? "تم ربط الموظف بالجهاز. ستتم معالجة بصماته تلقائيًا." : "Employee linked.");
      setLink({ ...link, device_user_id: "" }); await load();
    } catch (e: any) { setMessage(e?.response?.data?.detail || "تعذر حفظ الربط"); }
  };

  const removeDevice = async (id: string, name: string) => {
    if (!confirm(ar ? `حذف الجهاز ${name}؟ سيتم حذف روابطه فقط ولن تُحذف سجلات الحضور اليومية.` : `Delete ${name}?`)) return;
    try { await deleteBiometricDevice(id); setMessage(ar ? "تم حذف الجهاز والروابط، وبقيت سجلات الحضور." : "Device deleted."); await load(); }
    catch (e: any) { setMessage(e?.response?.data?.detail || "تعذر حذف الجهاز"); }
  };

  const removeLink = async (id: string) => {
    if (!confirm(ar ? "حذف ربط الموظف؟ ستبقى سجلات الحضور القديمة." : "Remove this link?")) return;
    try { await deleteBiometricLink(id); setMessage(ar ? "تم حذف الربط." : "Link removed."); await load(); }
    catch (e: any) { setMessage(e?.response?.data?.detail || "تعذر حذف الربط"); }
  };

  const process = async () => {
    try { const r = await processBiometricLogs(); setMessage(ar ? `تمت معالجة ${r.data?.processed_logs || 0} سجل وإنشاء/تحديث ${r.data?.attendance_days || 0} يوم حضور.` : "Attendance processed."); }
    catch (e: any) { setMessage(e?.response?.data?.detail || "تعذر معالجة السجلات"); }
  };

  return <div>
    <div className="page-header">
      <div><h1 className="page-title">{ar ? "أجهزة البصمة" : "Biometric devices"}</h1><p className="page-subtitle">{ar ? "الاتصال، ربط الموظفين، وتحويل البصمات إلى حضور يومي" : "Devices, employee links and daily attendance"}</p></div>
      <button className="btn btn-primary" onClick={process}>{ar ? "معالجة البصمات الآن" : "Process now"}</button>
    </div>
    {message && <div className="alert alert-info" style={{ marginBottom: 16 }}>{message}</div>}
    {key && <div className="card" style={{ marginBottom: 16, borderColor: "#D97706" }}><div className="card-body"><b>{ar ? "مفتاح الجهاز — يظهر مرة واحدة فقط" : "Device key — shown once"}</b><code style={{ display: "block", marginTop: 8, wordBreak: "break-all" }}>{key}</code></div></div>}
    <div className="grid-2" style={{ alignItems: "start", gap: 16 }}>
      <form className="card" onSubmit={addDevice}><div className="card-header"><span className="card-title">{ar ? "إضافة جهاز" : "Add device"}</span></div><div className="card-body">
        <label className="form-label">{ar ? "اسم الجهاز" : "Name"}</label><input required className="form-input" value={device.name} onChange={e => setDevice({ ...device, name: e.target.value })} placeholder="جهاز فرع الرياض" />
        <label className="form-label" style={{ marginTop: 12 }}>{ar ? "الرقم التسلسلي للجهاز" : "Serial number"}</label><input required className="form-input" value={device.serial_number} onChange={e => setDevice({ ...device, serial_number: e.target.value.trim() })} placeholder="CQZ7224961017" />
        <label className="form-label" style={{ marginTop: 12 }}>{ar ? "نوع الاتصال" : "Connection"}</label><select className="form-input form-select" value={device.connection_mode} onChange={e => setDevice({ ...device, connection_mode: e.target.value })}><option value="adms">ADMS — اتصال سحابي</option><option value="agent">برنامج Windows</option><option value="tcp">TCP/IP داخلي</option></select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8, marginTop: 12 }}><div><label className="form-label">{ar ? "العنوان الداخلي" : "Host"}</label><input className="form-input" value={device.host} onChange={e => setDevice({ ...device, host: e.target.value })} placeholder="192.168.1.50" /></div><div><label className="form-label">{ar ? "المنفذ" : "Port"}</label><input className="form-input" value={device.port} onChange={e => setDevice({ ...device, port: e.target.value })} /></div></div>
        <button className="btn btn-primary" style={{ marginTop: 16 }}>{ar ? "حفظ الجهاز" : "Save device"}</button>
      </div></form>
      <form className="card" onSubmit={addLink}><div className="card-header"><span className="card-title">{ar ? "ربط موظف برقم المستخدم في الجهاز" : "Link employee"}</span></div><div className="card-body">
        <label className="form-label">{ar ? "الجهاز" : "Device"}</label><select required className="form-input form-select" value={link.device_id} onChange={e => setLink({ ...link, device_id: e.target.value })}><option value="">{ar ? "اختر الجهاز" : "Select device"}</option>{devices.map(d => <option key={d.id} value={d.id}>{d.name} — {d.serial_number}</option>)}</select>
        <label className="form-label" style={{ marginTop: 12 }}>{ar ? "الموظف" : "Employee"}</label><select required className="form-input form-select" value={link.employee_id} onChange={e => setLink({ ...link, employee_id: e.target.value })}><option value="">{ar ? "اختر الموظف" : "Select employee"}</option>{employees.map(e => <option key={e.id} value={e.id}>{e.full_name_ar} — {e.employee_number}</option>)}</select>
        <label className="form-label" style={{ marginTop: 12 }}>{ar ? "رقم المستخدم داخل الجهاز" : "Device user ID"}</label><input required className="form-input" value={link.device_user_id} onChange={e => setLink({ ...link, device_user_id: e.target.value })} placeholder="25" />
        <button className="btn btn-primary" style={{ marginTop: 16 }}>{ar ? "حفظ الربط" : "Save link"}</button>
      </div></form>
    </div>
    <div className="card" style={{ marginTop: 16 }}><div className="card-header"><span className="card-title">{ar ? "الأجهزة المسجلة" : "Registered devices"}</span></div><div className="table-wrapper"><table><thead><tr><th>{ar ? "الجهاز" : "Device"}</th><th>{ar ? "الرقم التسلسلي" : "Serial"}</th><th>{ar ? "آخر اتصال" : "Last sync"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "إجراء" : "Action"}</th></tr></thead><tbody>{loading ? <tr><td colSpan={5}>{ar ? "جاري التحميل..." : "Loading..."}</td></tr> : devices.length === 0 ? <tr><td colSpan={5}>{ar ? "لا توجد أجهزة" : "No devices"}</td></tr> : devices.map(d => <tr key={d.id}><td>{d.name}</td><td dir="ltr">{d.serial_number || "—"}</td><td>{d.last_sync_at ? new Date(d.last_sync_at).toLocaleString(ar ? "ar-SA" : "en-GB") : "—"}</td><td><span className={`badge ${d.last_sync_status?.includes("adms") ? "badge-success" : "badge-warning"}`}>{d.last_sync_status || (d.is_active ? (ar ? "فعال" : "Active") : (ar ? "موقوف" : "Inactive"))}</span></td><td><button type="button" className="btn btn-danger" onClick={() => removeDevice(d.id, d.name)}>{ar ? "حذف الجهاز" : "Delete"}</button></td></tr>)}</tbody></table></div></div>
    <div className="card" style={{ marginTop: 16 }}><div className="card-header"><span className="card-title">{ar ? "روابط الموظفين" : "Employee links"}</span></div><div className="table-wrapper"><table><thead><tr><th>{ar ? "الموظف" : "Employee"}</th><th>{ar ? "الجهاز" : "Device"}</th><th>{ar ? "رقم المستخدم" : "Device user ID"}</th><th>{ar ? "إجراء" : "Action"}</th></tr></thead><tbody>{links.length === 0 ? <tr><td colSpan={4}>{ar ? "لا توجد روابط" : "No links"}</td></tr> : links.map(x => <tr key={x.id}><td>{x.employee_name} — {x.employee_number}</td><td>{devices.find(d => d.id === x.device_id)?.name || x.device_id}</td><td dir="ltr">{x.device_user_id}</td><td><button type="button" className="btn btn-danger" onClick={() => removeLink(x.id)}>{ar ? "حذف الربط" : "Remove"}</button></td></tr>)}</tbody></table></div></div>
  </div>;
}
