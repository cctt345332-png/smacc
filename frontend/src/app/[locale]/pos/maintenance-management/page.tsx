"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { addMaintenancePart, addMaintenanceService, createMaintenanceTicket, deleteMaintenanceTicket, getMaintenanceManagementReport, getMaintenanceSerials, getTerminals, issueMaintenanceInvoice, issueMaintenancePart, recordMaintenancePayment, updateMaintenanceTicket } from "@/lib/pos";
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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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
  const [inspectionForm, setInspectionForm] = useState({ diagnosis: "", service_name: "", service_amount: "", product_id: "", quantity: "1", unit_price: "", serial_item_id: "" });
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
    setInspectionForm({ diagnosis: ticket.diagnosis || "", service_name: ticket.services?.[0]?.service_name || "", service_amount: ticket.services?.[0]?.amount ? String(ticket.services[0].amount) : "", product_id: "", quantity: "1", unit_price: "", serial_item_id: "" });
  };

  const chooseInspectionProduct = async (productId: string) => {
    const product = catalog.find((item) => item.id === productId);
    setInspectionForm({ ...inspectionForm, product_id: productId, unit_price: product?.sale_price != null ? String(product.sale_price) : "", serial_item_id: "" });
    if (product?.tracking_type === "serial") {
      try { const result = await getMaintenanceSerials(inspectionTicket.id, productId); setInspectionSerials(result.data || []); } catch { setInspectionSerials([]); }
    } else setInspectionSerials([]);
  };

  const saveInspectionFromAdmin = async () => {
    if (!inspectionTicket || !inspectionForm.diagnosis.trim()) return alert(ar ? "اكتب تقرير الفحص أولاً" : "Enter the inspection report first");
    try {
      await updateMaintenanceTicket(inspectionTicket.id, { diagnosis: inspectionForm.diagnosis, status: "ready" });
      if (inspectionForm.service_name.trim() && Number(inspectionForm.service_amount) > 0) await addMaintenanceService(inspectionTicket.id, { service_name: inspectionForm.service_name.trim(), amount: Number(inspectionForm.service_amount) });
      if (inspectionForm.product_id) await addMaintenancePart(inspectionTicket.id, { product_id: inspectionForm.product_id, quantity: Number(inspectionForm.quantity || 1), unit_price: Number(inspectionForm.unit_price || 0), serial_item_id: inspectionForm.serial_item_id || undefined });
      setInspectionTicket(null); await load(); alert(ar ? "تم حفظ تقرير الفحص والقطع والتكلفة" : "Inspection, parts, and cost saved");
    } catch (error: any) { alert(error?.response?.data?.detail || (ar ? "تعذر حفظ بيانات الفحص" : "Could not save inspection data")); }
  };

  const approveRepair = async (ticket: any) => {
    const planned = (ticket.parts || []).filter((part: any) => part.status === "planned");
    if (!planned.length) return alert(ar ? "لا توجد قطع مقترحة للصرف في هذا الطلب" : "There are no planned parts to issue");
    if (!confirm(ar ? `اعتماد الإصلاح وصرف ${planned.length} قطعة من مخزون الصيانة؟` : `Approve repair and issue ${planned.length} part(s) from maintenance stock?`)) return;
    try {
      for (const part of planned) await issueMaintenancePart(ticket.id, part.id);
      await updateMaintenanceTicket(ticket.id, { status: "ready" });
      await load();
      alert(ar ? "تم اعتماد الإصلاح وصرف القطع وخصمها من مخزون الصيانة" : "Repair approved; parts issued and deducted from maintenance stock");
    } catch (error: any) { alert(error?.response?.data?.detail || (ar ? "تعذر اعتماد الإصلاح أو صرف القطع" : "Could not approve repair or issue parts")); }
  };

  const printLabel = (ticket: any) => {
    const popup = window.open("", "_blank", "width=420,height=320");
    if (!popup) return alert(ar ? "اسمح بالنوافذ المنبثقة لطباعة الملصق" : "Allow pop-ups to print the label");
    const esc = (value: any) => String(value || "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
    popup.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>ملصق ${esc(ticket.ticket_number)}</title><style>@page{size:80mm auto;margin:3mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;width:74mm;color:#111}.label{border:1px solid #111;padding:10px;text-align:center}.title{font-size:18px;font-weight:800;margin-bottom:10px;border-bottom:1px solid #111;padding-bottom:7px}.row{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted #777;padding:6px 0;font-size:13px}.value{font-weight:700}.ticket{font-size:22px;font-weight:900;margin-top:10px;letter-spacing:1px}</style></head><body><div class="label"><div class="title">ملصق صيانة</div><div class="row"><span>اسم العميل</span><span class="value">${esc(ticket.customer_name)}</span></div><div class="row"><span>رقم العميل</span><span class="value">${esc(ticket.customer_number)}</span></div><div class="ticket">${esc(ticket.ticket_number)}</div></div><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    popup.document.close();
  };

  const printInspectionReport = (ticket: any) => {
    const popup = window.open("", "_blank", "width=420,height=760");
    if (!popup) return alert(ar ? "اسمح بالنوافذ المنبثقة لطباعة التقرير" : "Allow pop-ups to print the report");
    const esc = (value: any) => String(value || "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
    const parts = (ticket.parts || []).map((part: any) => `<tr><td>${esc(part.product_name)}</td><td>${esc(part.quantity)}</td><td>${esc(money(part.unit_price))} ر.س</td><td>${esc(money(part.total))} ر.س</td></tr>`).join("");
    const services = (ticket.services || []).map((line: any) => `<tr><td>${esc(line.service_name)}</td><td colspan="2">أجرة إصلاح</td><td>${esc(money(line.amount))} ر.س</td></tr>`).join("");
    popup.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>تقرير فحص ${esc(ticket.ticket_number)}</title><style>@page{size:80mm auto;margin:3mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#111;line-height:1.45;margin:0;width:74mm;font-size:11px}.header{text-align:center;border-bottom:1px dashed #111;padding-bottom:7px;margin-bottom:8px}.title{font-size:17px;font-weight:800}.meta{border-bottom:1px dashed #111;padding-bottom:7px;margin-bottom:8px}.row{display:flex;gap:5px;margin:3px 0}.label{font-weight:700}.section{font-weight:800;font-size:12px;border-bottom:1px solid #111;margin-top:9px;margin-bottom:5px;padding-bottom:3px}.diagnosis{border:1px solid #aaa;min-height:45px;padding:6px;white-space:pre-wrap}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #aaa;padding:4px;text-align:right}th{background:#f1f1f1}.footer{margin-top:12px;text-align:center;font-size:9px}</style></head><body><div class="header"><div class="title">تقرير فحص وصيانة</div><div>رقم الطلب: ${esc(ticket.ticket_number)}</div></div><div class="meta"><div class="row"><span class="label">العميل:</span><span>${esc(ticket.customer_name)}</span></div><div class="row"><span class="label">الجوال:</span><span>${esc(ticket.customer_phone)}</span></div><div class="row"><span class="label">الجهاز:</span><span>${esc(ticket.device_name)}</span></div><div class="row"><span class="label">السيريال:</span><span>${esc(ticket.device_serial)}</span></div><div class="row"><span class="label">الفرع:</span><span>${esc(ticket.branch_name || ticket.terminal_name)}</span></div><div class="row"><span class="label">التاريخ:</span><span>${esc(new Date(ticket.created_at).toLocaleString("ar-SA"))}</span></div></div><div class="section">وصف المشكلة عند الاستلام</div><div class="diagnosis">${esc(ticket.reported_problem)}</div><div class="section">نتيجة الفحص والتشخيص</div><div class="diagnosis">${esc(ticket.diagnosis)}</div><div class="section">القطع والخدمات المقترحة</div><table><thead><tr><th>البيان</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${parts}${services || '<tr><td colspan="4">لا توجد قطع أو خدمات مضافة</td></tr>'}</tbody></table><div class="footer">هذا التقرير يوضح نتيجة الفحص والتكلفة المقترحة، ولا تُصرف القطع إلا بعد اعتماد الإصلاح.</div><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    popup.document.close();
  };

  const printMaintenanceReceipt = (ticket: any) => {
    const popup = window.open("", "_blank", "width=420,height=760");
    if (!popup) return alert(ar ? "اسمح بالنوافذ المنبثقة لطباعة إيصال الصيانة" : "Allow pop-ups to print the maintenance receipt");
    const esc = (value: any) => String(value || "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
    const parts = (ticket.parts || []).map((part: any) => `<div class="line"><span>${esc(part.product_name)} × ${esc(part.quantity)}</span><b>${esc(money(part.total))} ر.س</b></div>`).join("");
    const services = (ticket.services || []).map((line: any) => `<div class="line"><span>${esc(line.service_name)}</span><b>${esc(money(line.amount))} ر.س</b></div>`).join("");
    popup.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>إيصال صيانة ${esc(ticket.ticket_number)}</title><style>@page{size:80mm auto;margin:3mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;margin:0;width:74mm;color:#111;font-size:11px;line-height:1.45}.center{text-align:center}.company{font-size:16px;font-weight:800}.title{font-size:15px;font-weight:800;margin-top:8px}.sub{font-size:10px}.rule{border-top:1px dashed #111;margin:7px 0}.row{display:flex;justify-content:space-between;gap:6px;margin:3px 0}.label{font-weight:700}.section{font-weight:800;border-bottom:1px solid #111;margin-top:8px;padding-bottom:3px}.line{display:flex;justify-content:space-between;gap:5px;border-bottom:1px dotted #999;padding:4px 0;font-size:10px}.total{display:flex;justify-content:space-between;font-weight:800;font-size:13px;margin-top:8px}</style></head><body><div class="center"><div class="company">إيصال صيانة</div><div class="sub">غير ضريبي — طلب صيانة</div><div class="sub">${esc(ticket.ticket_number)}</div></div><div class="rule"></div><div class="row"><span class="label">العميل:</span><span>${esc(ticket.customer_name)}</span></div><div class="row"><span class="label">الجوال:</span><span>${esc(ticket.customer_phone)}</span></div><div class="row"><span class="label">الجهاز:</span><span>${esc(ticket.device_name)}</span></div><div class="row"><span class="label">السيريال:</span><span>${esc(ticket.device_serial)}</span></div><div class="row"><span class="label">التاريخ:</span><span>${esc(new Date(ticket.created_at).toLocaleString("ar-SA"))}</span></div><div class="section">الخدمات والقطع</div>${services}${parts || '<div class="sub center" style="margin-top:6px">لم تحدد خدمات أو قطع بعد</div>'}<div class="rule"></div><div class="total"><span>الإجمالي المقترح</span><span>${esc(money(ticket.approved_cost || ticket.parts_total || 0))} ر.س</span></div><div class="rule"></div><div class="center sub">شكرًا لثقتكم بنا — www.ab-tw.com</div><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    popup.document.close();
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

  const collectPayment = async (ticket: any) => {
    if (!ticket.session_id) return alert(ar ? "لا توجد جلسة كاشير مرتبطة بهذه التذكرة. افتحها من نقطة البيع لتحصيل الدفعة." : "This ticket has no cashier session. Open it from POS to collect the payment.");
    const raw = window.prompt(ar ? `المتبقي ${money(ticket.outstanding)} ريال — أدخل مبلغ الدفعة النقدية` : `Outstanding ${money(ticket.outstanding)} SAR — enter cash payment`);
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0 || amount > Number(ticket.outstanding || 0)) return alert(ar ? "أدخل مبلغًا صحيحًا لا يتجاوز المتبقي" : "Enter a valid amount not exceeding the outstanding balance");
    try { await recordMaintenancePayment(ticket.id, { session_id: ticket.session_id, amount, payment_method: "cash" }); await load(); alert(ar ? "تم تسجيل واستلام الدفعة النقدية" : "Cash payment received and recorded"); } catch (error: any) { alert(error?.response?.data?.detail || (ar ? "تعذر تسجيل الدفعة" : "Could not record payment")); }
  };

  const paymentStatus = (ticket: any) => {
    const total = Math.max(Number(ticket.approved_cost || 0), Number(ticket.parts_total || 0) + Number(ticket.fees_total || ticket.services_total || 0));
    const paid = Number(ticket.paid_amount || 0);
    const outstanding = Math.max(0, total - paid);
    if (total <= 0) return { label: ar ? "لم يحدد السعر" : "Price pending", color: "#64748b", bg: "#f1f5f9" };
    if (outstanding <= 0) return { label: ar ? "مدفوع بالكامل" : "Paid in full", color: "#047857", bg: "#d1fae5" };
    if (paid > 0) return { label: ar ? "دفع جزئي" : "Partially paid", color: "#b45309", bg: "#fef3c7" };
    return { label: ar ? "غير مدفوع" : "Unpaid", color: "#b91c1c", bg: "#fee2e2" };
  };

  const showPaymentHistory = (ticket: any) => {
    const payments = ticket.payments || [];
    if (!payments.length) return alert(ar ? "لا توجد دفعات مسجلة لهذا الطلب" : "No payments recorded for this request");
    const lines = payments.map((payment: any) => `${new Date(payment.created_at).toLocaleString(ar ? "ar-SA" : "en-GB")} — ${money(payment.amount)} SAR — ${payment.payment_method === "cash" ? (ar ? "نقدي" : "Cash") : payment.payment_method}`).join("\n");
    alert(`${ar ? "سجل دفعات" : "Payment history"} ${ticket.ticket_number}\n\n${lines}`);
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

      {view === "tickets" && <div className="card"><div className="card-header"><h3 className="card-title"><Icon name="receipt" size={16} />{ar ? "تفاصيل تذاكر الصيانة" : "Maintenance tickets"}</h3><span className="badge badge-gray">{tickets.length}</span></div>{tickets.length === 0 ? <div className="empty-state">{loading ? (ar ? "جاري تحميل التذاكر..." : "Loading tickets...") : (ar ? "لا توجد تذاكر ضمن الفلاتر" : "No tickets for selected filters")}</div> : <div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "التذكرة" : "Ticket"}</th><th>{ar ? "الجهاز" : "Device"}</th><th>{ar ? "العميل" : "Customer"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "القطع" : "Parts"}</th><th>{ar ? "الأجرة" : "Fees"}</th><th>{ar ? "المحصّل" : "Collected"}</th><th>{ar ? "المتبقي" : "Outstanding"}</th><th>{ar ? "حالة السداد" : "Payment status"}</th><th>{ar ? "فاتورة" : "Invoice"}</th><th>{ar ? "إجراءات" : "Actions"}</th><th>{ar ? "التاريخ" : "Date"}</th></tr></thead><tbody>{tickets.map((row: any) => <tr key={row.id}><td style={{ fontWeight: 700, color: "var(--primary)" }}>{row.ticket_number}</td><td><div>{row.device_name}</div><div style={{ fontSize: 11, color: "#b91c1c", marginTop: 3 }}>{ar ? "المشكلة:" : "Problem:"} {row.reported_problem || "—"}</div><div style={{ fontSize: 11, color: "var(--primary)", marginTop: 3 }}>{ar ? "الفرع:" : "Branch:"} {row.branch_name || row.terminal_name || "—"}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "المندوب:" : "Rep:"} {row.rep_name || "—"}</div>{row.device_serial ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.device_serial}</div> : null}</td><td>{row.customer_name || "—"}</td><td><select className="form-input form-select" style={{ minWidth: 125, padding: "5px 8px", fontSize: 12 }} value={row.status} onChange={(e) => changeStatus(row, e.target.value)} disabled={row.status === "cancelled"}><option value="open">{statusLabel("open")}</option><option value="in_progress">{statusLabel("in_progress")}</option><option value="ready">{statusLabel("ready")}</option><option value="completed">{statusLabel("completed")}</option><option value="cancelled">{statusLabel("cancelled")}</option></select></td><td>{money(row.parts_total)} SAR</td><td>{money(row.fees_total)} SAR</td><td style={{ color: "#059669", fontWeight: 700 }}>{money(row.paid_amount)} SAR</td><td style={{ color: Number(row.outstanding || 0) > 0 ? "#D97706" : "var(--text-muted)" }}>{money(row.outstanding)} SAR</td><td><span style={{ display: "inline-block", padding: "4px 7px", borderRadius: 6, color: paymentStatus(row).color, background: paymentStatus(row).bg, fontWeight: 700, fontSize: 11 }}>{paymentStatus(row).label}</span><div style={{ fontSize: 11, marginTop: 4, color: "var(--text-muted)" }}>{money(row.paid_amount)} / {money(Math.max(Number(row.approved_cost || 0), Number(row.parts_total || 0) + Number(row.fees_total || row.services_total || 0)))} SAR</div></td><td>{row.invoice_id ? <span className="badge badge-success">{ar ? "صادرة" : "Issued"}</span> : <button className="btn btn-primary btn-sm" onClick={() => issueInvoice(row)} disabled={row.status === "cancelled"}>{ar ? "إصدار" : "Issue"}</button>}</td><td><div style={{ display: "flex", gap: 5 }}><button className="btn btn-ghost btn-sm" onClick={() => printLabel(row)}>{ar ? "ملصق" : "Label"}</button><button className="btn btn-secondary btn-sm" onClick={() => printInspectionReport(row)}>{ar ? "تقرير الفحص" : "Inspection report"}</button><button className="btn btn-secondary btn-sm" onClick={() => printMaintenanceReceipt(row)}>{ar ? "إيصال صيانة" : "Maintenance receipt"}</button>{Number(row.outstanding || 0) > 0 && <button className="btn btn-success btn-sm" onClick={() => collectPayment(row)}>{ar ? "تحصيل" : "Collect"}</button>} {row.payments?.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => showPaymentHistory(row)}>{ar ? "سجل الدفعات" : "Payments"}</button>}<button className="btn btn-primary btn-sm" onClick={() => openInspection(row)} disabled={row.status === "completed" || row.status === "cancelled"}>{ar ? "رفع تقرير الفحص" : "Upload inspection report"}</button>{(row.parts || []).some((part: any) => part.status === "planned") && <button className="btn btn-success btn-sm" onClick={() => approveRepair(row)} disabled={row.status === "cancelled"}>{ar ? "اعتماد وصرف القطع" : "Approve & issue parts"}</button>}<button className="btn btn-secondary btn-sm" onClick={() => editTicket(row)} disabled={row.status === "completed" || row.status === "cancelled"}>{ar ? "تعديل" : "Edit"}</button><button className="btn btn-sm" style={{ background: "#dc2626", color: "#fff", borderColor: "#dc2626" }} onClick={() => removeTicket(row)}>{ar ? "حذف" : "Delete"}</button></div></td><td style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(row.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}</td></tr>)}</tbody></table></div>}</div>}
      {inspectionTicket && <div className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}><div className="card" style={{ width: "min(720px, 100%)", padding: 22 }}><div className="card-header" style={{ padding: 0, marginBottom: 14 }}><h3 className="card-title"><Icon name="settings" size={17} />{ar ? `فحص التذكرة ${inspectionTicket.ticket_number}` : `Inspect ${inspectionTicket.ticket_number}`}</h3><button className="btn btn-ghost btn-sm" onClick={() => setInspectionTicket(null)}>×</button></div><div className="card" style={{ padding: 12, background: "var(--surface-secondary, #f8fafc)" }}><b>{inspectionTicket.device_name}</b><div className="form-hint">{ar ? "العميل:" : "Customer:"} {inspectionTicket.customer_name || "—"} | {ar ? "الفرع:" : "Branch:"} {inspectionTicket.branch_name || inspectionTicket.terminal_name || "—"} | {ar ? "المندوب:" : "Rep:"} {inspectionTicket.rep_name || "—"}</div></div><label className="form-group" style={{ marginTop: 12 }}><span className="form-label">{ar ? "تقرير الفحص والمشكلة المكتشفة *" : "Inspection report and diagnosed problem *"}</span><textarea className="form-input" rows={4} value={inspectionForm.diagnosis} onChange={(e) => setInspectionForm({ ...inspectionForm, diagnosis: e.target.value })} /></label><div className="grid-2"><label className="form-group"><span className="form-label">{ar ? "خدمة الإصلاح" : "Repair service"}</span><input className="form-input" value={inspectionForm.service_name} onChange={(e) => setInspectionForm({ ...inspectionForm, service_name: e.target.value })} placeholder={ar ? "مثال: تغيير شاشة" : "e.g. Screen replacement"} /></label><label className="form-group"><span className="form-label">{ar ? "السعر بعد الفحص" : "Price after inspection"}</span><input className="form-input" type="number" min="0" value={inspectionForm.service_amount} onChange={(e) => setInspectionForm({ ...inspectionForm, service_amount: e.target.value })} /></label></div>{inspectionForm.diagnosis.trim() && <div className="card" style={{ marginTop: 10, padding: 12 }}><b>{ar ? "القطعة المغيّرة — اختياري بعد تقرير الفحص" : "Replacement part — optional after inspection report"}</b><div className="grid-2" style={{ marginTop: 8 }}><select className="form-input form-select" value={inspectionForm.product_id} onChange={(e) => chooseInspectionProduct(e.target.value)}><option value="">{ar ? "اختر القطعة من الكتالوج" : "Choose part from catalog"}</option>{catalog.map((item) => <option key={item.id} value={item.id}>{item.name_ar}{item.sku ? ` — ${item.sku}` : ""}</option>)}</select><input className="form-input" type="number" min="1" value={inspectionForm.quantity} onChange={(e) => setInspectionForm({ ...inspectionForm, quantity: e.target.value })} placeholder={ar ? "الكمية" : "Quantity"} /><input className="form-input" type="number" min="0" value={inspectionForm.unit_price} onChange={(e) => setInspectionForm({ ...inspectionForm, unit_price: e.target.value })} placeholder={ar ? "سعر القطعة" : "Part price"} /></div>{inspectionSerials.length > 0 && <select className="form-input form-select" style={{ marginTop: 8 }} value={inspectionForm.serial_item_id} onChange={(e) => setInspectionForm({ ...inspectionForm, serial_item_id: e.target.value })}><option value="">{ar ? "اختر السيريال" : "Choose serial"}</option>{inspectionSerials.map((serial) => <option key={serial.id} value={serial.id}>{serial.serial_number}</option>)}</select>}</div>}{/* لا تظهر القطع قبل تسجيل تقرير الفحص */}<div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}><button className="btn btn-secondary" onClick={() => setInspectionTicket(null)}>{ar ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" onClick={saveInspectionFromAdmin}>{ar ? "حفظ تقرير الفحص" : "Save inspection report"}</button></div></div></div>}
    </div>
  );
}
