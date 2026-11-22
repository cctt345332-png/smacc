"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getTerminals, getMaintenanceTickets, createMaintenanceTicket, addMaintenancePart, issueMaintenancePart, recordMaintenancePayment, getTerminalMaintenanceSerials, updateMaintenanceTicket, addMaintenanceService, issueMaintenanceInvoice } from "@/lib/pos";
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
        getMaintenanceTickets({ terminal_id: terminalId || undefined, session_id: sessionId || undefined }),
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
      setReceiptTicket(r.data); setSelectedTicket(r.data); setCart([]); setAttachments([]); setManualCustomer(false); setForm({ customer_id: "", customer_name: "", customer_phone: "", customer_address: "", product_id: "", device_color: "", device_capacity: "", device_serial: "", purchase_date: "", lock_type: "none", lock_secret: "", problem_type: "", symptoms: [], reported_problem: "", approved_cost: "", paid_amount: "" });
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

  const saveInspection = async () => {
    if (!selectedTicket) return;
    if (!inspection.diagnosis.trim()) return alert("اكتب تقرير الفحص والمشكلة المكتشفة أولاً");
    if (inspection.service_name.trim() && Number(inspection.service_amount) <= 0) return alert("أدخل سعر الخدمة بشكل صحيح");
    setSaving(true);
    try {
      await updateMaintenanceTicket(selectedTicket.id, { diagnosis: inspection.diagnosis, status: "ready" });
      for (const line of cart) await addMaintenancePart(selectedTicket.id, { product_id: line.product_id, quantity: line.quantity, unit_price: line.unit_price, serial_item_id: line.serial_item_id });
      if (inspection.service_name.trim()) await addMaintenanceService(selectedTicket.id, { service_name: inspection.service_name.trim(), amount: Number(inspection.service_amount) });
      const refreshed = (await getMaintenanceTickets({ terminal_id: terminalId, session_id: sessionId })).data.find((x: any) => x.id === selectedTicket.id);
      setSelectedTicket(refreshed || selectedTicket); setCart([]); setInspection({ ...inspection, service_name: "", service_amount: "" });
      alert("تم حفظ تقرير الفحص والتكلفة والقطع المقترحة. راجعها ثم اعتمد الإصلاح."); await load();
    } catch (e: any) { alert(e?.response?.data?.detail || "تعذر حفظ تقرير الفحص"); } finally { setSaving(false); }
  };

  const approveRepair = async () => {
    if (!selectedTicket) return;
    if (!selectedTicket.diagnosis) return alert("احفظ تقرير الفحص أولاً");
    setSaving(true);
    try {
      const current = (await getMaintenanceTickets({ terminal_id: terminalId, session_id: sessionId })).data.find((x: any) => x.id === selectedTicket.id);
      for (const part of (current?.parts || [])) if (part.status !== "issued") await issueMaintenancePart(selectedTicket.id, part.id);
      const refreshed = (await getMaintenanceTickets({ terminal_id: terminalId, session_id: sessionId })).data.find((x: any) => x.id === selectedTicket.id);
      setSelectedTicket(refreshed || current); await load(); alert("تم اعتماد الإصلاح وصرف القطع المغيّرة من مستودع الصيانة.");
    } catch (e: any) { alert(e?.response?.data?.detail || "تعذر اعتماد الإصلاح وصرف القطع"); } finally { setSaving(false); }
  };

  const issueInvoiceForTicket = async () => {
    if (!selectedTicket) return;
    if (!selectedTicket.customer_id) return alert("اربط التذكرة بعميل قبل إصدار الفاتورة من الإدارة");
    try { const result = await issueMaintenanceInvoice(selectedTicket.id); alert(`تم إصدار الفاتورة ${result.data?.invoice_number || ""}`); await load(); } catch (e: any) { alert(e?.response?.data?.detail || "تعذر إصدار الفاتورة"); }
  };

  return <div dir={ar ? "rtl" : "ltr"} style={{ padding: 20 }}>
    <div className="page-header">
      <div><div className="breadcrumb"><Link href={`/${locale}/pos/cashier?terminal=${terminalId}&session_id=${sessionId}`}>{ar ? "الكاشير" : "Cashier"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "الصيانة" : "Maintenance"}</span></div><h1 className="page-title">{ar ? "تشغيل الصيانة" : "Maintenance Counter"}</h1><p className="page-subtitle">{terminal?.name || "—"} — {ar ? "نفس جلسة الكاشير، وأصناف مستودع الصيانة فقط" : "Same cashier session, maintenance warehouse stock only"}</p></div>
      <Link href={`/${locale}/pos/cashier?terminal=${terminalId}&session_id=${sessionId}`} className="btn btn-secondary"><Icon name="arrowRight" size={15} />{ar ? "العودة للكاشير" : "Back to cashier"}</Link>
    </div>
    <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 1.2fr) minmax(360px, .8fr)", alignItems: "start", gap: 18 }}>
      <div className="card" style={{ padding: 18 }}>
        <div className="card-header" style={{ padding: 0, marginBottom: 12 }}><h3 className="card-title"><Icon name="settings" size={17} />{ar ? "قطع مستودع الصيانة" : "Maintenance warehouse parts"}</h3><span className="badge badge-info">{items.length} صنف</span></div>
        {!terminal?.maintenance_warehouse_id ? <div className="empty-state">اربط مستودع الصيانة بالجهاز أولًا</div> : loading ? <div className="empty-state">جاري تحميل المخزون...</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 10 }}>{items.map(item => <button key={item.id} onClick={() => addProduct(item)} className="card" style={{ padding: 12, textAlign: "right", cursor: "pointer", background: "#fff", border: "1px solid var(--border)" }}><div style={{ fontWeight: 700 }}>{item.name_ar}</div><div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>المتاح: {money(item.quantity_on_hand)}</div><div style={{ color: "var(--primary)", fontWeight: 700, marginTop: 5 }}>{money(item.sale_price)} ر.س</div></button>)}</div>}
      </div>
      <div className="card" style={{ padding: 18 }}>
        <div className="card-header" style={{ padding: 0, marginBottom: 12 }}><h3 className="card-title">{selectedTicket ? "المرحلة التالية: الفحص والإصلاح" : "المرحلة 1: رفع تذكرة صيانة"}</h3><span className="badge badge-success">جلسة مشتركة</span></div>
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
          <div className="card" style={{ padding: 12, background: "var(--surface-secondary, #f8fafc)" }}><b>{selectedTicket.ticket_number} — {selectedTicket.device_name}</b><div className="form-hint">العميل: {selectedTicket.customer_name || "—"} | الحالة: {selectedTicket.status}</div></div>
          <textarea className="form-input" rows={4} style={{ marginTop: 12 }} placeholder="المرحلة 2: تقرير الفحص والتشخيص *" value={inspection.diagnosis} onChange={e => setInspection({ ...inspection, diagnosis: e.target.value })} />
          <div className="grid-2" style={{ marginTop: 10 }}><input className="form-input" placeholder="اسم الخدمة / الإصلاح" value={inspection.service_name} onChange={e => setInspection({ ...inspection, service_name: e.target.value })} /><input className="form-input" type="number" min="0" placeholder="سعر الخدمة بعد الفحص" value={inspection.service_amount} onChange={e => setInspection({ ...inspection, service_amount: e.target.value })} /></div>
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}><strong>المرحلة 3: القطع المغيّرة إن وجدت</strong>{cart.length === 0 ? <div className="empty-state" style={{ padding: 16 }}>اختر القطع من القائمة لتضاف كتخطيط، ولن تُصرف قبل الاعتماد.</div> : cart.map((line, i) => <div key={`${line.product_id}-${line.serial_item_id || i}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}><span>{line.name_ar} {line.serial_number ? `— ${line.serial_number}` : `× ${line.quantity}`}</span><b>{money(line.quantity * line.unit_price)} ر.س</b></div>)}</div>
          <button className="btn btn-secondary" style={{ width: "100%", marginTop: 14 }} onClick={saveInspection} disabled={saving}>حفظ تقرير الفحص والقطع والسعر</button>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 8 }} onClick={approveRepair} disabled={saving || !selectedTicket.diagnosis}>اعتماد الإصلاح وصرف القطع</button>
          <button className="btn btn-success" style={{ width: "100%", marginTop: 8 }} onClick={issueInvoiceForTicket} disabled={saving || !selectedTicket.diagnosis}>إصدار الفاتورة بعد الاعتماد</button>
        </>}
      </div>
    </div>
    {receiptTicket && <div className="modal-backdrop no-print" style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}><div className="card" style={{ padding: 18, width: 360 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><h3 className="card-title">إيصال استلام الصيانة</h3><button className="btn btn-ghost btn-sm" onClick={() => setReceiptTicket(null)}>×</button></div><MaintenanceIntakeReceipt ticket={receiptTicket} company={company} terminalName={terminal?.name} /><div style={{ display: "flex", gap: 8, marginTop: 12 }}><button className="btn btn-primary" style={{ flex: 1 }} onClick={printIntakeReceipt}>طباعة حرارية</button><button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setReceiptTicket(null)}>إغلاق</button></div></div></div>}
    {receiptTicket && <div id="maintenance-intake-print-area" style={{ display: "none" }}><MaintenanceIntakeReceipt ticket={receiptTicket} company={company} terminalName={terminal?.name} /></div>}
    {selectedProduct && <div className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}><div className="card" style={{ padding: 20, width: 420 }}><h3 className="card-title">اختر السيريال — {selectedProduct.name_ar}</h3>{serials.length ? serials.map(s => <button key={s.id} className="btn btn-secondary" style={{ width: "100%", marginTop: 8, justifyContent: "space-between" }} onClick={() => addLine(s)}><span>{s.serial_number}</span><span>{money(s.cost_price)} ر.س</span></button>) : <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => addLine()}>إضافة الصنف</button>}<button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={() => { setSelectedProduct(null); setSerials([]); }}>إلغاء</button></div></div>}
    <style jsx global>{`@media print { body * { visibility:hidden!important; } #maintenance-intake-print-area { display:block!important; visibility:visible!important; position:absolute!important; inset:0!important; width:80mm!important; } #maintenance-intake-print-area * { visibility:visible!important; } @page { size:80mm auto; margin:3mm; } }`}</style>
  </div>;
}
