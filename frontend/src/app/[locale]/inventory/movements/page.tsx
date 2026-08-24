"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getMovements, getWarehouses, getItems } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const TYPE_BADGE: Record<string, string> = {
  purchase: "badge-success", sale: "badge-info", return_in: "badge-warning",
  return_out: "badge-warning", adjustment: "badge-gray", transfer: "badge-info",
  damage: "badge-danger", initial: "badge-gray",
};
const TYPE_COLOR: Record<string, string> = {
  purchase: "#059669", sale: "#2563EB", return_in: "#D97706",
  return_out: "#D97706", adjustment: "#6366F1", transfer: "#7C3AED",
  damage: "#DC2626", initial: "#94A3B8",
};

export default function MovementsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [movements, setMovements] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 500 };
      if (filterType) params.movement_type = filterType;
      if (filterWarehouse) params.warehouse_id = filterWarehouse;
      if (filterItem) params.item_id = filterItem;
      const { data } = await getMovements(params);
      // فلتر الشهر على الفرونت
      if (filterMonth) {
        const filtered = data.filter((m: any) => m.created_at.startsWith(filterMonth));
        setMovements(filtered);
      } else {
        setMovements(data);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    Promise.all([getWarehouses(), getItems()])
      .then(([w, i]) => { setWarehouses(w.data); setItems(i.data); })
      .catch(() => {});
    load();
  }, []);

  useEffect(() => { load(); }, [filterType, filterWarehouse, filterItem, filterMonth]);

  const TYPES = [
    { value: "purchase", ar: "شراء" }, { value: "sale", ar: "بيع" },
    { value: "transfer", ar: "تحويل" }, { value: "adjustment", ar: "جرد/تسوية" },
    { value: "return_in", ar: "مرتجع وارد" }, { value: "return_out", ar: "مرتجع صادر" },
    { value: "damage", ar: "تلف" }, { value: "initial", ar: "رصيد افتتاحي" },
  ];

  const totalIn = movements.filter(m => Number(m.quantity) > 0).reduce((s, m) => s + m.total_value, 0);
  const totalOut = movements.filter(m => Number(m.quantity) < 0).reduce((s, m) => s + m.total_value, 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/inventory`}>{ar ? "المخزون" : "Inventory"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "حركات المخزون" : "Stock Movements"}</span>
          </div>
          <h1 className="page-title">{ar ? "حركات المخزون" : "Stock Movements"}</h1>
          <p className="page-subtitle">{ar ? "سجل كامل لجميع حركات المخزون — يشمل السيريالات" : "Complete log of all stock movements — including serials"}</p>
        </div>
        <StructuredReportPrintButton locale={locale} title={ar ? "سجل حركات المخزون" : "Inventory Movement Register"} subtitle={ar ? "سجل الحركات حسب الفلاتر المحددة" : "Movement register for selected filters"} period={filterMonth || (ar ? "كافة الفترات" : "All periods")} orientation="landscape" reportCode={`IM-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`} metrics={[{ label: ar ? "إجمالي الحركات" : "Total movements", value: String(movements.length), tone: "neutral" }, { label: ar ? "قيمة الوارد" : "Inbound value", value: `${fmt(totalIn)} SAR`, tone: "green" }, { label: ar ? "قيمة الصادر" : "Outbound value", value: `${fmt(totalOut)} SAR`, tone: "red" }]} tables={[{ headers: [ar ? "التاريخ" : "Date", ar ? "الصنف" : "Item", ar ? "السيريال" : "Serial", ar ? "نوع الحركة" : "Type", ar ? "الكمية" : "Qty", ar ? "سعر الوحدة" : "Unit cost", ar ? "القيمة" : "Value", ar ? "المرجع" : "Reference"], rows: movements.map((m: any) => [new Date(m.created_at).toLocaleString("en-SA"), String(m.item_name || "—"), String(m.serial_number || "—"), String((TYPES.find(t => t.value === m.movement_type)?.ar) || m.movement_type || "—"), Number(m.quantity || 0).toLocaleString("en-US"), fmt(m.unit_cost), fmt(m.total_value), String(m.reference_number || m.reference_id || "—")]) }]} />
      </div>

      {/* إحصائيات */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          { label: ar ? "إجمالي الحركات" : "Total Movements", value: movements.length, color: "#2563EB" },
          { label: ar ? "قيمة الوارد" : "Total In Value", value: `${fmt(totalIn)} SAR`, color: "#059669" },
          { label: ar ? "قيمة الصادر" : "Total Out Value", value: `${fmt(totalOut)} SAR`, color: "#DC2626" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* فلاتر */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select className="form-input form-select" style={{ width: 180 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">{ar ? "كل الأنواع" : "All Types"}</option>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.ar}</option>)}
          </select>
          <select className="form-input form-select" style={{ width: 180 }} value={filterWarehouse} onChange={e => setFilterWarehouse(e.target.value)}>
            <option value="">{ar ? "كل المستودعات" : "All Warehouses"}</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
          </select>
          <select className="form-input form-select" style={{ width: 200 }} value={filterItem} onChange={e => setFilterItem(e.target.value)}>
            <option value="">{ar ? "كل الأصناف" : "All Items"}</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name_ar}</option>)}
          </select>
          {/* فلتر الشهر */}
          <input type="month" className="form-input" style={{ width: 160 }}
            value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            title={ar ? "فلتر بالشهر" : "Filter by month"} />
          {filterMonth && (
            <button className="btn btn-ghost btn-sm" onClick={() => setFilterMonth("")} style={{ color: "var(--danger)" }}>✕</button>
          )}
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {movements.length} {ar ? "حركة" : "movements"}
          </span>
        </div>
      </div>

      {/* الجدول */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : movements.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{ar ? "لا توجد حركات" : "No movements found"}</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                {ar ? "ستظهر الحركات عند إضافة مخزون أو بيع أو تحويل" : "Movements appear when you add stock, sell, or transfer"}
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "الصنف" : "Item"}</th>
                  <th>{ar ? "السيريال" : "Serial"}</th>
                  <th>{ar ? "نوع الحركة" : "Type"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "سعر الوحدة" : "Unit Cost"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "القيمة" : "Value"}</th>
                  <th>{ar ? "ملاحظات" : "Notes"}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m: any) => {
                  const isIn = Number(m.quantity) > 0;
                  return (
                    <tr key={m.id}>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {new Date(m.created_at).toLocaleDateString("en-SA")}
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {new Date(m.created_at).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td>
                        <Link href={`/${locale}/inventory/items/${m.item_id}`}
                          style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "none", fontSize: 13 }}>
                          {m.item_name}
                        </Link>
                        {m.item_sku && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{m.item_sku}</div>
                        )}
                      </td>
                      <td>
                        {m.serial_number
                          ? <code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{m.serial_number}</code>
                          : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td>
                        <span className={`badge ${TYPE_BADGE[m.movement_type] || "badge-gray"}`} style={{ fontSize: 11 }}>
                          {m.movement_type_ar}
                        </span>
                      </td>
                      <td style={{ textAlign: "end", fontWeight: 700, color: isIn ? "#059669" : "#DC2626" }}>
                        {isIn ? "+" : ""}{fmt(m.quantity)}
                      </td>
                      <td style={{ textAlign: "end", fontFamily: "monospace", fontSize: 12 }}>{fmt(m.unit_cost)}</td>
                      <td style={{ textAlign: "end", fontWeight: 600, color: TYPE_COLOR[m.movement_type] || "var(--text-primary)" }}>
                        {fmt(m.total_value)} SAR
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.notes || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
