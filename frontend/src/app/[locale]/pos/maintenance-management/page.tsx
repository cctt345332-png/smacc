"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createMaintenanceTicket, getMaintenanceManagementReport, getTerminals, updateMaintenanceTicket } from "@/lib/pos";
import { getCustomers, createCustomer } from "@/lib/sales";
import { getItemsForPicker } from "@/lib/inventory";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";
import { Icon } from "@/components/ui/Icons";

const money = (value: any) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

export default function MaintenanceManagementPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [status, setStatus] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [terminals, setTerminals] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [newCustomer, setNewCustomer] = useState(false);
  const [data, setData] = useState<any>({ summary: {}, by_terminal: [], tickets: [] });
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ terminal_id: "", customer_id: "", customer_name: "", customer_phone: "", product_id: "", device_serial: "", reported_problem: "", notes: "" });

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
      await createMaintenanceTicket({ terminal_id: form.terminal_id, customer_id: customerId, customer_name: customerName, customer_phone: customerPhone, device_name: product.name_ar, device_serial: form.device_serial || null, reported_problem: form.reported_problem, notes: form.notes, estimated_cost: 0, approved_cost: 0, paid_amount: 0 });
      alert(ar ? "تمت إضافة الجهاز للصيانة" : "Device added to maintenance");
      setForm({ terminal_id: "", customer_id: "", customer_name: "", customer_phone: "", product_id: "", device_serial: "", reported_problem: "", notes: "" });
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

  useEffect(() => {
    getTerminals().then((result) => setTerminals(result.data || [])).catch(() => setTerminals([]));
    getCustomers().then((result) => setCustomers(result.data || [])).catch(() => setCustomers([]));
    getItemsForPicker({}).then((result) => setCatalog(result.data || [])).catch(() => setCatalog([]));
    load();
  }, []);

  const summary = data.summary || {};
  const tickets = data.tickets || [];
  const byTerminal = data.by_terminal || [];
  const statusLabel = (value: string) => ({ open: ar ? "جديدة" : "Open", in_progress: ar ? "قيد التنفيذ" : "In progress", ready: ar ? "جاهزة" : "Ready", completed: ar ? "مكتملة" : "Completed", cancelled: ar ? "ملغاة" : "Cancelled" } as Record<string, string>)[value] || value || "—";
  const printRows = tickets.map((row: any) => [row.ticket_number, row.device_name, row.customer_name || "—", statusLabel(row.status), `${money(row.parts_total)} SAR`, `${money(row.fees_total)} SAR`, `${money(row.paid_amount)} SAR`, `${money(row.outstanding)} SAR`]);

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><Link href={`/${locale}/pos`}>{ar ? "نقطة البيع" : "POS"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "إدارة الصيانة" : "Maintenance Management"}</span></div>
          <h1 className="page-title">{ar ? "إدارة صيانة نقاط البيع" : "POS Maintenance Management"}</h1>
          <p className="page-subtitle">{ar ? "متابعة الأجهزة، القطع المصروفة، التحصيل، والعهدة حسب الفترة والجهاز" : "Track devices, issued parts, collections, and custody by period and terminal"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <StructuredReportPrintButton locale={locale} title={ar ? "تقرير إدارة صيانة نقاط البيع" : "POS Maintenance Management Report"} subtitle={ar ? "العهدة والتحصيل والقطع المصروفة" : "Custody, collections, and issued parts"} period={`${fromDate} — ${toDate}`} orientation="landscape" reportCode={`MNT-${today.replaceAll("-", "")}`} metrics={[{ label: ar ? "التذاكر" : "Tickets", value: String(summary.ticket_count || 0), tone: "blue" }, { label: ar ? "التحصيل" : "Collected", value: `${money(summary.paid_total)} SAR`, tone: "green" }, { label: ar ? "المتبقي" : "Outstanding", value: `${money(summary.outstanding_total)} SAR`, tone: "amber" }, { label: ar ? "قيمة القطع" : "Parts value", value: `${money(summary.parts_total)} SAR`, tone: "blue" }]} tables={[{ title: ar ? "تفاصيل الصيانة" : "Maintenance details", headers: [ar ? "التذكرة" : "Ticket", ar ? "الجهاز" : "Device", ar ? "العميل" : "Customer", ar ? "الحالة" : "Status", ar ? "القطع" : "Parts", ar ? "الأجرة" : "Fees", ar ? "المحصّل" : "Collected", ar ? "المتبقي" : "Outstanding"], rows: printRows }]} />
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Icon name="plus" size={15} />{ar ? "إضافة جهاز صيانة" : "Add maintenance device"}</button>
          <Link href={`/${locale}/pos/maintenance`} className="btn btn-secondary"><Icon name="settings" size={15} />{ar ? "تشغيل الصيانة" : "Maintenance Counter"}</Link>
        </div>
      </div>

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
          <div className="card-header" style={{ padding: 0, marginBottom: 16 }}><h3 className="card-title"><Icon name="settings" size={17} />{ar ? "إضافة جهاز للصيانة" : "Add maintenance device"}</h3><button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>×</button></div>
          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "0 0 14px" }}>{ar ? "سيتم تسجيل الجهاز كتذكرة صيانة بدون تحصيل نقدي. التحصيل وصرف القطع يتمان من شاشة تشغيل الصيانة المرتبطة بجلسة الكاشير." : "The device is registered without collection. Collection and parts issue are completed from the maintenance counter linked to a cashier session."}</p>
          <div className="grid-2">
            <label className="form-group"><span className="form-label">{ar ? "جهاز الكاشير *" : "Terminal *"}</span><select className="form-input form-select" value={form.terminal_id} onChange={(e) => setForm({ ...form, terminal_id: e.target.value })}><option value="">{ar ? "اختر الجهاز" : "Select terminal"}</option>{terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}</select></label>
            <label className="form-group"><span className="form-label">{ar ? "الصنف / موديل الجهاز من الكتالوج *" : "Device model from catalog *"}</span><select className="form-input form-select" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}><option value="">{ar ? "اختر الصنف" : "Select product"}</option>{catalog.map((item) => <option key={item.id} value={item.id}>{item.name_ar}{item.sku ? ` — ${item.sku}` : ""}</option>)}</select></label>
          </div>
          <div className="grid-2" style={{ marginTop: 10 }}>
            <label className="form-group"><span className="form-label">{ar ? "العميل *" : "Customer *"}</span>{newCustomer ? <input className="form-input" placeholder={ar ? "اسم العميل الجديد" : "New customer name"} value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value, customer_id: "" })} /> : <select className="form-input form-select" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}><option value="">{ar ? "اختر العميل" : "Select customer"}</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name_ar} — {customer.customer_number}</option>)}</select>}<button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 5 }} onClick={() => { setNewCustomer(!newCustomer); setForm({ ...form, customer_id: "", customer_name: "", customer_phone: "" }); }}>{newCustomer ? (ar ? "اختيار عميل موجود" : "Choose existing customer") : (ar ? "العميل غير موجود؟ تسجيل جديد" : "Customer not found? Register new")}</button></label>
            <label className="form-group"><span className="form-label">{ar ? "الجوال" : "Phone"}</span><input className="form-input" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></label>
          </div>
          <div className="grid-2" style={{ marginTop: 10 }}><label className="form-group"><span className="form-label">{ar ? "سيريال جهاز العميل" : "Customer device serial"}</span><input className="form-input" value={form.device_serial} onChange={(e) => setForm({ ...form, device_serial: e.target.value })} placeholder={ar ? "يُكتب يدويًا حتى لو غير موجود بالمخزون" : "Enter manually; it may not exist in inventory"} /><span className="form-hint">{ar ? "هذا سيريال جهاز العميل، وليس سيريال قطعة من مستودع الصيانة" : "Customer device serial, not a stock part serial"}</span></label><label className="form-group"><span className="form-label">{ar ? "وصف المشكلة *" : "Problem *"}</span><textarea className="form-input" rows={2} value={form.reported_problem} onChange={(e) => setForm({ ...form, reported_problem: e.target.value })} placeholder={ar ? "اكتب العطل بالتفصيل" : "Describe the problem"} /></label></div>
          <label className="form-group" style={{ marginTop: 10 }}><span className="form-label">{ar ? "ملاحظات" : "Notes"}</span><textarea className="form-input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}><button className="btn btn-secondary" onClick={() => setShowAdd(false)}>{ar ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" onClick={addDevice} disabled={saving}>{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ الجهاز" : "Save device")}</button></div>
        </div>
      </div>}

      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[{ label: ar ? "عدد التذاكر" : "Tickets", value: summary.ticket_count || 0, color: "#2563EB" }, { label: ar ? "إجمالي المعتمد" : "Approved total", value: `${money(summary.approved_total)} SAR`, color: "#7C3AED" }, { label: ar ? "المحصّل" : "Collected", value: `${money(summary.paid_total)} SAR`, color: "#059669" }, { label: ar ? "العهدة المتبقية" : "Outstanding custody", value: `${money(summary.outstanding_total)} SAR`, color: "#D97706" }].map((item) => <div className="stat-card" key={item.label}><div className="stat-value" style={{ color: item.color }}>{item.value}</div><div className="stat-label">{item.label}</div></div>)}
      </div>

      <div className="grid-2" style={{ alignItems: "start", marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><h3 className="card-title"><Icon name="pos" size={16} />{ar ? "عهدة الأجهزة" : "Terminal custody"}</h3><span className="badge badge-info">{byTerminal.length}</span></div>
          <div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "الجهاز" : "Terminal"}</th><th>{ar ? "التذاكر" : "Tickets"}</th><th>{ar ? "القطع" : "Parts"}</th><th>{ar ? "المحصّل" : "Collected"}</th><th>{ar ? "المتبقي" : "Outstanding"}</th></tr></thead><tbody>{byTerminal.map((row: any) => <tr key={row.terminal_id}><td style={{ fontWeight: 700 }}>{row.terminal_name}</td><td>{row.ticket_count}</td><td>{money(row.parts_total)} SAR</td><td style={{ color: "#059669", fontWeight: 700 }}>{money(row.paid_total)} SAR</td><td style={{ color: Number(row.outstanding || 0) > 0 ? "#D97706" : "var(--text-muted)" }}>{money(row.outstanding)} SAR</td></tr>)}</tbody></table></div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title"><Icon name="settings" size={16} />{ar ? "رقابة القطع والتحصيل" : "Parts and collection control"}</h3></div>
          <div style={{ padding: 18, display: "grid", gap: 12 }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>{ar ? "قيمة القطع المصروفة" : "Issued parts value"}</span><b>{money(summary.parts_total)} SAR</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>{ar ? "أجور الصيانة" : "Maintenance fees"}</span><b>{money(summary.fees_total)} SAR</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>{ar ? "عدد القطع المصروفة" : "Issued parts count"}</span><b>{summary.issued_parts || 0}</b></div><div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>{ar ? "إجمالي المطلوب" : "Total approved"}</span><b style={{ color: "var(--primary)" }}>{money(summary.approved_total)} SAR</b></div></div>
        </div>
      </div>

      <div className="card"><div className="card-header"><h3 className="card-title"><Icon name="receipt" size={16} />{ar ? "تفاصيل تذاكر الصيانة" : "Maintenance tickets"}</h3><span className="badge badge-gray">{tickets.length}</span></div>{tickets.length === 0 ? <div className="empty-state">{loading ? (ar ? "جاري تحميل التقرير..." : "Loading report...") : (ar ? "لا توجد نتائج ضمن الفلاتر" : "No results for selected filters")}</div> : <div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "التذكرة" : "Ticket"}</th><th>{ar ? "الجهاز" : "Device"}</th><th>{ar ? "العميل" : "Customer"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "القطع" : "Parts"}</th><th>{ar ? "الأجرة" : "Fees"}</th><th>{ar ? "المحصّل" : "Collected"}</th><th>{ar ? "المتبقي" : "Outstanding"}</th><th>{ar ? "التاريخ" : "Date"}</th></tr></thead><tbody>{tickets.map((row: any) => <tr key={row.id}><td style={{ fontWeight: 700, color: "var(--primary)" }}>{row.ticket_number}</td><td>{row.device_name}{row.device_serial ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.device_serial}</div> : null}</td><td>{row.customer_name || "—"}</td><td><select className="form-input form-select" style={{ minWidth: 125, padding: "5px 8px", fontSize: 12 }} value={row.status} onChange={(e) => changeStatus(row, e.target.value)} disabled={row.status === "cancelled"}><option value="open">{statusLabel("open")}</option><option value="in_progress">{statusLabel("in_progress")}</option><option value="ready">{statusLabel("ready")}</option><option value="completed">{statusLabel("completed")}</option><option value="cancelled">{statusLabel("cancelled")}</option></select></td><td>{money(row.parts_total)} SAR</td><td>{money(row.fees_total)} SAR</td><td style={{ color: "#059669", fontWeight: 700 }}>{money(row.paid_amount)} SAR</td><td style={{ color: Number(row.outstanding || 0) > 0 ? "#D97706" : "var(--text-muted)" }}>{money(row.outstanding)} SAR</td><td style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(row.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}</td></tr>)}</tbody></table></div>}</div>
    </div>
  );
}
