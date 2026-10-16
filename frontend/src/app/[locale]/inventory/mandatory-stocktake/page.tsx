"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  getMandatoryStocktakeConfig,
  saveMandatoryStocktakeConfig,
  getMandatoryStocktakeRuns,
  getMandatoryStocktakeRun,
  reviewMandatoryStocktakeRun,
} from "@/lib/inventory";

const DAYS = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"];

export default function MandatoryStocktakePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [config, setConfig] = useState<any>({ is_enabled: false, weekday: 4, start_time: "11:00", timezone: "Asia/Riyadh", reminder_minutes: 30 });
  const [runs, setRuns] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [configResponse, runsResponse] = await Promise.all([getMandatoryStocktakeConfig(), getMandatoryStocktakeRuns()]);
      setConfig(configResponse.data || config);
      setRuns(Array.isArray(runsResponse.data) ? runsResponse.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || (ar ? "تعذر تحميل إعدادات الجرد" : "Could not load stocktake settings"));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    try {
      await saveMandatoryStocktakeConfig({ ...config, weekday: Number(config.weekday), reminder_minutes: Number(config.reminder_minutes) });
      setMessage(ar ? "تم حفظ إعدادات الجرد. لن يتم تحديث السيرفر الآن." : "Settings saved. The server has not been updated.");
      await load();
    } catch (err: any) { setError(err?.response?.data?.detail || (ar ? "تعذر حفظ الإعدادات" : "Could not save settings")); }
    finally { setSaving(false); }
  };

  const openRun = async (id: string) => {
    try { const { data } = await getMandatoryStocktakeRun(id); setSelected(data); }
    catch (err: any) { setError(err?.response?.data?.detail || "تعذر فتح الجرد"); }
  };

  const review = async (action: "approved" | "reopened") => {
    if (!selected) return;
    try {
      const { data } = await reviewMandatoryStocktakeRun(selected.id, { action });
      setSelected(data); await load();
      setMessage(action === "approved" ? "تم اعتماد الجرد وفتح التطبيق للمندوب." : "تمت إعادة فتح الجرد للمندوب.");
    } catch (err: any) { setError(err?.response?.data?.detail || "تعذر تنفيذ الإجراء"); }
  };

  return <div>
    <div className="page-header">
      <div>
        <div className="breadcrumb"><Link href={`/${locale}/inventory`}>{ar ? "المخزون" : "Inventory"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "الجرد الإلزامي" : "Mandatory Stocktake"}</span></div>
        <h1 className="page-title">{ar ? "الجرد الأسبوعي الإلزامي" : "Mandatory Weekly Stocktake"}</h1>
        <p className="page-subtitle">{ar ? "إدارة موعد جرد المناديب ومراجعة المطابقة حسب المستودع والسيريال" : "Schedule representative stocktakes and review warehouse and serial matching"}</p>
      </div>
      <Link className="btn btn-ghost" href={`/${locale}/inventory/adjustments`}>{ar ? "الجرد اليدوي" : "Manual count"}</Link>
    </div>

    {(error || message) && <div style={{ background: error ? "#FEF2F2" : "#ECFDF5", color: error ? "#B91C1C" : "#047857", border: `1px solid ${error ? "#FECACA" : "#A7F3D0"}`, borderRadius: 10, padding: "11px 14px", marginBottom: 16 }}>{error || message}</div>}

    <div className="grid-2" style={{ alignItems: "start" }}>
      <form className="card" onSubmit={save}>
        <div className="card-header"><span className="card-title">{ar ? "إعداد موعد الجرد" : "Stocktake schedule"}</span></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}><input type="checkbox" checked={!!config.is_enabled} onChange={e => setConfig({ ...config, is_enabled: e.target.checked })} />{ar ? "تفعيل الجرد الإلزامي للمناديب" : "Enable mandatory representative stocktake"}</label>
          <label className="form-label">{ar ? "يوم الجرد" : "Stocktake day"}<select className="form-input" value={config.weekday} onChange={e => setConfig({ ...config, weekday: Number(e.target.value) })}>{DAYS.map((day, index) => <option key={day} value={index + 1}>{ar ? day : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][index]}</option>)}</select></label>
          <label className="form-label">{ar ? "وقت الجرد" : "Stocktake time"}<input className="form-input" type="time" value={config.start_time || "11:00"} onChange={e => setConfig({ ...config, start_time: e.target.value })} /></label>
          <label className="form-label">{ar ? "التنبيه قبل الموعد بالدقائق" : "Reminder minutes before"}<input className="form-input" type="number" min={0} max={1440} value={config.reminder_minutes ?? 30} onChange={e => setConfig({ ...config, reminder_minutes: e.target.value })} /></label>
          <label className="form-label">{ar ? "المنطقة الزمنية" : "Timezone"}<input className="form-input" value={config.timezone || "Asia/Riyadh"} onChange={e => setConfig({ ...config, timezone: e.target.value })} /></label>
          <div style={{ background: "var(--surface-2)", borderRadius: 9, padding: 11, fontSize: 12, color: "var(--text-muted)" }}>{ar ? "بعد حلول الموعد، يظهر للمندوب فقط نموذج الجرد ولا يستطيع إنشاء فواتير أو مصروفات أو حركات مخزون حتى يرفع الجرد." : "After the scheduled time, the representative sees only the stocktake screen and cannot create invoices, expenses or stock movements until submission."}</div>
          <button className="btn btn-primary" disabled={saving} type="submit">{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ الإعدادات" : "Save settings")}</button>
        </div>
      </form>

      <div className="card">
        <div className="card-header"><span className="card-title">{ar ? "جلسات الجرد" : "Stocktake runs"}</span><button className="btn btn-ghost btn-sm" onClick={load}>{ar ? "تحديث" : "Refresh"}</button></div>
        <div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "الموعد" : "Scheduled"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "المناديب" : "Reps"}</th><th>{ar ? "المطابق" : "Matched"}</th><th></th></tr></thead><tbody>{loading ? <tr><td colSpan={5} style={{ textAlign: "center", padding: 28 }}>{ar ? "جاري التحميل..." : "Loading..."}</td></tr> : runs.length === 0 ? <tr><td colSpan={5} style={{ textAlign: "center", padding: 28, color: "var(--text-muted)" }}>{ar ? "لا توجد جلسات بعد" : "No runs yet"}</td></tr> : runs.map(run => <tr key={run.id}><td style={{ fontSize: 12 }}>{new Date(run.scheduled_at).toLocaleString(ar ? "ar-SA" : "en-US")}</td><td><span className={`badge ${run.status === "approved" ? "badge-success" : run.status === "submitted" ? "badge-warning" : "badge-gray"}`}>{run.status === "approved" ? (ar ? "معتمد" : "Approved") : run.status === "submitted" ? (ar ? "مرفوع" : "Submitted") : (ar ? "بانتظار" : "Pending")}</span></td><td>{run.reps}</td><td>{run.matched_lines}/{run.total_lines}</td><td><button className="btn btn-ghost btn-sm" onClick={() => openRun(run.id)}>{ar ? "التفاصيل" : "Details"}</button></td></tr>)}</tbody></table></div>
      </div>
    </div>

    {selected && <div className="card" style={{ marginTop: 18 }}><div className="card-header"><span className="card-title">{ar ? "تفاصيل الجرد" : "Stocktake details"}</span><div style={{ display: "flex", gap: 8 }}>{selected.status === "submitted" && <button className="btn btn-primary btn-sm" onClick={() => review("approved")}>{ar ? "اعتماد الجرد" : "Approve"}</button>}{selected.status !== "reopened" && <button className="btn btn-ghost btn-sm" onClick={() => review("reopened")}>{ar ? "إعادة فتح" : "Reopen"}</button>}<button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>{ar ? "إغلاق" : "Close"}</button></div></div><div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "الصنف" : "Item"}</th><th>{ar ? "المستودع" : "Warehouse"}</th><th>{ar ? "النظام" : "System"}</th><th>{ar ? "الفعلي" : "Counted"}</th><th>{ar ? "الفرق" : "Difference"}</th><th>{ar ? "الحالة" : "Status"}</th></tr></thead><tbody>{(selected.lines || []).map((line: any) => <tr key={line.id}><td>{line.item_name}<small style={{ display: "block", color: "var(--text-muted)" }}>{line.sku || ""}</small></td><td>{line.warehouse_name}</td><td>{line.system_qty}</td><td>{line.counted_qty ?? "—"}</td><td style={{ color: Number(line.diff_qty || 0) === 0 ? "#047857" : "#B91C1C", fontWeight: 700 }}>{line.diff_qty ?? "—"}</td><td><span className={`badge ${line.status === "matched" ? "badge-success" : "badge-danger"}`}>{line.status === "matched" ? (ar ? "مطابق" : "Matched") : (ar ? "فرق" : "Variance")}</span>{line.tracking_type === "serial" && <small style={{ display: "block", color: "var(--text-muted)" }}>{ar ? `ناقص ${line.missing_serials?.length || 0} — إضافي ${line.extra_serials?.length || 0}` : `Missing ${line.missing_serials?.length || 0} — Extra ${line.extra_serials?.length || 0}`}</small>}</td></tr>)}</tbody></table></div></div>}
  </div>;
}
