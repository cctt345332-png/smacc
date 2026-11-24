"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getTerminals, getMaintenanceTickets, createMaintenanceTicket, addMaintenancePart, recordMaintenancePayment, getTerminalMaintenanceSerials, updateMaintenanceTicket, addMaintenanceService, issueMaintenanceInvoice } from "@/lib/pos";
import { getItemsForPicker } from "@/lib/inventory";
import { getCustomers, createCustomer } from "@/lib/sales";
import { getCompany } from "@/lib/settings";
import MaintenanceIntakeReceipt from "@/components/pos/MaintenanceIntakeReceipt";
import { Icon } from "@/components/ui/Icons";

const money = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type CartLine = { product_id: string; name_ar: string; tracking_type: string; quantity: number; unit_price: number; serial_item_id?: string; serial_number?: string };

export default function POSMaintenancePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const router = useRouter();
  const qs = useSearchParams();
  const terminalId = qs.get("terminal_id") || "";
  const sessionId = qs.get("session_id") || "";
  const [terminal, setTerminal] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [serials, setSerials] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [receiptTicket, setReceiptTicket] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [inspection, setInspection] = useState({ diagnosis: "", service_name: "", service_amount: "" });
  const [manualCustomer, setManualCustomer] = useState(false);
  const [form, setForm] = useState({ customer_id: "", customer_name: "", customer_phone: "", customer_address: "", product_id: "", device_color: "", device_capacity: "", device_serial: "", purchase_date: "", lock_type: "none", lock_secret: "", problem_type: "", symptoms: [] as string[], reported_problem: "", approved_cost: "", paid_amount: "" });
  const [attachments, setAttachments] = useState<string[]>([]);

  const load = async () => {
    try {
      const tr = await getTerminals();
      const found = (tr.data || []).find((x: any) => x.id === terminalId);
      const [tk, catalog, customerList, companyResult] = await Promise.all([
        getMaintenanceTickets({ terminal_id: terminalId || undefined }),
        getItemsForPicker({}),
        getCustomers(undefined, found?.maintenance_customer_account_parent_id || found?.customer_account_parent_id || undefined),
        getCompany(),
      ]);
      setTerminal(found || null);
      setTickets(tk.data || []);
      setCatalogItems(catalog.data || []);
      setCustomers(customerList.data || []);
      setCompany(companyResult.data || null);
      if (found?.maintenance_warehouse_id) {
        const r = await getItemsForPicker({ warehouse_id: found.maintenance_warehouse_id });
        setItems(r.data || []);
      } else setItems([]);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [terminalId, sessionId]);

  const addProduct = async (item: any) => {
    if (item.tracking_type === "serial") {
      try { const r = await getTerminalMaintenanceSerials(terminalId, item.id); setSerials(r.data || []); } catch { setSerials([]); }
    }
    setSelectedProduct(item);
  };
  const addLine = (serial?: any) => {
    if (!selectedProduct) return;
    const key = serial?.id || selectedProduct.id;
    const existing = cart.find(x => (x.serial_item_id || x.product_id) === key);
    if (existing && selectedProduct.tracking_type !== "serial") {
      setCart(cart.map(x => x === existing ? { ...x, quantity: x.quantity + 1 } : x));
    } else {
      setCart([...cart, { product_id: selectedProduct.id, name_ar: selectedProduct.name_ar, tracking_type: selectedProduct.tracking_type, quantity: 1, unit_price: Number(selectedProduct.sale_price || 0), serial_item_id: serial?.id, serial_number: serial?.serial_number }]);
    }
    setSelectedProduct(null); setSerials([]);
  };
  const totalParts = cart.reduce((s, x) => s + x.quantity * x.unit_price, 0);
  const totalDue = Number(form.approved_cost || 0) + totalParts;

  const save = async () => {
    if (!terminalId || !sessionId) return alert("افتح جلسة الكاشير أولًا ثم ادخل إلى الصيانة");
    const deviceProduct = catalogItems.find((item) => item.id === form.product_id);
    if (!deviceProduct || !form.reported_problem.trim()) return alert("اختر موديل الجهاز من الكتالوج واكتب وصف العطل");
    if (!form.device_serial.trim()) return alert("رقم السيريال مطلوب");
    setSaving(true);
    try {
      let customer = customers.find((item) => item.id === form.customer_id);
      if (manualCustomer) {
        if (!form.customer_name.trim()) return alert("اكتب اسم العميل");
        const createdCustomer = await createCustomer({ customer_type: "individual", name_ar: form.customer_name.trim(), phone: form.customer_phone.trim() || undefined, address_street: form.customer_address.trim() || undefined, ar_account_id: terminal?.maintenance_customer_account_parent_id || terminal?.customer_account_parent_id || undefined });
        customer = createdCustomer.data;
      }
      if (!manualCustomer && !customer) return alert("اختر العميل أو فعّل الإدخال اليدوي");
      const r = await createMaintenanceTicket({ terminal_id: terminalId, session_id: sessionId, customer_id: customer?.id || null, customer_name: manualCustomer ? form.customer_name.trim() : customer?.name_ar, customer_phone: manualCustomer ? form.customer_phone : (customer?.phone || form.customer_phone), customer_address: form.customer_address, device_name: deviceProduct.name_ar, device_color: form.device_color || null, device_capacity: form.device_capacity || null, device_serial: form.device_serial, purchase_date: form.purchase_date || null, lock_type: form.lock_type, lock_secret: form.lock_secret || null, problem_type: form.problem_type, symptoms: form.symptoms, attachment_urls: attachments, reported_problem: form.reported_problem, approved_cost: 0, paid_amount: 0 });
      alert("تم إنشاء طلب الصيانة. اطبع إيصال الاستلام ثم انتقل الطلب إلى الفحص.");
      setReceiptTicket(r.data); setSelectedTicket(null); setCart([]); setAttachments([]); setManualCustomer(false); setForm({ customer_id: "", customer_name: "", customer_phone: "", customer_address: "", product_id: "", device_color: "", device_capacity: "", device_serial: "", purchase_date: "", lock_type: "none", lock_secret: "", problem_type: "", symptoms: [], reported_problem: "", approved_cost: "", paid_amount: "" });
      await load();
    } catch (e: any) { alert(e?.response?.data?.detail || "تعذر حفظ عملية الصيانة"); }
    finally { setSaving(false); }
  };

  const handleAttachments = async (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, 5);
    const encoded = await Promise.all(selected.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
    setAttachments(encoded);
  };

  const printIntakeReceipt = () => {
    if (!receiptTicket) return;
    window.print();
  };

  const openTicketInspection = (ticket: any) => {
    setSelectedTicket(ticket);
    setCart([]);
    setInspection({ diagnosis: ticket.diagnosis || "", service_name: "", service_amount: "" });
  };

  const printInspectionReport = (ticket: any) => {
    const popup = window.open("", "_blank", "width=760,height=900");
    if (!popup) return alert("اسمح بالنوافذ المنبثقة لطباعة تقرير الفحص");
    const esc = (value: any) => String(value || "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
    const parts = (ticket.parts || []).map((part: any) => `<tr><td>${esc(part.product_name)}</td><td>${esc(part.quantity)}</td><td>${esc(money(part.unit_price))} ر.س</td></tr>`).join("");
    popup.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>تقرير فحص ${esc(ticket.ticket_number)}</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,Tahoma,sans-serif;color:#111;line-height:1.6}.header{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px}.title{font-size:22px;font-weight:800}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;border:1px solid #bbb;padding:12px;margin-bottom:16px}.row{display:flex;gap:8px}.label{font-weight:700}.section{font-weight:800;font-size:16px;border-bottom:1px solid #111;margin-top:18px;margin-bottom:8px;padding-bottom:4px}.diagnosis{border:1px solid #aaa;min-height:80px;padding:10px;white-space:pre-wrap}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:7px;text-align:right}th{background:#f1f1f1}</style></head><body><div class="header"><div class="title">تقرير فحص وصيانة</div><div>رقم الطلب: ${esc(ticket.ticket_number)}</div></div><div class="meta"><div class="row"><span class="label">العميل:</span><span>${esc(ticket.customer_name)}</span></div><div class="row"><span class="label">الجوال:</span><span>${esc(ticket.customer_phone)}</span></div><div class="row"><span class="label">الجهاز:</span><span>${esc(ticket.device_name)}</span></div><div class="row"><span class="label">السيريال:</span><span>${esc(ticket.device_serial)}</span></div></div><div class="section">المشكلة عند الاستلام</div><div class="diagnosis">${esc(ticket.reported_problem)}</div><div class="section">نتيجة الفحص</div><div class="diagnosis">${esc(ticket.diagnosis)}</div><div class="section">القطع المقترحة</div><table><thead><tr><th>القطعة</th><th>الكمية</th><th>السعر</th></tr></thead><tbody>${parts || '<tr><td colspan="3">لا توجد قطع مقترحة</td></tr>'}</tbody></table><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    popup.document.close();
  };

  const saveInspection = async () => {
    if (!selectedTicket) return;
    if (!inspection.diagnosis.trim()) return alert("اكتب تقرير الفحص والمشكلة المكتشفة أولاً");
    if (inspection.service_name.trim() && Number(inspection.service_amount) <= 0) return alert("أدخل سعر الخدمة بشكل صحيح");
    setSaving(true);
    try {
      const repairAmount = Number(inspection.service_amount || 0);
      await updateMaintenanceTicket(selectedTicket.id, { diagnosis: inspection.diagnosis, approved_cost: repairAmount, status: selectedTicket.status === "open" ? "in_progress" : selectedTicket.status });
      if (inspection.service_name.trim() && repairAmount > 0) await addMaintenanceService(selectedTicket.id, { service_name: inspection.service_name.trim(), amount: repairAmount });
      const refreshed = (await getMaintenanceTickets({ terminal_id: terminalId })).data.find((x: any) => x.id === selectedTicket.id);
      setSelectedTicket(refreshed || selectedTicket); setCart([]); setInspection({ ...inspection, service_name: "", service_amount: "" });
      alert("تم حفظ تقرير الفحص ووصف القطعة وسعر الإصلاح."); await load();
    } catch (e: any) { alert(e?.response?.data?.detail || "تعذر حفظ تقرير الفحص"); } finally { setSaving(false); }
  };

  const changeTicketStatus = async (status: string) => {
    if (!selectedTicket) return;
    try {
      const result = await updateMaintenanceTicket(selectedTicket.id, { status });
      setSelectedTicket(result.data || { ...selectedTicket, status });
      await load();
    } catch (e: any) { alert(e?.response?.data?.detail || "تعذر تحديث حالة طلب الصيانة"); }
  };

  const printPaymentReceipt = (ticket: any, amount: number, previousPaid: number) => {
    const popup = window.open("", "_blank", "width=420,height=700");
    if (!popup) return alert("اسمح بالنوافذ المنبثقة لطباعة إيصال الدفع");
    const esc = (value: any) => String(value || "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
    const total = Math.max(Number(ticket.approved_cost || 0), Number(ticket.parts_total || 0) + Number(ticket.services_total || 0));
    const paid = Number(ticket.paid_amount ?? previousPaid + amount);
    const remaining = Math.max(0, total - paid);
    popup.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>إيصال دفع صيانة ${esc(ticket.ticket_number)}</title><style>@page{size:80mm auto;margin:3mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;margin:0;width:74mm;color:#111;font-size:11px;line-height:1.5}.center{text-align:center}.title{font-size:17px;font-weight:800}.sub{font-size:10px}.rule{border-top:1px dashed #111;margin:8px 0}.row{display:flex;justify-content:space-between;gap:6px;margin:5px 0}.value{font-weight:700}.paid{font-size:18px;font-weight:900;text-align:center;margin:10px 0}.remaining{font-weight:800;font-size:13px}</style></head><body><div class="center"><div class="title">إيصال دفع صيانة</div><div class="sub">غير ضريبي</div><div class="sub">${esc(ticket.ticket_number)}</div></div><div class="rule"></div><div class="row"><span>العميل:</span><span class="value">${esc(ticket.customer_name)}</span></div><div class="row"><span>الجهاز:</span><span class="value">${esc(ticket.device_name)}</span></div><div class="row"><span>السيريال:</span><span class="value">${esc(ticket.device_serial)}</span></div><div class="rule"></div><div class="paid">تم استلام ${esc(money(amount))} ر.س نقدًا</div><div class="row"><span>إجمالي الطلب:</span><span>${esc(money(total))} ر.س</span></div><div class="row"><span>إجمالي المدفوع:</span><span>${esc(money(paid))} ر.س</span></div><div class="row remaining"><span>المتبقي:</span><span>${esc(money(remaining))} ر.س</span></div><div class="rule"></div><div class="center sub">شكرًا لثقتكم بنا — www.ab-tw.com</div><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    popup.document.close();
  };

  const collectFromPOS = async () => {
    if (!selectedTicket) return;
    const current = (await getMaintenanceTickets({ terminal_id: terminalId })).data.find((x: any) => x.id === selectedTicket.id) || selectedTicket;
    const total = Math.max(Number(current.approved_cost || 0), Number(current.parts_total || 0) + Number(current.services_total || 0));
    const outstanding = Math.max(0, total - Number(current.paid_amount || 0));
    if (outstanding <= 0) return alert("هذا الطلب مدفوع بالكامل");
    const raw = window.prompt(`المتبقي ${money(outstanding)} ريال — أدخل مبلغ الدفع النقدي`);
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding) return alert("أدخل مبلغًا صحيحًا لا يتجاوز المتبقي");
    setSaving(true);
    try {
      const result = await recordMaintenancePayment(current.id, { session_id: sessionId, amount, payment_method: "cash" });
      setSelectedTicket(result.data || current);
      await load();
      printPaymentReceipt(result.data || current, amount, Number(current.paid_amount || 0));
    } catch (e: any) { alert(e?.response?.data?.detail || "تعذر تسجيل دفعة الصيانة"); }
    finally { setSaving(false); }
  };

  const issueInvoiceFromPOS = async () => {
    if (!selectedTicket) return;
    if (Number(selectedTicket.paid_amount || 0) <= 0) return alert("سجل الدفع أولًا قبل إصدار الفاتورة");
    if (!confirm("إصدار فاتورة الصيانة لهذا الطلب؟")) return;
    setSaving(true);
    try {
      const result = await issueMaintenanceInvoice(selectedTicket.id);
      setSelectedTicket(result.data || selectedTicket);
      await load();
      alert(`تم إصدار الفاتورة ${result.data?.invoice_number || ""}`);
    } catch (e: any) { alert(e?.response?.data?.detail || "تعذر إصدار فاتورة الصيانة"); }
    finally { setSaving(false); }
  };


  return <div dir={ar ? "rtl" : "ltr"} className="legacy-pos" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--header-height))", overflow: "hidden" }}>
    <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/${locale}/pos/cashier?terminal=${encodeURIComponent(terminalId)}&session_id=${encodeURIComponent(sessionId)}`)} title={ar ? "العودة للكاشير" : "Back to cashier"}><Icon name={ar ? "arrowRight" : "arrowLeft"} size={16} /></button>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F4EFF7", display: "flex", alignItems: "center", justifyContent: "center", color: "#3E0865" }}><Icon name="settings" size={16} /></div>
        <div><div style={{ fontWeight: 700, fontSize: 13 }}>{terminal?.name || "—"}</div><div style={{ fontSize: 11, color: "#3E0865", fontWeight: 600 }}>{ar ? "صيانة الأجهزة" : "Device maintenance"}</div></div>
      </div>
      <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 8 }}><span className="badge badge-info">{ar ? "جلسة الكاشير" : "Cashier session"}</span><span style={{ fontSize: 12, color: "var(--text-muted)" }}>{ar ? "اقتراح القطع فقط — الصرف من الإدارة" : "Parts are proposed here; issue from management"}</span></div>
    </div>
    <div style={{ padding: 20, overflow: "auto", flex: 1 }}>
    <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 1.2fr) minmax(360px, .8fr)", alignItems: "start", gap: 18 }}>
      {selectedTicket ? <div className="card" style={{ padding: 18 }}><div className="card-header" style={{ padding: 0, marginBottom: 12 }}><h3 className="card-title"><Icon name="receipt" size={17} />تفاصيل طلب الصيانة</h3><span className="badge badge-info">{selectedTicket.ticket_number}</span></div><div className="card" style={{ padding: 12, background: "var(--surface-secondary, #f8fafc)" }}><div className="form-hint">العميل: <b>{selectedTicket.customer_name || "—"}</b></div><div className="form-hint">الجهاز: <b>{selectedTicket.device_name || "—"}</b></div><div className="form-hint">السيريال: <b>{selectedTicket.device_serial || "—"}</b></div><div style={{ marginTop: 10, fontWeight: 700 }}>المشكلة عند الاستلام</div><div style={{ whiteSpace: "pre-wrap", marginTop: 5 }}>{selectedTicket.reported_problem || "—"}</div></div><div className="form-hint" style={{ marginTop: 12 }}>لا تظهر أصناف المخزون هنا. اكتب تقرير الفحص وسجل وصف القطعة التي تم تغييرها وسعر الإصلاح فقط.</div></div> : <div className="card" style={{ padding: 18 }}><div className="card-header" style={{ padding: 0, marginBottom: 12 }}><h3 className="card-title"><Icon name="receipt" size={17} />طلبات نقطة البيع</h3><span className="badge badge-info">{tickets.length}</span></div>{tickets.length === 0 ? <div className="empty-state">لا توجد طلبات صيانة لهذه الجلسة</div> : <div style={{ display: "grid", gap: 10 }}>{tickets.map((ticket: any) => <div key={ticket.id} className="card" style={{ padding: 12, border: "1px solid var(--border)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}><div><b style={{ color: "var(--primary)" }}>{ticket.ticket_number}</b><div style={{ fontWeight: 700, marginTop: 4 }}>{ticket.device_name}</div><div className="form-hint">{ticket.customer_name || "—"} {ticket.device_serial ? ` — ${ticket.device_serial}` : ""}</div></div><span className="badge badge-gray">{ticket.status}</span></div><div style={{ fontSize: 12, color: "#b91c1c", marginTop: 8 }}>{ticket.reported_problem || "—"}</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}><button className="btn btn-primary btn-sm" onClick={() => openTicketInspection(ticket)}>{ticket.diagnosis ? "تعديل الفحص" : "إجراء الفحص"}</button><button className="btn btn-secondary btn-sm" onClick={() => setReceiptTicket(ticket)}>طباعة إيصال الاستلام</button><button className="btn btn-secondary btn-sm" onClick={() => printInspectionReport(ticket)}>طباعة تقرير الفحص</button></div></div>)}</div>}</div>}
      <div className="card" style={{ padding: 18 }}>
        <div className="card-header" style={{ padding: 0, marginBottom: 12 }}><h3 className="card-title">{selectedTicket ? "المرحلة التالية: الفحص والإصلاح" : "المرحلة 1: رفع تذكرة صيانة"}</h3>{selectedTicket ? <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedTicket(null); setCart([]); }}>العودة للطلبات</button> : <span className="badge badge-success">جلسة مشتركة</span>}</div>
        {!selectedTicket ? <>
          <div className="card" style={{ padding: 12, background: "#fffbea", border: "1px solid #f4d35e" }}><b>المرحلة 1 — إنشاء طلب صيانة</b><div className="form-hint">لا يوجد سعر أو تحصيل الآن. السعر يحدد بعد الفحص، ويطبع هنا إيصال استلام غير ضريبي.</div></div>
          <div className="grid-2" style={{ marginTop: 10 }}>{manualCustomer ? <input className="form-input" placeholder="اسم العميل *" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value, customer_id: "" })} /> : <select className="form-input form-select" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}><option value="">اختر العميل</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name_ar} — {customer.customer_number}</option>)}</select>}<input className="form-input" placeholder="رقم الجوال *" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} /></div>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 5 }} onClick={() => { setManualCustomer(!manualCustomer); setForm({ ...form, customer_id: "", customer_name: "" }); }}>{manualCustomer ? "اختيار عميل من النظام" : "العميل غير موجود؟ إدخال عميل يدوي"}</button>
          <input className="form-input" style={{ marginTop: 10 }} placeholder="العنوان *" value={form.customer_address} onChange={e => setForm({ ...form, customer_address: e.target.value })} />
          <div className="grid-2" style={{ marginTop: 10 }}><select className="form-input form-select" value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })}><option value="">اختر نوع الجهاز من الكتالوج *</option>{catalogItems.map(item => <option key={item.id} value={item.id}>{item.name_ar}{item.sku ? ` — ${item.sku}` : ""}</option>)}</select><input className="form-input" placeholder="السيريال نمبر *" value={form.device_serial} onChange={e => setForm({ ...form, device_serial: e.target.value })} /></div>
          <div className="grid-2" style={{ marginTop: 10 }}><select className="form-input form-select" value={form.device_color} onChange={e => setForm({ ...form, device_color: e.target.value })}><option value="">اللون — اختياري</option>{["أسود", "أبيض", "ذهبي", "فضي", "أزرق", "أخضر", "بنفسجي", "أحمر", "وردي", "أخرى"].map(color => <option key={color} value={color}>{color}</option>)}</select><select className="form-input form-select" value={form.device_capacity} onChange={e => setForm({ ...form, device_capacity: e.target.value })}><option value="">السعة — اختياري</option>{["64GB", "128GB", "256GB", "512GB", "1TB"].map(capacity => <option key={capacity} value={capacity}>{capacity}</option>)}</select></div>
          <div className="grid-2" style={{ marginTop: 10 }}><input className="form-input" type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} /><select className="form-input form-select" value={form.lock_type} onChange={e => setForm({ ...form, lock_type: e.target.value })}><option value="none">الجهاز غير محمي</option><option value="password">كلمة سر</option><option value="pattern">نمط</option><option value="screen_pin">رمز شاشة</option></select></div>
          {form.lock_type !== "none" && <input className="form-input" style={{ marginTop: 10 }} placeholder="كلمة سر / نمط الجهاز *" value={form.lock_secret} onChange={e => setForm({ ...form, lock_secret: e.target.value })} />}
          <div className="grid-2" style={{ marginTop: 10 }}><select className="form-input form-select" value={form.problem_type} onChange={e => setForm({ ...form, problem_type: e.target.value })}><option value="">اختر نوع المشكلة *</option><option value="screen">الشاشة</option><option value="charging">الشحن</option><option value="battery">البطارية</option><option value="software">السوفتوير</option><option value="other">أخرى</option></select><input type="file" accept="image/png,image/jpeg" multiple className="form-input" onChange={e => handleAttachments(e.target.files)} /></div>
          <div className="form-hint">الصور اختيارية — يمكنك رفع صور أمامية أو خلفية أو جانبية عند الحاجة (تم اختيار {attachments.length} صور)</div>
          <div className="card" style={{ marginTop: 10, padding: 10 }}><b>الأعراض</b><div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 6, marginTop: 6 }}>{["لا يشتغل نهائياً", "يشتغل ويطفي", "يسخن كثيراً", "لا يشحن", "مشاكل في الصوت", "مشاكل في اللمس", "الشاشة مظلمة", "تطبيقات تتوقف"].map(symptom => <label key={symptom} style={{ fontSize: 12 }}><input type="checkbox" checked={form.symptoms.includes(symptom)} onChange={e => setForm({ ...form, symptoms: e.target.checked ? [...form.symptoms, symptom] : form.symptoms.filter(item => item !== symptom) })} /> {symptom}</label>)}</div></div>
          <textarea className="form-input" rows={4} style={{ marginTop: 10 }} placeholder="وصف تفصيلي للمشكلة *" value={form.reported_problem} onChange={e => setForm({ ...form, reported_problem: e.target.value })} />
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} onClick={save} disabled={saving}>{saving ? "جاري التسجيل..." : "إنشاء طلب وطباعة إيصال الاستلام"}</button>
        </> : <>
          <div className="card" style={{ padding: 12, background: "var(--surface-secondary, #f8fafc)" }}><b>{selectedTicket.ticket_number} — {selectedTicket.device_name}</b><div className="form-hint">العميل: {selectedTicket.customer_name || "—"}</div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}><select className="form-input form-select" style={{ maxWidth: 180 }} value={selectedTicket.status || "open"} onChange={(e) => changeTicketStatus(e.target.value)} disabled={saving}><option value="open">استقبال</option><option value="in_progress">الفحص</option><option value="ready">بانتظار الاعتماد</option><option value="completed">مكتملة</option><option value="cancelled">ملغاة</option></select><span className="form-hint">مدفوع: {money(selectedTicket.paid_amount)} ر.س</span><span className="form-hint">المتبقي: {money(Math.max(0, Math.max(Number(selectedTicket.approved_cost || 0), Number(selectedTicket.parts_total || 0) + Number(selectedTicket.services_total || 0)) - Number(selectedTicket.paid_amount || 0)))} ر.س</span></div></div>
          <textarea className="form-input" rows={4} style={{ marginTop: 12 }} placeholder="تقرير الفحص والمشكلة المكتشفة *" value={inspection.diagnosis} onChange={e => setInspection({ ...inspection, diagnosis: e.target.value })} />
          <input className="form-input" style={{ marginTop: 10 }} placeholder="وصف القطعة التي تم تغييرها أو الإصلاح المنفذ" value={inspection.service_name} onChange={e => setInspection({ ...inspection, service_name: e.target.value })} />
          <input className="form-input" style={{ marginTop: 10 }} type="number" min="0" placeholder="سعر الإصلاح النهائي" value={inspection.service_amount} onChange={e => setInspection({ ...inspection, service_amount: e.target.value })} />
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} onClick={saveInspection} disabled={saving}>حفظ تقرير الفحص والسعر</button>
          <div className="form-hint" style={{ marginTop: 10 }}>بعد الحفظ يمكن للكاشير تسجيل الدفع، وتظهر حالة السداد للإدارة.</div><button className="btn btn-success" style={{ width: "100%", marginTop: 12 }} onClick={collectFromPOS} disabled={saving || !selectedTicket.diagnosis}>تسجيل دفعة وطباعة إيصال الدفع</button>{Number(selectedTicket.paid_amount || 0) > 0 && <><button className="btn btn-secondary" style={{ width: "100%", marginTop: 8 }} onClick={() => { const last = (selectedTicket.payments || []).slice(-1)[0]; printPaymentReceipt(selectedTicket, Number(last?.amount || selectedTicket.paid_amount || 0), Math.max(0, Number(selectedTicket.paid_amount || 0) - Number(last?.amount || selectedTicket.paid_amount || 0))); }}>إعادة طباعة إيصال الدفع</button>{!selectedTicket.invoice_id && <button className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} onClick={issueInvoiceFromPOS} disabled={saving}>إصدار فاتورة الصيانة</button>}</>}
        </>}
      </div>
    </div>
    </div>
    {receiptTicket && <div className="modal-backdrop no-print" style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}><div className="card" style={{ padding: 18, width: 360 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><h3 className="card-title">إيصال استلام الصيانة</h3><button className="btn btn-ghost btn-sm" onClick={() => setReceiptTicket(null)}>×</button></div><MaintenanceIntakeReceipt ticket={receiptTicket} company={company} terminalName={terminal?.name} /><div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="btn btn-primary" style={{ flex: 1 }} onClick={printIntakeReceipt}>طباعة حرارية</button><button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setReceiptTicket(null)}>إغلاق</button></div></div></div>}
    {receiptTicket && <div id="maintenance-intake-print-area" style={{ display: "none" }}><MaintenanceIntakeReceipt ticket={receiptTicket} company={company} terminalName={terminal?.name} /></div>}
    <style jsx global>{`@media print { body * { visibility:hidden!important; } #maintenance-intake-print-area { display:block!important; visibility:visible!important; position:absolute!important; inset:0!important; width:80mm!important; } #maintenance-intake-print-area * { visibility:visible!important; } @page { size:80mm auto; margin:3mm; } }`}</style>
  </div>;
}
