"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getTerminals, updateTerminal } from "@/lib/pos";
import { getWarehouses } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";

export default function MaintenanceWarehousesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const ar = locale === "ar";
  const [terminals, setTerminals] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const [t, w] = await Promise.all([getTerminals(), getWarehouses()]);
      const list = t.data || []; const warehouseList = w.data || [];
      setTerminals(list); setWarehouses(warehouseList);
      setValues(Object.fromEntries(list.map((row: any) => [row.id, row.maintenance_warehouse_id || ""])));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const warehouseName = (id: string | null | undefined) => { const row = warehouses.find((item: any) => item.id === id); return row?.name_ar || row?.name || row?.name_en || id || (ar ? "غير مربوط" : "Not linked"); };
  const save = async (terminalId: string) => { setSaving(terminalId); try { await updateTerminal(terminalId, { maintenance_warehouse_id: values[terminalId] || null }); await load(); alert(ar ? "تم حفظ ربط مستودع الصيانة" : "Maintenance warehouse link saved"); } catch (error: any) { alert(error?.response?.data?.detail || (ar ? "تعذر حفظ الربط" : "Could not save link")); } finally { setSaving(null); } };
  return <div dir={ar ? "rtl" : "ltr"}>
    <div className="page-header"><div><div className="breadcrumb"><Link href={`/${locale}/maintenance`}>{ar ? "إدارة الصيانة" : "Maintenance"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "المستودعات" : "Warehouses"}</span></div><h1 className="page-title">{ar ? "مستودعات الصيانة" : "Maintenance Warehouses"}</h1><p className="page-subtitle">{ar ? "اربط مستودع قطع مستقلًا بكل جهاز كاشير" : "Link an isolated parts warehouse to each POS terminal"}</p></div><Link href={`/${locale}/inventory/warehouses`} className="btn btn-secondary"><Icon name="inventory" size={15} />{ar ? "إدارة المستودعات" : "Manage warehouses"}</Link></div>
    <div className="card" style={{ marginBottom: 18, padding: 16, background: "var(--surface-secondary, #f8fafc)" }}><div style={{ display: "flex", gap: 12, alignItems: "start" }}><Icon name="settings" size={20} /><div><strong>{ar ? "طريقة الربط" : "How the link works"}</strong><p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: 13 }}>{ar ? "القطع التي تظهر في شاشة الصيانة تُجلب من المستودع المختار هنا، ولا تختلط بمستودع المبيعات." : "Parts shown in the maintenance counter come from the warehouse selected here and stay separate from sales stock."}</p></div></div></div>
    {loading ? <div className="empty-state">{ar ? "جاري التحميل..." : "Loading..."}</div> : terminals.length === 0 ? <div className="empty-state">{ar ? "لا توجد أجهزة كاشير" : "No terminals"}</div> : <div className="grid-2">{terminals.map((row: any) => <div className="card" key={row.id} style={{ padding: 20 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, marginBottom: 18 }}><div><div style={{ fontSize: 17, fontWeight: 800 }}>{row.name}</div><div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 5 }}>{ar ? "جهاز كاشير" : "POS terminal"}</div></div><span className={values[row.id] ? "badge badge-success" : "badge badge-gray"}>{values[row.id] ? (ar ? "مربوط" : "Linked") : (ar ? "غير مربوط" : "Not linked")}</span></div><div style={{ padding: 12, borderRadius: 8, background: "var(--surface-secondary, #f8fafc)", marginBottom: 14 }}><div style={{ color: "var(--text-muted)", fontSize: 11 }}>{ar ? "مستودع البيع" : "Sales warehouse"}</div><div style={{ marginTop: 4, fontWeight: 600 }}>{warehouseName(row.warehouse_id)}</div></div><label className="form-group"><span className="form-label">{ar ? "مستودع الصيانة" : "Maintenance warehouse"}</span><select className="form-input form-select" value={values[row.id] || ""} onChange={(e) => setValues({ ...values, [row.id]: e.target.value })}><option value="">{ar ? "بدون مستودع صيانة" : "No maintenance warehouse"}</option>{warehouses.map((warehouse: any) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name_ar || warehouse.name || warehouse.name_en || warehouse.id}</option>)}</select></label><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}><span style={{ color: "var(--text-muted)", fontSize: 12 }}>{values[row.id] ? warehouseName(values[row.id]) : (ar ? "اختر مستودعًا" : "Choose a warehouse")}</span><button className="btn btn-primary" onClick={() => save(row.id)} disabled={saving === row.id}>{saving === row.id ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ الربط" : "Save link")}</button></div></div>)}</div>}
  </div>;
}
