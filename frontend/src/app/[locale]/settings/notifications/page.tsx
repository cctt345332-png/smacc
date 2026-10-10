"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getManualNotificationHistory,
  getNotificationRecipients,
  sendManualNotification,
} from "@/lib/notifications";

const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  admin: { ar: "مدير عام", en: "Admin" },
  manager: { ar: "مدير", en: "Manager" },
  accountant: { ar: "محاسب", en: "Accountant" },
  supervisor: { ar: "مشرف", en: "Supervisor" },
  sales_rep: { ar: "مندوب", en: "Sales rep" },
  sales: { ar: "مبيعات", en: "Sales" },
  warehouse: { ar: "مستودع", en: "Warehouse" },
  cashier: { ar: "كاشير", en: "Cashier" },
  hr: { ar: "موارد بشرية", en: "HR" },
};

const IcBell = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcSend = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;

export default function NotificationsAdminPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [recipients, setRecipients] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", body: "", severity: "info", roles: [] as string[], user_ids: [] as string[] });

  const load = async () => {
    setLoading(true);
    try {
      const [recipientResponse, historyResponse] = await Promise.all([
        getNotificationRecipients(),
        getManualNotificationHistory(),
      ]);
      setRecipients(recipientResponse.data || []);
      setHistory(historyResponse.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || (ar ? "تعذر تحميل بيانات الإشعارات" : "Could not load notifications"));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const roles = useMemo(() => Array.from(new Set(recipients.map(item => item.role))).sort(), [recipients]);
  const selectedCount = new Set([
    ...form.user_ids,
    ...recipients.filter(item => form.roles.includes(item.role)).map(item => item.id),
  ]).size;

  const toggle = (key: "roles" | "user_ids", value: string) => {
    setForm(current => ({ ...current, [key]: current[key].includes(value) ? current[key].filter(item => item !== value) : [...current[key], value] }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(""); setError("");
    if (!form.title.trim() || !form.body.trim()) return setError(ar ? "العنوان والرسالة مطلوبان" : "Title and message are required");
    if (selectedCount === 0) return setError(ar ? "حدد مستلماً أو دوراً واحداً على الأقل" : "Select at least one recipient or role");
    setSending(true);
    try {
      const { data } = await sendManualNotification({ title_ar: form.title, title_en: form.title, message_ar: form.body, message_en: form.body, severity: form.severity, roles: form.roles, user_ids: form.user_ids });
      setMessage(ar ? `تم إنشاء الإشعار لـ ${data.created} مستلم` : `Notification created for ${data.created} recipients`);
      setForm({ title: "", body: "", severity: "info", roles: [], user_ids: [] });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || (ar ? "تعذر إرسال الإشعار" : "Could not send notification"));
    } finally { setSending(false); }
  };

  return <div>
    <div className="page-header">
      <div>
        <div className="breadcrumb"><Link href={`/${locale}/settings`}>{ar ? "الإعدادات" : "Settings"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "إدارة الإشعارات" : "Notification Center"}</span></div>
        <h1 className="page-title">{ar ? "إدارة الإشعارات" : "Notification Center"}</h1>
        <p className="page-subtitle">{ar ? "إرسال تعاميم مخصصة ومتابعة سجل الإرسال داخل الشركة" : "Send targeted company announcements and review the send history"}</p>
      </div>
    </div>

    {(error || message) && <div style={{ background: error ? "#FEF2F2" : "#ECFDF5", color: error ? "#B91C1C" : "#047857", border: `1px solid ${error ? "#FECACA" : "#A7F3D0"}`, borderRadius: 10, padding: "11px 14px", marginBottom: 16 }}>{error || message}</div>}

    <div className="grid-2" style={{ alignItems: "start" }}>
      <form className="card" onSubmit={submit}>
        <div className="card-header"><span className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><IcBell />{ar ? "إرسال إشعار مخصص" : "Send custom notification"}</span></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label className="form-label">{ar ? "العنوان" : "Title"}<input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={300} /></label>
          <label className="form-label">{ar ? "الرسالة" : "Message"}<textarea className="form-input" rows={5} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></label>
          <label className="form-label">{ar ? "الأهمية" : "Priority"}<select className="form-input" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}><option value="info">{ar ? "عادي" : "Normal"}</option><option value="warning">{ar ? "مهم" : "Important"}</option><option value="critical">{ar ? "عاجل" : "Urgent"}</option></select></label>
          <div><div className="form-label" style={{ marginBottom: 8 }}>{ar ? `الأدوار (${form.roles.length})` : `Roles (${form.roles.length})`}</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{roles.map(role => <label key={role} style={{ display: "inline-flex", gap: 6, alignItems: "center", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", fontSize: 12 }}><input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggle("roles", role)} />{ar ? ROLE_LABELS[role]?.ar || role : ROLE_LABELS[role]?.en || role}</label>)}</div></div>
          <div><div className="form-label" style={{ marginBottom: 8 }}>{ar ? `مستخدمون محددون (${form.user_ids.length})` : `Specific users (${form.user_ids.length})`}</div><div style={{ maxHeight: 190, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>{recipients.map(item => <label key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 4px", fontSize: 12, borderBottom: "1px solid var(--border-light)" }}><input type="checkbox" checked={form.user_ids.includes(item.id)} onChange={() => toggle("user_ids", item.id)} /><span style={{ flex: 1 }}>{item.full_name}</span><span style={{ color: "var(--text-muted)" }}>{ROLE_LABELS[item.role]?.[ar ? "ar" : "en"] || item.role}</span></label>)}</div></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><span style={{ color: "var(--text-muted)", fontSize: 12 }}>{ar ? `سيصل حالياً إلى ${selectedCount} مستخدم` : `Will target ${selectedCount} users`}</span><button className="btn btn-primary" type="submit" disabled={sending || loading}><IcSend />{sending ? (ar ? "جاري الإرسال..." : "Sending...") : (ar ? "إرسال الآن" : "Send now")}</button></div>
        </div>
      </form>

      <div className="card"><div className="card-header"><span className="card-title">{ar ? "سجل الإشعارات اليدوية" : "Manual notification history"}</span></div><div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "الإشعار" : "Notification"}</th><th>{ar ? "المستلم" : "Recipient"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "التاريخ" : "Date"}</th></tr></thead><tbody>{loading ? <tr><td colSpan={4} style={{ textAlign: "center", padding: 28 }}>{ar ? "جاري التحميل..." : "Loading..."}</td></tr> : history.length === 0 ? <tr><td colSpan={4} style={{ textAlign: "center", padding: 28, color: "var(--text-muted)" }}>{ar ? "لا يوجد إرسال يدوي بعد" : "No manual notifications yet"}</td></tr> : history.map(item => <tr key={item.id}><td><div style={{ fontWeight: 600, fontSize: 12 }}>{ar ? item.title_ar : item.title_en}</div><div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{ar ? item.message_ar : item.message_en}</div></td><td style={{ fontSize: 12 }}>{item.recipient_name || (ar ? "مستخدم محذوف" : "Deleted user")}</td><td><span className={item.is_read ? "badge badge-success" : "badge badge-gray"}>{item.is_read ? (ar ? "مقروء" : "Read") : (ar ? "غير مقروء" : "Unread")}</span></td><td style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(item.created_at).toLocaleString(ar ? "ar-SA" : "en-US")}</td></tr>)}</tbody></table></div></div>
    </div>
  </div>;
}
