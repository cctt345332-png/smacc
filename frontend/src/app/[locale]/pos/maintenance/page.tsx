"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getTerminals, getMaintenanceTickets, createMaintenanceTicket, addMaintenancePart, issueMaintenancePart, getMaintenanceSerials } from "@/lib/pos";
import { getItemsForPicker } from "@/lib/inventory";
import api from "@/lib/api";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const statusLabel: Record<string, string> = { open: "مفتوحة", inspecting: "قيد الفحص", waiting_part: "بانتظار قطعة", ready: "جاهزة", delivered: "تم التسليم", closed: "مغلقة", cancelled: "ملغاة" };

export default function POSMaintenancePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [terminals, setTerminals] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [serials, setSerials] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ terminal_id: "", assigned_to: "", customer_name: "", customer_phone: "", device_name: "", device_serial: "", reported_problem: "", estimated_cost: "" });
  const [part, setPart] = useState<any>({ product_id: "", serial_item_id: "", quantity: "1", unit_price: "" });

  const load = async () => {
    try {
      const [t, r] = await Promise.all([getTerminals(), getMaintenanceTickets()]);
      setTerminals(t.data || []); setTickets(r.data || []);
      if (selected) setSelected((r.data || []).find((x: any) => x.id === selected.id) || null);
    } catch { setTickets([]); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    getItemsForPicker({ search: "" })
      .then((r) => setItems(r.data || r.data?.items || []))
      .catch(() => {});
    api.get("/auth/users")
      .then((r) => {
        const users = r.data || [];
        setMechanics(users.filter((u: any) =>
          u.is_active !== false && ["technician", "maintenance", "manager", "admin"].includes(u.role)
        ));
      })
      .catch(() => {});
  }, []);

  const saveTicket = async () => {
    if (!form.terminal_id || !form.device_name.trim() || !form.reported_problem.trim()) return alert("اختر الجهاز واكتب اسم الجهاز ووصف العطل");
    setSaving(true);
    try { const r = await createMaintenanceTicket({ ...form, estimated_cost: Number(form.estimated_cost || 0) }); setSelected(r.data); setForm({ terminal_id: form.terminal_id, assigned_to: form.assigned_to, customer_name: "", customer_phone: "", device_name: "", device_serial: "", reported_problem: "", estimated_cost: "" }); await load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "تعذر حفظ تذكرة الصيانة"); }
    finally { setSaving(false); }
  };
  const savePart = async () => {
    if (!selected || !part.product_id) return alert("اختر قطعة");
    try { const r = await addMaintenancePart(selected.id, { ...part, quantity: Number(part.quantity || 1), unit_price: part.unit_price === "" ? undefined : Number(part.unit_price) }); setSelected(r.data); setPart({ product_id: "", serial_item_id: "", quantity: "1", unit_price: "" }); setSerials([]); await load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "تعذر إضافة القطعة"); }
  };
  const issuePart = async (p: any) => {
    if (!selected) return;
    if (!confirm("سيتم صرف القطعة من مستودع الصيانة فقط. هل تريد المتابعة؟")) return;
    try { const r = await issueMaintenancePart(selected.id, p.id); setSelected(r.data); await load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "تعذر صرف القطعة"); }
  };

  return <>
    <div className="page-header">
      <div><div className="breadcrumb"><Link href={`/${locale}/pos`}>{ar ? "نقطة البيع" : "POS"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "الصيانة" : "Maintenance"}</span></div><h1 className="page-title">{ar ? "صيانة نقاط البيع" : "POS Maintenance"}</h1><p className="page-subtitle">{ar ? "تذاكر وقطع صيانة منفصلة عن فواتير المبيعات" : "Tickets and parts isolated from sales invoices"}</p></div>
      <Link href={`/${locale}/pos/terminals`} className="btn btn-secondary"><Icon name="terminal" size={15} />{ar ? "إعداد الأجهزة" : "Terminals"}</Link>
    </div>
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div className="card" style={{ padding: 20 }}>
        <div className="card-header" style={{ padding: 0, marginBottom: 16 }}><h3 className="card-title">{ar ? "تذكرة صيانة جديدة" : "New Maintenance Ticket"}</h3></div>
        <div className="form-group"><label className="form-label">الجهاز المرتبط <span className="required">*</span></label><select className="form-input form-select" value={form.terminal_id} onChange={e => setForm({ ...form, terminal_id: e.target.value })}><option value="">— اختر جهاز الكاشير —</option>{terminals.map(t => <option key={t.id} value={t.id}>{t.name}{t.maintenance_warehouse_id ? " — مستودع صيانة مربوط" : " — بدون مستودع صيانة"}</option>)}</select></div>
        <div className="form-group"><label className="form-label">فني الصيانة</label><select className="form-input form-select" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}><option value="">— اختر الفني —</option>{mechanics.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></div>
        <div className="grid-2"><div className="form-group"><label className="form-label">اسم العميل</label><input className="form-input" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div><div className="form-group"><label className="form-label">الجوال</label><input className="form-input" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} /></div></div>
        <div className="grid-2"><div className="form-group"><label className="form-label">اسم الجهاز <span className="required">*</span></label><input className="form-input" value={form.device_name} onChange={e => setForm({ ...form, device_name: e.target.value })} /></div><div className="form-group"><label className="form-label">السيريال / IMEI</label><input className="form-input" value={form.device_serial} onChange={e => setForm({ ...form, device_serial: e.target.value })} /></div></div>
        <div className="form-group"><label className="form-label">وصف العطل <span className="required">*</span></label><textarea className="form-input" rows={3} value={form.reported_problem} onChange={e => setForm({ ...form, reported_problem: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">التكلفة التقديرية</label><input className="form-input" type="number" min="0" value={form.estimated_cost} onChange={e => setForm({ ...form, estimated_cost: e.target.value })} /></div>
        <button className="btn btn-primary" onClick={saveTicket} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ التذكرة"}</button>
      </div>
      <div className="card" style={{ padding: 20 }}>
        <div className="card-header" style={{ padding: 0, marginBottom: 12 }}><h3 className="card-title">التذاكر المسجلة</h3><span className="badge badge-gray">{tickets.length}</span></div>
        {loading ? <div className="empty-state">جاري التحميل...</div> : tickets.length === 0 ? <div className="empty-state">لا توجد تذاكر صيانة</div> : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{tickets.map(t => <button key={t.id} onClick={() => setSelected(t)} style={{ textAlign: "right", border: selected?.id === t.id ? "2px solid var(--primary)" : "1px solid var(--border)", borderRadius: 10, padding: 12, background: "white", cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>{t.ticket_number} — {t.device_name}</span><span className="badge badge-info">{statusLabel[t.status] || t.status}</span></div><div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 5 }}>{t.customer_name || "بدون اسم عميل"} · {new Date(t.created_at).toLocaleDateString("en-GB")}</div></button>)}</div>}
      </div>
    </div>
    {selected && <div className="card" style={{ padding: 20, marginTop: 20 }}><div className="card-header" style={{ padding: 0, marginBottom: 14 }}><div><h3 className="card-title">{selected.ticket_number} — {selected.device_name}</h3><p className="page-subtitle">{selected.reported_problem}</p></div><span className="badge badge-info">{statusLabel[selected.status] || selected.status}</span></div><div className="grid-4" style={{ marginBottom: 16 }}><div className="stat-card"><div className="stat-value">{fmt(selected.parts_total)}</div><div className="stat-label">إجمالي قطع الصيانة</div></div><div className="stat-card"><div className="stat-value">{fmt(selected.estimated_cost)}</div><div className="stat-label">التكلفة التقديرية</div></div><div className="stat-card"><div className="stat-value">{selected.maintenance_warehouse_id ? "مربوط" : "غير مربوط"}</div><div className="stat-label">مستودع الصيانة</div></div><div className="stat-card"><div className="stat-value">{selected.parts?.length || 0}</div><div className="stat-label">عدد القطع</div></div></div><div className="grid-2" style={{ alignItems: "end" }}><div className="form-group"><label className="form-label">إضافة قطعة</label><select className="form-input form-select" value={part.product_id} onChange={async e => { const item = items.find(x => x.id === e.target.value); setPart({ ...part, product_id: e.target.value, serial_item_id: "", unit_price: item?.sale_price ?? "" }); setSerials([]); if (selected && item?.tracking_type === "serial") { try { const r = await getMaintenanceSerials(selected.id, item.id); setSerials(r.data || []); } catch { setSerials([]); } } }}><option value="">— اختر الصنف —</option>{items.map(i => <option key={i.id} value={i.id}>{i.name_ar}{i.sku ? ` — ${i.sku}` : ""}</option>)}</select></div><div className="form-group"><label className="form-label">السيريال</label><select className="form-input form-select" value={part.serial_item_id} disabled={!serials.length} onChange={e => setPart({ ...part, serial_item_id: e.target.value, quantity: "1" })}><option value="">{serials.length ? "— اختر السيريال —" : "غير مطلوب للصنف الكمي"}</option>{serials.map(s => <option key={s.id} value={s.id}>{s.serial_number}</option>)}</select></div><div className="form-group"><label className="form-label">الكمية</label><input className="form-input" type="number" min="1" disabled={serials.length > 0} value={part.quantity} onChange={e => setPart({ ...part, quantity: e.target.value })} /></div><div className="form-group"><label className="form-label">سعر القطعة</label><input className="form-input" type="number" min="0" value={part.unit_price} onChange={e => setPart({ ...part, unit_price: e.target.value })} /></div><button className="btn btn-primary" onClick={savePart}>إضافة القطعة</button></div>{selected.parts?.length > 0 && <div className="table-wrapper" style={{ marginTop: 16 }}><table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>{selected.parts.map((p: any) => <tr key={p.id}><td>{p.product_name}</td><td>{p.quantity}</td><td>{fmt(p.unit_price)}</td><td>{p.status === "issued" ? <span className="badge badge-success">مصروفة</span> : <span className="badge badge-gray">مخططة</span>}</td><td>{p.status !== "issued" && <button className="btn btn-secondary btn-sm" onClick={() => issuePart(p)}>صرف من مستودع الصيانة</button>}</td></tr>)}</tbody></table></div>}</div>}
  </>;
}
