"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  getMandatoryStocktakeConfig,
  saveMandatoryStocktakeConfig,
  getMandatoryStocktakeRuns,
  getMandatoryStocktakeRun,
  reviewMandatoryStocktakeRun,
  createMandatoryStocktakeTest,
  cancelMandatoryStocktakeTest,
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
  const [repFilter, setRepFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
      setMessage(ar ? "تم حفظ إعدادات الجرد على السيرفر. سيبدأ الجرد القادم في الموعد المحدد." : "Stocktake settings saved on the server. The next run will start at the selected time.");
      await load();
    } catch (err: any) { setError(err?.response?.data?.detail || (ar ? "تعذر حفظ الإعدادات" : "Could not save settings")); }
    finally { setSaving(false); }
  };

  const openRun = async (id: string) => {
    try { const { data } = await getMandatoryStocktakeRun(id); setSelected(data); }
    catch (err: any) { setError(err?.response?.data?.detail || "تعذر فتح الجرد"); }
  };

  const review = async (action: "approved" | "reopened" | "reopen_rep", repId?: string) => {
    if (!selected || (action === "reopen_rep" && !repId)) return;
    try {
      const { data } = await reviewMandatoryStocktakeRun(selected.id, { action, ...(repId ? { rep_id: repId } : {}) });
      setSelected(data); await load();
      setMessage(action === "approved" ? "تم اعتماد الجرد وفتح التطبيق للمندوب." : action === "reopen_rep" ? "تمت إعادة فتح الجرد لهذا المندوب فقط." : "تمت إعادة فتح الجرد للمندوبين.");
    } catch (err: any) { setError(err?.response?.data?.detail || "تعذر تنفيذ الإجراء"); }
  };

  const runImmediateTest = async () => {
    if (!window.confirm(ar ? "سيتم فتح جرد تجريبي فوري للمندوبين، ولن يغيّر المخزون عند اعتماده. هل تريد المتابعة؟" : "Start an immediate test stocktake? It will not change inventory when approved.")) return;
    try {
      const { data } = await createMandatoryStocktakeTest();
      setSelected(data); await load();
      setMessage(ar ? "تم تشغيل الاختبار الفوري. افتح تطبيق المندوب الآن." : "Immediate test started. Open the rep app now.");
    } catch (err: any) { setError(err?.response?.data?.detail || "تعذر تشغيل الاختبار"); }
  };

  const cancelTest = async () => {
    if (!selected?.is_test) return;
    if (!window.confirm(ar ? "سيتم إيقاف الاختبار وحذف جلسة الاختبار فقط، ولن يتأثر المخزون الحقيقي. هل تريد المتابعة؟" : "Stop and remove this test run? Real inventory will not be affected.")) return;
    try { await cancelMandatoryStocktakeTest(selected.id); setSelected(null); await load(); setMessage(ar ? "تم إيقاف الاختبار وفتح التطبيق للمندوب." : "Test run stopped and the rep app is unlocked."); }
    catch (err: any) { setError(err?.response?.data?.detail || "تعذر إلغاء الاختبار"); }
  };

  const detailLines = selected?.lines || [];
  const reps = Array.from(new Map(detailLines.map((line: any) => [line.rep_id, line.rep_name])).entries());
  const warehouses = Array.from(new Map(detailLines.map((line: any) => [line.warehouse_id, line.warehouse_name])).entries());
  const filteredLines = detailLines.filter((line: any) =>
    (!repFilter || line.rep_id === repFilter) &&
    (!warehouseFilter || line.warehouse_id === warehouseFilter) &&
    (statusFilter === "all" || line.status === statusFilter)
  );
  const exportDetails = () => {
    if (!selected) return;
    const rows = filteredLines.map((line: any) => ({
      المندوب: line.rep_name, المستودع: line.warehouse_name, الصنف: line.item_name,
      SKU: line.sku || "", نوع_التتبع: line.tracking_type, كمية_النظام: line.system_qty,
      الكمية_الفعلية: line.counted_qty ?? "", الفرق: line.diff_qty ?? "",
      الحالة: line.status === "matched" ? "مطابق" : "فرق",
      السيريالات_المصورة: (line.counted_serials || []).join(", "),
      السيريالات_المطابقة_للمخزون: (line.matched_serials || []).join(", "),
      السيريالات_غير_المطابقة_للمخزون: (line.unmatched_serials || []).join(", "),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [18, 22, 32, 16, 14, 14, 16, 34, 34, 34].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نتيجة الجرد");
    XLSX.writeFile(wb, `جرد-إلزامي-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const printDetails = () => {
    if (!selected) return;
    const popup = window.open("", "_blank", "width=1200,height=800");
    if (!popup) return;
    const rows = filteredLines.map((line: any) => `<tr><td>${line.rep_name}</td><td>${line.warehouse_name}</td><td>${line.item_name}</td><td>${line.system_qty}</td><td>${line.counted_qty ?? "—"}</td><td>${line.diff_qty ?? "—"}</td><td>${line.status === "matched" ? "مطابق" : "فرق"}</td><td>${(line.counted_serials || []).join(", ") || "—"}</td><td>${(line.matched_serials || []).join(", ") || "—"}</td><td>${(line.unmatched_serials || []).join(", ") || "—"}</td></tr>`).join("");
    popup.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>ورقة جرد</title><style>body{font-family:Arial;padding:25px}h1{color:#3e0865}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:8px;text-align:right}th{background:#eee}</style></head><body><h1>ورقة الجرد الإلزامي</h1><p>الموعد: ${new Date(selected.scheduled_at).toLocaleString("ar-SA")}</p><table><thead><tr><th>المندوب</th><th>المستودع</th><th>الصنف</th><th>النظام</th><th>الفعلي</th><th>الفرق</th><th>الحالة</th><th>السيريالات المصورة</th><th>مطابق للمخزون</th><th>غير مطابق للمخزون</th></tr></thead><tbody>${rows}</tbody></table><script>window.print();</script></body></html>`);
    popup.document.close();
  };

  return <div>
    <div className="page-header">
      <div>
        <div className="breadcrumb"><Link href={`/${locale}/inventory`}>{ar ? "المخزون" : "Inventory"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "الجرد الإلزامي" : "Mandatory Stocktake"}</span></div>
        <h1 className="page-title">{ar ? "الجرد الأسبوعي الإلزامي" : "Mandatory Weekly Stocktake"}</h1>
        <p className="page-subtitle">{ar ? "إدارة موعد جرد المناديب ومراجعة المطابقة حسب المستودع والسيريال" : "Schedule representative stocktakes and review warehouse and serial matching"}</p>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn btn-ghost" onClick={runImmediateTest}>{ar ? "تشغيل اختبار فوري" : "Run immediate test"}</button><Link className="btn btn-ghost" href={`/${locale}/inventory/adjustments`}>{ar ? "الجرد اليدوي" : "Manual count"}</Link></div>
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

    {selected && (selected.odometers || []).length > 0 && <div className="card" style={{ marginTop: 18 }}><div className="card-header"><span className="card-title">{ar ? "صور عدادات المركبات" : "Vehicle odometer photos"}</span></div><div className="card-body" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{selected.odometers.map((o: any) => <div key={o.rep_id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 10, minWidth: 220 }}><div style={{ fontWeight: 700 }}>{detailLines.find((line: any) => line.rep_id === o.rep_id)?.rep_name || "—"}</div><div>{o.odometer} كم</div>{o.photo_data && <img src={o.photo_data} alt="صورة عداد المركبة" style={{ display: "block", marginTop: 8, width: 190, maxHeight: 130, objectFit: "cover", borderRadius: 6 }} />}</div>)}</div></div>}

    {selected && <div className="card" style={{ marginTop: 18 }}><div className="card-header"><span className="card-title">{ar ? "تفاصيل الجرد" : "Stocktake details"}</span><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{selected.status === "submitted" && !selected.is_test && <button className="btn btn-primary btn-sm" onClick={() => review("approved")}>{ar ? "اعتماد الجرد" : "Approve"}</button>}{selected.status !== "approved" && !selected.is_test && <button className="btn btn-ghost btn-sm" onClick={() => review("reopened")}>{ar ? "إعادة فتح للجميع" : "Reopen all"}</button>}{selected.is_test && <button className="btn btn-danger btn-sm" onClick={cancelTest}>{ar ? "إيقاف الاختبار وحذف الجلسة" : "Stop test and remove run"}</button>}<button className="btn btn-ghost btn-sm" onClick={exportDetails}>{ar ? "تصدير Excel" : "Export Excel"}</button><button className="btn btn-ghost btn-sm" onClick={printDetails}>{ar ? "طباعة" : "Print"}</button><button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>{ar ? "إغلاق" : "Close"}</button></div></div><div className="card-body" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><select className="form-input" style={{ maxWidth: 230 }} value={repFilter} onChange={e => setRepFilter(e.target.value)}><option value="">{ar ? "كل المناديب" : "All reps"}</option>{reps.map(([id, name]) => <option key={String(id)} value={String(id)}>{String(name)}</option>)}</select><select className="form-input" style={{ maxWidth: 230 }} value={warehouseFilter} onChange={e => setWarehouseFilter(e.target.value)}><option value="">{ar ? "كل المستودعات" : "All warehouses"}</option>{warehouses.map(([id, name]) => <option key={String(id)} value={String(id)}>{String(name)}</option>)}</select><select className="form-input" style={{ maxWidth: 180 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">{ar ? "كل الحالات" : "All statuses"}</option><option value="matched">{ar ? "مطابق" : "Matched"}</option><option value="variance">{ar ? "فيه فرق" : "Variance"}</option></select><div style={{ display: "flex", gap: 6, flexWrap: "wrap", width: "100%" }}>{reps.map(([id, name]) => <button key={`reopen-${String(id)}`} className="btn btn-ghost btn-sm" disabled={selected.status === "approved" || selected.is_test} onClick={() => review("reopen_rep", String(id))}>{ar ? `إعادة فتح: ${String(name)}` : `Reopen: ${String(name)}`}</button>)}</div></div><div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "المندوب" : "Rep"}</th><th>{ar ? "الصنف" : "Item"}</th><th>{ar ? "المستودع" : "Warehouse"}</th><th>{ar ? "النظام" : "System"}</th><th>{ar ? "الفعلي" : "Counted"}</th><th>{ar ? "الفرق" : "Difference"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "السيريالات المصورة" : "Scanned serials"}</th><th>{ar ? "مطابق للمخزون" : "Matches stock"}</th><th>{ar ? "غير مطابق للمخزون" : "Does not match stock"}</th></tr></thead><tbody>{filteredLines.map((line: any) => <tr key={line.id}><td>{line.rep_name}</td><td>{line.item_name}<small style={{ display: "block", color: "var(--text-muted)" }}>{line.sku || ""}</small></td><td>{line.warehouse_name}</td><td>{line.system_qty}</td><td>{line.counted_qty ?? "—"}</td><td style={{ color: Number(line.diff_qty || 0) === 0 ? "#047857" : "#B91C1C", fontWeight: 700 }}>{line.diff_qty ?? "—"}</td><td><span className={`badge ${line.status === "matched" ? "badge-success" : "badge-danger"}`}>{line.status === "matched" ? (ar ? "مطابق" : "Matched") : (ar ? "فرق" : "Variance")}</span>{line.tracking_type === "serial" && <small style={{ display: "block", color: "var(--text-muted)" }}>{ar ? `ناقص ${line.missing_serials?.length || 0} — إضافي ${line.extra_serials?.length || 0}` : `Missing ${line.missing_serials?.length || 0} — Extra ${line.extra_serials?.length || 0}`}</small>}</td><td>{line.tracking_type === "serial" ? <div style={{ maxWidth: 420, whiteSpace: "normal", wordBreak: "break-word", fontSize: 12 }}>{(line.counted_serials || []).length ? line.counted_serials.join("، ") : "—"}</div> : "—"}</td><td>{line.tracking_type === "serial" ? <div style={{ maxWidth: 360, whiteSpace: "normal", wordBreak: "break-word", fontSize: 12, color: (line.matched_serials || []).length ? "#047857" : "#6B7280" }}>{(line.matched_serials || []).length ? line.matched_serials.join("، ") : "لا يوجد"}</div> : "—"}</td><td>{line.tracking_type === "serial" ? <div style={{ maxWidth: 360, whiteSpace: "normal", wordBreak: "break-word", fontSize: 12, color: (line.unmatched_serials || []).length ? "#B91C1C" : "#6B7280" }}>{(line.unmatched_serials || []).length ? line.unmatched_serials.join("، ") : "لا يوجد"}</div> : "—"}</td></tr>)}</tbody></table></div></div>}
  </div>;
}
