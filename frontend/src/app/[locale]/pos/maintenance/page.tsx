"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getTerminals, getMaintenanceTickets, createMaintenanceTicket, addMaintenancePart, issueMaintenancePart, getTerminalMaintenanceSerials } from "@/lib/pos";
import { getItemsForPicker } from "@/lib/inventory";
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
  const [tickets, setTickets] = useState<any[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [serials, setSerials] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", device_name: "", device_serial: "", reported_problem: "", approved_cost: "", paid_amount: "" });

  const load = async () => {
    try {
      const [tr, tk] = await Promise.all([getTerminals(), getMaintenanceTickets({ terminal_id: terminalId || undefined, session_id: sessionId || undefined })]);
      const found = (tr.data || []).find((x: any) => x.id === terminalId);
      setTerminal(found || null);
      setTickets(tk.data || []);
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
    if (!form.device_name.trim() || !form.reported_problem.trim()) return alert("اكتب اسم الجهاز ووصف العطل");
    const paid = Number(form.paid_amount || 0);
    if (paid > totalDue) return alert("المبلغ المحصل أكبر من إجمالي العملية");
    setSaving(true);
    try {
      const r = await createMaintenanceTicket({ terminal_id: terminalId, session_id: sessionId, ...form, approved_cost: totalDue, paid_amount: paid });
      let ticket = r.data;
      for (const line of cart) {
        const added = await addMaintenancePart(ticket.id, { product_id: line.product_id, quantity: line.quantity, unit_price: line.unit_price, serial_item_id: line.serial_item_id });
        const part = (added.data?.parts || []).find((p: any) => p.product_id === line.product_id && p.serial_item_id === line.serial_item_id && p.status !== "issued");
        if (part) await issueMaintenancePart(ticket.id, part.id);
      }
      alert("تم حفظ عملية الصيانة وصرف القطع من مستودع الصيانة");
      setCart([]); setForm({ customer_name: "", customer_phone: "", device_name: "", device_serial: "", reported_problem: "", approved_cost: "", paid_amount: "" });
      await load();
    } catch (e: any) { alert(e?.response?.data?.detail || "تعذر حفظ عملية الصيانة"); }
    finally { setSaving(false); }
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
        <div className="card-header" style={{ padding: 0, marginBottom: 12 }}><h3 className="card-title">عملية صيانة جديدة</h3><span className="badge badge-success">جلسة مشتركة</span></div>
        <div className="grid-2"><input className="form-input" placeholder="اسم العميل" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /><input className="form-input" placeholder="الجوال" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} /></div>
        <div className="grid-2" style={{ marginTop: 10 }}><input className="form-input" placeholder="اسم الجهاز *" value={form.device_name} onChange={e => setForm({ ...form, device_name: e.target.value })} /><input className="form-input" placeholder="السيريال / IMEI" value={form.device_serial} onChange={e => setForm({ ...form, device_serial: e.target.value })} /></div>
        <textarea className="form-input" rows={3} style={{ marginTop: 10 }} placeholder="وصف العطل *" value={form.reported_problem} onChange={e => setForm({ ...form, reported_problem: e.target.value })} />
        <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}><strong>سلة القطع</strong>{cart.length === 0 ? <div className="empty-state" style={{ padding: 16 }}>اضغط على قطعة لإضافتها</div> : cart.map((line, i) => <div key={`${line.product_id}-${line.serial_item_id || i}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}><span>{line.name_ar} {line.serial_number ? `— ${line.serial_number}` : `× ${line.quantity}`}</span><b>{money(line.quantity * line.unit_price)} ر.س</b></div>)}</div>
        <div className="grid-2" style={{ marginTop: 12 }}><input className="form-input" type="number" placeholder="أجرة الصيانة" value={form.approved_cost} onChange={e => setForm({ ...form, approved_cost: e.target.value })} /><input className="form-input" type="number" placeholder="المبلغ المحصل" value={form.paid_amount} onChange={e => setForm({ ...form, paid_amount: e.target.value })} /></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontWeight: 700 }}><span>إجمالي العملية</span><span style={{ color: "var(--primary)" }}>{money(totalDue)} ر.س</span></div>
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} onClick={save} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ عملية الصيانة"}</button>
      </div>
    </div>
    {selectedProduct && <div className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center" }}><div className="card" style={{ padding: 20, width: 420 }}><h3 className="card-title">اختر السيريال — {selectedProduct.name_ar}</h3>{serials.length ? serials.map(s => <button key={s.id} className="btn btn-secondary" style={{ width: "100%", marginTop: 8, justifyContent: "space-between" }} onClick={() => addLine(s)}><span>{s.serial_number}</span><span>{money(s.cost_price)} ر.س</span></button>) : <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => addLine()}>إضافة الصنف</button>}<button className="btn btn-ghost" style={{ width: "100%", marginTop: 10 }} onClick={() => { setSelectedProduct(null); setSerials([]); }}>إلغاء</button></div></div>}
  </div>;
}
