"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { addMaintenancePart, addMaintenanceService, createMaintenanceTicket, deleteMaintenanceTicket, getMaintenanceManagementReport, getMaintenanceSerials, getTerminals, issueMaintenanceInvoice, updateMaintenanceTicket } from "@/lib/pos";
import { getCustomers, createCustomer } from "@/lib/sales";
import { getItemsForPicker } from "@/lib/inventory";
import { getReps } from "@/lib/reps";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";
import { Icon } from "@/components/ui/Icons";

const money = (value: any) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

export default function MaintenanceManagementPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "report" ? "report" : "tickets";
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [status, setStatus] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [terminals, setTerminals] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [newCustomer, setNewCustomer] = useState(false);
  const [data, setData] = useState<any>({ summary: {}, by_terminal: [], tickets: [] });
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const [inspectionTicket, setInspectionTicket] = useState<any>(null);
  const [inspectionForm, setInspectionForm] = useState({ diagnosis: "", service_name: "", service_amount: "", product_id: "", quantity: "1", serial_item_id: "" });
  const [inspectionSerials, setInspectionSerials] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ terminal_id: "", customer_id: "", rep_id: "", customer_name: "", customer_phone: "", product_id: "", device_serial: "", reported_problem: "", service_name: "", service_amount: "", notes: "" });

  const load = async () => {
    setLoading(true);
    try {
      const result = await getMaintenanceManagementReport({
        from_date: fromDate ? `${fromDate}T00:00:00` : undefined,
        to_date: toDate ? `${toDate}T23:59:59` : undefined,
        status: status || undefined,
        terminal_id: terminalId || undefined,
      });
      setData(result.data || { summary: {}, by_terminal: [], tickets: [] });
    } catch {
      setData({ summary: {}, by_terminal: [], tickets: [] });
    } finally {
      setLoading(false);
    }
  };

  const addDevice = async () => {
    const product = catalog.find((item) => item.id === form.product_id);
    if (!form.terminal_id || !product || !form.reported_problem.trim()) {
      alert(ar ? "اختر جهاز الكاشير والصنف من الكتالوج واكتب وصف العطل" : "Select a terminal, catalog product, and enter the problem");
      return;
    }
    setSaving(true);
    try {
      let customerId = form.customer_id || "";
      let customerName = form.customer_name.trim();
      let customerPhone = form.customer_phone.trim();
      if (newCustomer) {
        if (!customerName) throw new Error(ar ? "اكتب اسم العميل الجديد" : "Enter the new customer name");
        const created = await createCustomer({ customer_type: "individual", name_ar: customerName, phone: customerPhone || undefined });
        customerId = created.data.id;
        setCustomers((old) => [created.data, ...old]);
      } else if (!customerId) {
        throw new Error(ar ? "اختر عميلًا أو فعّل تسجيل عميل جديد" : "Select a customer or enable new customer");
      } else {
        const customer = customers.find((row) => row.id === customerId);
        customerName = customer?.name_ar || customerName;
        customerPhone = customer?.phone || customerPhone;
      }
      if (editingTicket) {
        await updateMaintenanceTicket(editingTicket.id, { terminal_id: form.terminal_id, customer_id: customerId || null, customer_name: customerName, customer_phone: customerPhone, rep_id: form.rep_id || null, device_name: product.name_ar, device_serial: form.device_serial || null, reported_problem: form.reported_problem, notes: form.notes });
        alert(ar ? "تم تعديل طلب الصيانة" : "Maintenance request updated");
        setEditingTicket(null); setShowAdd(false); await load(); return;
      }
      const createdTicket = await createMaintenanceTicket({ terminal_id: form.terminal_id, customer_id: customerId, rep_id: form.rep_id || null, customer_name: customerName, customer_phone: customerPhone, device_name: product.name_ar, device_serial: form.device_serial || null, reported_problem: form.reported_problem, notes: form.notes, estimated_cost: 0, approved_cost: 0, paid_amount: 0 });
      alert(ar ? "تمت إضافة الجهاز للصيانة" : "Device added to maintenance");
      setForm({ terminal_id: "", customer_id: "", rep_id: "", customer_name: "", customer_phone: "", product_id: "", device_serial: "", reported_problem: "", service_name: "", service_amount: "", notes: "" });
      setNewCustomer(false);
      setShowAdd(false);
      await load();
    } catch (error: any) {
      alert(error?.response?.data?.detail || (ar ? "تعذر إضافة الجهاز" : "Could not add device"));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (ticket: any, nextStatus: string) => {
    try {
      await updateMaintenanceTicket(ticket.id, { status: nextStatus });
      await load();
    } catch (error: any) {
      alert(error?.response?.data?.detail || (ar ? "تعذر تغيير حالة التذكرة" : "Could not change ticket status"));
    }
  };

  const editTicket = (ticket: any) => {
    const product = catalog.find((item) => item.name_ar === ticket.device_name);
    setEditingTicket(ticket); setNewCustomer(false);
    setForm({ terminal_id: ticket.terminal_id || "", customer_id: ticket.customer_id || "", rep_id: ticket.rep_id || "", customer_name: ticket.customer_name || "", customer_phone: ticket.customer_phone || "", product_id: product?.id || "", device_serial: ticket.device_serial || "", reported_problem: ticket.reported_problem || "", service_name: "", service_amount: "", notes: ticket.notes || "" });
    setShowAdd(true);
  };

  const removeTicket = async (ticket: any) => {
    if (!confirm(ar ? `حذف طلب الصيانة ${ticket.ticket_number}؟ لا يمكن التراجع عن الحذف.` : `Delete maintenance request ${ticket.ticket_number}? This cannot be undone.`)) return;
    try { await deleteMaintenanceTicket(ticket.id); await load(); } catch (error: any) { alert(error?.response?.data?.detail || (ar ? "لا يمكن حذف الطلب" : "Could not delete request")); }
  };

  const openInspection = (ticket: any) => {
    setInspectionTicket(ticket); setInspectionSerials([]);
    setInspectionForm({ diagnosis: ticket.diagnosis || "", service_name: ticket.services?.[0]?.service_name || "", service_amount: ticket.services?.[0]?.amount ? String(ticket.services[0].amount) : "", product_id: "", quantity: "1", serial_item_id: "" });
  };

  const chooseInspectionProduct = async (productId: string) => {
    setInspectionForm({ ...inspectionForm, product_id: productId, serial_item_id: "" });
    const product = catalog.find((item) => item.id === productId);
    if (product?.tracking_type === "serial") {
      try { const result = await getMaintenanceSerials(inspectionTicket.id, productId); setInspectionSerials(result.data || []); } catch { setInspectionSerials([]); }
    } else setInspectionSerials([]);
  };

  const saveInspectionFromAdmin = async () => {
    if (!inspectionTicket || !inspectionForm.diagnosis.trim()) return alert(ar ? "اكتب تقرير الفحص أولاً" : "Enter the inspection report first");
    try {
      await updateMaintenanceTicket(inspectionTicket.id, { diagnosis: inspectionForm.diagnosis, status: "ready" });
      if (inspectionForm.service_name.trim() && Number(inspectionForm.service_amount) > 0) await addMaintenanceService(inspectionTicket.id, { service_name: inspectionForm.service_name.trim(), amount: Number(inspectionForm.service_amount) });
      if (inspectionForm.product_id) await addMaintenancePart(inspectionTicket.id, { product_id: inspectionForm.product_id, quantity: Number(inspectionForm.quantity || 1), serial_item_id: inspectionForm.serial_item_id || undefined });
      setInspectionTicket(null); await load(); alert(ar ? "تم حفظ تقرير الفحص والقطع والتكلفة" : "Inspection, parts, and cost saved");
    } catch (error: any) { alert(error?.response?.data?.detail || (ar ? "تعذر حفظ بيانات الفحص" : "Could not save inspection data")); }
  };

  const issueInvoice = async (ticket: any) => {
    if (!confirm(ar ? "إصدار فاتورة لهذه التذكرة وإشعار المندوب إن وجد؟" : "Issue an invoice for this ticket and notify its representative if assigned?")) return;
    try {
      const result = await issueMaintenanceInvoice(ticket.id);
      alert(ar ? `تم إصدار الفاتورة ${result.data?.invoice_number || ""}` : `Invoice ${result.data?.invoice_number || ""} issued`);
      await load();
    } catch (error: any) {
      alert(error?.response?.data?.detail || (ar ? "تعذر إصدار الفاتورة" : "Could not issue invoice"));
    }
  };

  useEffect(() => {
    getTerminals().then((result) => setTerminals(result.data || [])).catch(() => setTerminals([]));
    getCustomers().then((result) => setCustomers(result.data || [])).catch(() => setCustomers([]));
    getItemsForPicker({}).then((result) => setCatalog(result.data || [])).catch(() => setCatalog([]));
    getReps().then((result) => setReps(result.data || [])).catch(() => setReps([]));
    load();
  }, []);

  const summary = data.summary || {};
  const tickets = data.tickets || [];
  const byTerminal = data.by_terminal || [];
  const statusLabel = (value: string) => ({ open: ar ? "استقبال" : "Received", in_progress: ar ? "الفحص" : "Inspection", ready: ar ? "بانتظار اعتماد الإصلاح" : "Awaiting repair approval", completed: ar ? "مكتملة" : "Completed", cancelled: ar ? "ملغاة" : "Cancelled" } as Record<string, string>)[value] || value || "—";
  const printRows = tickets.map((row: any) => [row.ticket_number, row.branch_name || row.terminal_name || "—", row.rep_name || "—", row.device_name, row.customer_name || "—", statusLabel(row.status), `${money(row.parts_total)} SAR`, `${money(row.fees_total)} SAR`, `${money(row.paid_amount)} SAR`, `${money(row.outstanding)} SAR`]);

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><Link href={`/${locale}/pos`}>{ar ? "نقطة البيع" : "POS"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "إدارة الصيانة" : "Maintenance Management"}</span></div>
          <h1 className="page-title">{ar ? "إدارة صيانة نقاط البيع" : "POS Maintenance Management"}</h1>
          <p className="page-subtitle">{ar ? "متابعة الأجهزة، القطع المصروفة، التحصيل، والعهدة حسب الفترة والجهاز" : "Track devices, issued parts, collections, and custody by period and terminal"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <StructuredReportPrintButton locale={locale} title={ar ? "تقرير إدارة صيانة نقاط البيع" : "POS Maintenance Management Report"} subtitle={ar ? "العهدة والتحصيل والقطع المصروفة" : "Custody, collections, and issued parts"} period={`${fromDate} — ${toDate}`} orientation="landscape" reportCode={`MNT-${today.replaceAll("-", "")}`} metrics={[{ label: ar ? "التذاكر" : "Tickets", value: String(summary.ticket_count || 0), tone: "blue" }, { label: ar ? "التحصيل" : "Collected", value: `${money(summary.paid_total)} SAR`, tone: "green" }, { label: ar ? "المتبقي" : "Outstanding", value: `${money(summary.outstanding_total)} SAR`, tone: "amber" }, { label: ar ? "قيمة القطع" : "Parts value", value: `${money(summary.parts_total)} SAR`, tone: "blue" }]} tables={[{ title: ar ? "تفاصيل الصيانة" : "Maintenance details", headers: [ar ? "التذكرة" : "Ticket", ar ? "الفرع" : "Branch", ar ? "المندوب" : "Representative", ar ? "الجهاز" : "Device", ar ? "العميل" : "Customer", ar ? "الحالة" : "Status", ar ? "القطع" : "Parts", ar ? "الأجرة" : "Fees", ar ? "المحصّل" : "Collected", ar ? "المتبقي" : "Outstanding"], rows: printRows }]} />
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={15} />{ar ? "إضافة جهاز صيانة" : "Add maintenance device"}</button>
          <Link href={`/${locale}/pos/maintenance`} className="btn btn-secondary"><Icon name="settings" size={15} />{ar ? "تشغيل الصيانة" : "Maintenance Counter"}</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 8, marginBottom: 18, display: "flex", gap: 8, flexWrap: "wrap" }}><Link href={`/${locale}/pos/maintenance-management?view=tickets`} className={`btn ${view === "tickets" ? "btn-primary" : "btn-secondary"}`}><Icon name="receipt" size={15} />{ar ? "طلبات وتذاكر الصيانة" : "Requests & Tickets"}</Link><Link href={`/${locale}/pos/maintenance-management?view=report`} className={`btn ${view === "report" ? "btn-primary" : "btn-secondary"}`}><Icon name="chart" size={15} />{ar ? "التقرير والعهدة" : "Report & Custody"}</Link><Link href={`/${locale}/maintenance/warehouses`} className="btn btn-secondary"><Icon name="inventory" size={15} />{ar ? "مستودعات الصيانة" : "Maintenance Warehouses"}</Link></div>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <label className="form-group" style={{ margin: 0 }}><span className="form-label">{ar ? "من تاريخ" : "From"}</span><input className="form-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
          <label className="form-group" style={{ margin: 0 }}><span className="form-label">{ar ? "إلى تاريخ" : "To"}</span><input className="form-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></label>
          <label className="form-group" style={{ margin: 0, minWidth: 180 }}><span className="form-label">{ar ? "جهاز الكاشير" : "Terminal"}</span><select className="form-input form-select" value={terminalId} onChange={(e) => setTerminalId(e.target.value)}><option value="">{ar ? "كل الأجهزة" : "All terminals"}</option>{terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}</select></label>
          <label className="form-group" style={{ margin: 0, minWidth: 160 }}><span className="form-label">{ar ? "الحالة" : "Status"}</span><select className="form-input form-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{ar ? "كل الحالات" : "All statuses"}</option><option value="open">{statusLabel("open")}</option><option value="in_progress">{statusLabel("in_progress")}</option><option value="ready">{statusLabel("ready")}</option><option value="completed">{statusLabel("completed")}</option><option value="cancelled">{statusLabel("cancelled")}</option></select></label>
          <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? (ar ? "جاري التحميل..." : "Loading...") : (ar ? "عرض التقرير" : "Show report")}</button>
        </div>
      </div>

      {showAdd && <div className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div className="card" style={{ width: "min(680px, 100%)", padding: 22 }}>
          <div className="card-header" style={{ padding: 0, marginBottom: 16 }}><h3 className="card-title"><Icon name="settings" size={17} />{editingTicket ? (ar ? "تعديل طلب الصيانة" : "Edit maintenance request") : (ar ? "إضافة جهاز للصيانة" : "Add maintenance device")}</h3><button className="btn btn-ghost btn-sm" onClick={() => { setShowAdd(false); setEditingTicket(null); }}>×</button></div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "0 0 14px" }}>{ar ? "سيتم تسجيل الجهاز كتذكرة صيانة بدون تحصيل نقدي. التحصيل وصرف القطع يتمان من شاشة تشغيل الصيانة المرتبطة بجلسة الكاشير." : "The device is registered without collection. Collection and parts issue are completed from the maintenance counter linked to a cashier session."}</p>
          <div className="grid-2">
            <label className="form-group"><span className="form-label">{ar ? "جهاز الكاشير *" : "Terminal *"}</span><select className="form-input form-select" value={form.terminal_id} onChange={(e) => setForm({ ...form, terminal_id: e.target.value })}><option value="">{ar ? "اختر الجهاز" : "Select terminal"}</option>{terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}</select></label>
            <label className="form-group"><span className="form-label">{ar ? "الصنف / موديل الجهاز من الكتالوج *" : "Device model from catalog *"}</span><select className="form-input form-select" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}><option value="">{ar ? "اختر الصنف" : "Select product"}</option>{catalog.map((item) => <option key={item.id} value={item.id}>{item.name_ar}{item.sku ? ` — ${item.sku}` : ""}</option>)}</select></label>
          </div>
          <div className="grid-2" style={{ marginTop: 10 }}>
            <label className="form-group"><span className="form-label">{ar ? "العميل *" : "Customer *"}</span>{newCustomer ? <input className="form-input" placeholder={ar ? "اسم العميل الجديد" : "New customer name"} value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value, customer_id: "" })} /> : <select className="form-input form-select" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}><option value="">{ar ? "اختر العميل" : "Select customer"}</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name_ar} — {customer.customer_number}</option>)}</select>}<button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 5 }} onClick={() => { setNewCustomer(!newCustomer); setForm({ ...form, customer_id: "", customer_name: "", customer_phone: "" }); }}>{newCustomer ? (ar ? "اختيار عميل موجود" : "Choose existing customer") : (ar ? "العميل غير موجود؟ تسجيل جديد" : "Customer not found? Register new")}</button></label>
            <label className="form-group"><span className="form-label">{ar ? "الجوال" : "Phone"}</span><input className="form-input" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></label>
          </div>
          <label className="form-group" style={{ marginTop: 10 }}><span className="form-label">{ar ? "المندوب" : "Representative"}</span><select className="form-input form-select" value={form.rep_id} onChange={(e) => setForm({ ...form, rep_id: e.target.value })}><option value="">{ar ? "بدون مندوب — اختياري" : "No representative — optional"}</option>{reps.map((rep) => <option key={rep.id} value={rep.id}>{rep.full_name || rep.rep_code || rep.id}</option>)}</select><span className="form-hint">{ar ? "اختره إذا كان جهاز العميل واردًا عن طريق مندوب" : "Select when the device came through a representative"}</span></label>
          <div className="grid-2" style={{ marginTop: 10 }}><label className="form-group"><span className="form-label">{ar ? "سيريال جهاز العميل" : "Customer device serial"}</span><input className="form-input" value={form.device_serial} onChange={(e) => setForm({ ...form, device_serial: e.target.value })} placeholder={ar ? "يُكتب يدويًا حتى لو غير موجود بالمخزون" : "Enter manually; it may not exist in inventory"} /><span className="form-hint">{ar ? "هذا سيريال جهاز العميل، وليس سيريال قطعة من مستودع الصيانة" : "Customer device serial, not a stock part serial"}</span></label><label className="form-group"><span className="form-label">{ar ? "وصف المشكلة *" : "Problem *"}</span><textarea className="form-input" rows={2} value={form.reported_problem} onChange={(e) => setForm({ ...form, reported_problem: e.target.value })} placeholder={ar ? "اكتب العطل بالتفصيل" : "Describe the problem"} /></label></div>
          <div className="card" style={{ marginTop: 10, padding: 12, background: "var(--surface-secondary, #f8fafc)" }}><strong style={{ fontSize: 13 }}>{ar ? "المرحلة الأولى: استقبال وفحص أولي" : "Stage 1: intake and initial inspection"}</strong><p className="form-hint" style={{ margin: "5px 0 0" }}>{ar ? "لن يتم تسجيل أي مبلغ الآن. بعد الفحص ستضاف نتيجة التشخيص والقطع المطلوبة والأجرة من تفاصيل التذكرة." : "No amount is recorded now. After inspection, diagnosis, required parts, and service fees are added from the ticket details."}</p></div>
          <label className="form-group" style={{ marginTop: 10 }}><span className="form-label">{ar ? "ملاحظات" : "Notes"}</span><textarea className="form-input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}><button className="btn btn-secondary" onClick={() => { setShowAdd(false); setEditingTicket(null); }}>{ar ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" onClick={addDevice} disabled={saving}>{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (editingTicket ? (ar ? "حفظ التعديل" : "Save changes") : (ar ? "حفظ الجهاز" : "Save device"))}</button></div>
        </div>
      </div>}

      {view === "report" && <div className="grid-4" style={{ marginBottom: 20 }}>
        {[{ label: ar ? "عدد التذاكر" : "Tickets", value: summary.ticket_count || 0, color: "#2563EB" }, { label: ar ? "إجمالي المعتمد" : "Approved total", value: `${money(summary.approved_total)} SAR`, color: "#7C3AED" }, { label: ar ? "المحصّل" : "Collected", value: `${money(summary.paid_total)} SAR`, color: "#059669" }, { label: ar ? "العهدة المتبقية" : "Outstanding custody", value: `${money(summary.outstanding_total)} SAR`, color: "#D97706" }].map((item) => <div className="stat-card" key={item.label}><div className="stat-value" style={{ color: item.color }}>{item.value}</div><div className="stat-label">{item.label}</div></div>)}
      </div>}

      {view === "report" && <div className="grid-2" style={{ alignItems: "start", marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><h3 className="card-title"><Icon name="pos" size={16} />{ar ? "عهدة الأجهزة" : "Terminal custody"}</h3><span className="badge badge-info">{byTerminal.length}</span></div>
          <div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "الجهاز" : "Terminal"}</th><th>{ar ? "التذاكر" : "Tickets"}</th><th>{ar ? "القطع" : "Parts"}</th><th>{ar ? "المحصّل" : "Collected"}</th><th>{ar ? "المتبقي" : "Outstanding"}</th></tr></thead><tbody>{byTerminal.map((row: any) => <tr key={row.terminal_id}><td style={{ fontWeight: 700 }}>{row.terminal_name}</td><td>{row.ticket_count}</td><td>{money(row.parts_total)} SAR</td><td style={{ color: "#059669", fontWeight: 700 }}>{money(row.paid_total)} SAR</td><td style={{ color: Number(row.outstanding || 0) > 0 ? "#D97706" : "var(--text-muted)" }}>{money(row.outstanding)} SAR</td></tr>)}</tbody></table></div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title"><Icon name="settings" size={16} />{ar ? "رقابة القطع والتحصيل" : "Parts and collection control"}</h3></div>
          <div style={{ padding: 18, display: "grid", gap: 12 }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>{ar ? "قيمة القطع المصروفة" : "Issued parts value"}</span><b>{money(summary.parts_total)} SAR</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>{ar ? "أجور الصيانة" : "Maintenance fees"}</span><b>{money(summary.fees_total)} SAR</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>{ar ? "عدد القطع المصروفة" : "Issued parts count"}</span><b>{summary.issued_parts || 0}</b></div><div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>{ar ? "إجمالي المطلوب" : "Total approved"}</span><b style={{ color: "var(--primary)" }}>{money(summary.approved_total)} SAR</b></div></div>
        </div>
      </div>}

      {view === "tickets" && <div className="card"><div className="card-header"><h3 className="card-title"><Icon name="receipt" size={16} />{ar ? "تفاصيل تذاكر الصيانة" : "Maintenance tickets"}</h3><span className="badge badge-gray">{tickets.length}</span></div>{tickets.length === 0 ? <div className="empty-state">{loading ? (ar ? "جاري تحميل التذاكر..." : "Loading tickets...") : (ar ? "لا توجد تذاكر ضمن الفلاتر" : "No tickets for selected filters")}</div> : <div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "التذكرة" : "Ticket"}</th><th>{ar ? "الجهاز" : "Device"}</th><th>{ar ? "العميل" : "Customer"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "القطع" : "Parts"}</th><th>{ar ? "الأجرة" : "Fees"}</th><th>{ar ? "المحصّل" : "Collected"}</th><th>{ar ? "المتبقي" : "Outstanding"}</th><th>{ar ? "فاتورة" : "Invoice"}</th><th>{ar ? "إجراءات" : "Actions"}</th><th>{ar ? "التاريخ" : "Date"}</th></tr></thead><tbody>{tickets.map((row: any) => <tr key={row.id}><td style={{ fontWeight: 700, color: "var(--primary)" }}>{row.ticket_number}</td><td><div>{row.device_name}</div><div style={{ fontSize: 11, color: "var(--primary)", marginTop: 3 }}>{ar ? "الفرع:" : "Branch:"} {row.branch_name || row.terminal_name || "—"}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "المندوب:" : "Rep:"} {row.rep_name || "—"}</div>{row.device_serial ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.device_serial}</div> : null}</td><td>{row.customer_name || "—"}</td><td><select className="form-input form-select" style={{ minWidth: 125, padding: "5px 8px", fontSize: 12 }} value={row.status} onChange={(e) => changeStatus(row, e.target.value)} disabled={row.status === "cancelled"}><option value="open">{statusLabel("open")}</option><option value="in_progress">{statusLabel("in_progress")}</option><option value="ready">{statusLabel("ready")}</option><option value="completed">{statusLabel("completed")}</option><option value="cancelled">{statusLabel("cancelled")}</option></select></td><td>{money(row.parts_total)} SAR</td><td>{money(row.fees_total)} SAR</td><td style={{ color: "#059669", fontWeight: 700 }}>{money(row.paid_amount)} SAR</td><td style={{ color: Number(row.outstanding || 0) > 0 ? "#D97706" : "var(--text-muted)" }}>{money(row.outstanding)} SAR</td><td>{row.invoice_id ? <span className="badge badge-success">{ar ? "صادرة" : "Issued"}</span> : <button className="btn btn-primary btn-sm" onClick={() => issueInvoice(row)} disabled={row.status === "cancelled"}>{ar ? "إصدار" : "Issue"}</button>}</td><td><div style={{ display: "flex", gap: 5 }}><button className="btn btn-primary btn-sm" onClick={() => openInspection(row)} disabled={row.status === "completed" || row.status === "cancelled"}>{ar ? "الفحص" : "Inspect"}</button><button className="btn btn-secondary btn-sm" onClick={() => editTicket(row)} disabled={row.status === "completed" || row.status === "cancelled"}>{ar ? "تعديل" : "Edit"}</button><button className="btn btn-danger btn-sm" onClick={() => removeTicket(row)}>{ar ? "حذف" : "Delete"}</button></div></td><td style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(row.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}</td></tr>)}</tbody></table></div>}</div>}
      {inspectionTicket && <div className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}><div className="card" style={{ width: "min(720px, 100%)", padding: 22 }}><div className="card-header" style={{ padding: 0, marginBottom: 14 }}><h3 className="card-title"><Icon name="settings" size={17} />{ar ? `فحص التذكرة ${inspectionTicket.ticket_number}` : `Inspect ${inspectionTicket.ticket_number}`}</h3><button className="btn btn-ghost btn-sm" onClick={() => setInspectionTicket(null)}>×</button></div><div className="card" style={{ padding: 12, background: "var(--surface-secondary, #f8fafc)" }}><b>{inspectionTicket.device_name}</b><div className="form-hint">{ar ? "العميل:" : "Customer:"} {inspectionTicket.customer_name || "—"} | {ar ? "الفرع:" : "Branch:"} {inspectionTicket.branch_name || inspectionTicket.terminal_name || "—"} | {ar ? "المندوب:" : "Rep:"} {inspectionTicket.rep_name || "—"}</div></div><label className="form-group" style={{ marginTop: 12 }}><span className="form-label">{ar ? "تقرير الفحص والمشكلة المكتشفة *" : "Inspection report and diagnosed problem *"}</span><textarea className="form-input" rows={4} value={inspectionForm.diagnosis} onChange={(e) => setInspectionForm({ ...inspectionForm, diagnosis: e.target.value })} /></label><div className="grid-2"><label className="form-group"><span className="form-label">{ar ? "خدمة الإصلاح" : "Repair service"}</span><input className="form-input" value={inspectionForm.service_name} onChange={(e) => setInspectionForm({ ...inspectionForm, service_name: e.target.value })} placeholder={ar ? "مثال: تغيير شاشة" : "e.g. Screen replacement"} /></label><label className="form-group"><span className="form-label">{ar ? "السعر بعد الفحص" : "Price after inspection"}</span><input className="form-input" type="number" min="0" value={inspectionForm.service_amount} onChange={(e) => setInspectionForm({ ...inspectionForm, service_amount: e.target.value })} /></label></div><div className="card" style={{ marginTop: 10, padding: 12 }}><b>{ar ? "القطعة المغيّرة — اختياري" : "Replacement part — optional"}</b><div className="grid-2" style={{ marginTop: 8 }}><select className="form-input form-select" value={inspectionForm.product_id} onChange={(e) => chooseInspectionProduct(e.target.value)}><option value="">{ar ? "اختر القطعة من الكتالوج" : "Choose part from catalog"}</option>{catalog.map((item) => <option key={item.id} value={item.id}>{item.name_ar}{item.sku ? ` — ${item.sku}` : ""}</option>)}</select><input className="form-input" type="number" min="1" value={inspectionForm.quantity} onChange={(e) => setInspectionForm({ ...inspectionForm, quantity: e.target.value })} placeholder={ar ? "الكمية" : "Quantity"} /></div>{inspectionSerials.length > 0 && <select className="form-input form-select" style={{ marginTop: 8 }} value={inspectionForm.serial_item_id} onChange={(e) => setInspectionForm({ ...inspectionForm, serial_item_id: e.target.value })}><option value="">{ar ? "اختر السيريال" : "Choose serial"}</option>{inspectionSerials.map((serial) => <option key={serial.id} value={serial.id}>{serial.serial_number}</option>)}</select>}</div><div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}><button className="btn btn-secondary" onClick={() => setInspectionTicket(null)}>{ar ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" onClick={saveInspectionFromAdmin}>{ar ? "حفظ الفحص والقطع والسعر" : "Save inspection, part, and price"}</button></div></div></div>}
    </div>
  );
}
