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
      const list = t.data || [];
      setTerminals(list); setWarehouses(w.data || []);
      setValues(Object.fromEntries(list.map((row: any) => [row.id, row.maintenance_warehouse_id || ""])));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const save = async (terminalId: string) => { setSaving(terminalId); try { await updateTerminal(terminalId, { maintenance_warehouse_id: values[terminalId] || null }); await load(); alert(ar ? "تم حفظ ربط مستودع الصيانة" : "Maintenance warehouse link saved"); } catch (error: any) { alert(error?.response?.data?.detail || (ar ? "تعذر حفظ الربط" : "Could not save link")); } finally { setSaving(null); } };
  return <div dir={ar ? "rtl" : "ltr"}><div className="page-header"><div><div className="breadcrumb"><Link href={`/${locale}/maintenance`}>{ar ? "إدارة الصيانة" : "Maintenance"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "مستودعات الصيانة" : "Maintenance Warehouses"}</span></div><h1 className="page-title">{ar ? "ربط مستودعات الصيانة" : "Maintenance Warehouse Links"}</h1><p className="page-subtitle">{ar ? "كل جهاز كاشير يمكن أن يستخدم مستودع صيانة مستقلًا لصرف قطع الغيار" : "Each POS terminal can use an isolated warehouse for maintenance parts"}</p></div><Link href={`/${locale}/inventory/warehouses`} className="btn btn-secondary"><Icon name="inventory" size={15} />{ar ? "إدارة المستودعات" : "Manage warehouses"}</Link></div><div className="card"><div className="card-header"><h3 className="card-title"><Icon name="pos" size={16} />{ar ? "أجهزة الكاشير وربط الصيانة" : "POS terminals and maintenance links"}</h3></div>{loading ? <div className="empty-state">{ar ? "جاري التحميل..." : "Loading..."}</div> : terminals.length === 0 ? <div className="empty-state">{ar ? "لا توجد أجهزة كاشير" : "No terminals"}</div> : <div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "الجهاز" : "Terminal"}</th><th>{ar ? "مستودع البيع" : "Sales warehouse"}</th><th>{ar ? "مستودع الصيانة" : "Maintenance warehouse"}</th><th>{ar ? "الإجراء" : "Action"}</th></tr></thead><tbody>{terminals.map((row: any) => <tr key={row.id}><td style={{ fontWeight: 700 }}>{row.name}</td><td>{row.warehouse_name || row.warehouse_id || "—"}</td><td><select className="form-input form-select" value={values[row.id] || ""} onChange={(e) => setValues({ ...values, [row.id]: e.target.value })}><option value="">{ar ? "بدون مستودع صيانة" : "No maintenance warehouse"}</option>{warehouses.map((warehouse: any) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></td><td><button className="btn btn-primary btn-sm" onClick={() => save(row.id)} disabled={saving === row.id}>{saving === row.id ? (ar ? "جاري الحفظ" : "Saving") : (ar ? "حفظ الربط" : "Save link")}</button></td></tr>)}</tbody></table></div>}</div></div>;
}
