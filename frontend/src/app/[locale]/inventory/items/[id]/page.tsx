"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getItem, getSerials, getBatches, addBatch, getWarehouses } from "@/lib/inventory";
import { getCompany } from "@/lib/settings";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const SERIAL_STATUS: Record<string, { ar: string; badge: string }> = {
  in_stock:  { ar: "في المخزون", badge: "badge-success" },
  sold:      { ar: "مباع",       badge: "badge-gray" },
  reserved:  { ar: "محجوز",      badge: "badge-warning" },
  damaged:   { ar: "تالف",       badge: "badge-danger" },
  returned:  { ar: "مرتجع",      badge: "badge-info" },
};

const CONDITION: Record<string, { ar: string; badge: string }> = {
  new:         { ar: "جديد",   badge: "badge-success" },
  used:        { ar: "مستخدم", badge: "badge-warning" },
  refurbished: { ar: "مجدد",   badge: "badge-info" },
};

const TRACKING_AR: Record<string, string> = {
  quantity: "كمية", serial: "سيريال", batch: "تشغيلة", variant: "متغيرات", weight: "وزن",
};

export default function ItemDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const ar = locale === "ar";
  const [item, setItem] = useState<any>(null);
  const [allSerials, setAllSerials] = useState<any[]>([]);
  const [serials, setSerials] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [businessType, setBusinessType] = useState<string | null>(null); // null = لم يُحمَّل بعد
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("in_stock");
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const [batchForm, setBatchForm] = useState({
    batch_number: "", quantity: "", cost_price: "",
    expiry_date: "", manufacture_date: "", warehouse_id: "",
  });

  const load = async () => {
    try {
      const [itemRes, compRes, whRes] = await Promise.all([
        getItem(id),
        getCompany(),
        getWarehouses(),
      ]);
      setItem(itemRes.data);
      setBusinessType(compRes.data?.business_type || "general");
      setWarehouses(whRes.data);

      if (itemRes.data.tracking_type === "serial") {
        const [allRes, filteredRes] = await Promise.all([
          getSerials(id),
          getSerials(id, "in_stock"),
        ]);
        setAllSerials(allRes.data);
        setSerials(filteredRes.data);
      }
      if (itemRes.data.tracking_type === "batch") {
        const batchRes = await getBatches(id, true);
        setBatches(batchRes.data);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (item?.tracking_type === "serial") {
      getSerials(id, filterStatus || undefined)
        .then(({ data }) => setSerials(data))
        .catch(() => {});
    }
  }, [filterStatus]);

  const handleAddBatch = async () => {
    if (!batchForm.batch_number) return alert(ar ? "رقم التشغيلة مطلوب" : "Batch number required");
    if (!batchForm.quantity || parseFloat(batchForm.quantity) <= 0) return alert(ar ? "الكمية مطلوبة" : "Quantity required");
    if (!batchForm.expiry_date) return alert(ar ? "تاريخ الانتهاء مطلوب" : "Expiry date required");
    setSavingBatch(true);
    try {
      await addBatch(id, {
        batch_number: batchForm.batch_number,
        quantity: parseFloat(batchForm.quantity),
        cost_price: parseFloat(batchForm.cost_price) || 0,
        expiry_date: batchForm.expiry_date,
        manufacture_date: batchForm.manufacture_date || null,
        warehouse_id: batchForm.warehouse_id || null,
      });
      setShowBatchModal(false);
      setBatchForm({ batch_number: "", quantity: "", cost_price: "", expiry_date: "", manufacture_date: "", warehouse_id: "" });
      const batchRes = await getBatches(id, true);
      setBatches(batchRes.data);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSavingBatch(false); }
  };

  if (loading) return <div className="empty-state" style={{ minHeight: "60vh" }}><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;
  if (!item) return <div className="empty-state" style={{ minHeight: "60vh" }}><div className="empty-state-title">{ar ? "الصنف غير موجود" : "Item not found"}</div></div>;

  // إحصائيات من كل السيريالات
  const inStock = allSerials.filter(s => s.status === "in_stock");
  const sold = allSerials.filter(s => s.status === "sold");
  const stockValue = inStock.reduce((sum, s) => sum + Number(s.cost_price || 0), 0);
  const soldRevenue = sold.reduce((sum, s) => sum + Number(s.sale_price || 0), 0);
  const soldCost = sold.reduce((sum, s) => sum + Number(s.cost_price || 0), 0);
  const realizedProfit = soldRevenue - soldCost;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/inventory/items`}>{ar ? "الأصناف" : "Items"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{item.name_ar}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            <h1 className="page-title">{item.name_ar}</h1>
            {item.color && <span className="badge badge-info">{item.color}</span>}
            {item.storage && <span className="badge badge-gray">{item.storage}</span>}
          </div>
          {item.name_en && <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{item.name_en}</p>}
        </div>
        {item.tracking_type === "serial" && (
          <Link href={`/${locale}/inventory/serials`} className="btn btn-primary btn-sm">
            <Icon name="plus" size={14} /> {ar ? "إضافة سيريالات" : "Add Serials"}
          </Link>
        )}
        {item.tracking_type === "batch" && businessType !== null && businessType === "pharmacy" && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowBatchModal(true)}>
            <Icon name="plus" size={14} /> {ar ? "إضافة تشغيلة" : "Add Batch"}
          </button>
        )}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* بيانات الصنف */}
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "بيانات الصنف" : "Item Details"}</span></div>
          <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "SKU", value: item.sku },
              { label: ar ? "الباركود" : "Barcode", value: item.barcode },
              { label: ar ? "نوع التتبع" : "Tracking", value: TRACKING_AR[item.tracking_type] || item.tracking_type },
              { label: ar ? "وحدة القياس" : "Unit", value: item.unit_type },
              { label: ar ? "اللون" : "Color", value: item.color },
              { label: ar ? "السعة" : "Storage", value: item.storage },
              { label: item.tracking_type === "serial" ? (ar ? "سعر التكلفة الموحد" : "Unified Cost Price") : (ar ? "سعر التكلفة" : "Cost Price"), value: `${fmt(item.cost_price)} SAR` },
              { label: item.tracking_type === "serial" ? (ar ? "سعر البيع الموحد" : "Unified Sale Price") : (ar ? "سعر البيع" : "Sale Price"), value: `${fmt(item.sale_price)} SAR` },
              { label: ar ? "ضريبة القيمة المضافة" : "VAT", value: `${item.vat_rate}%` },
            ].filter(f => f.value).map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{f.label}</div>
                <div style={{ fontSize: 14 }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* إحصائيات */}
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "الإحصائيات" : "Statistics"}</span></div>
          <div style={{ padding: "16px 20px" }}>
            {item.tracking_type === "serial" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: ar ? "في المخزون" : "In Stock", value: inStock.length, color: "#059669", suffix: "" },
                  { label: ar ? "مباع" : "Sold", value: sold.length, color: "#5A187E", suffix: "" },
                  { label: ar ? "قيمة المخزون (تكلفة)" : "Stock Value (Cost)", value: stockValue, color: "#75617F", suffix: " SAR" },
                  { label: ar ? "الربح المحقق" : "Realized Profit", value: realizedProfit, color: realizedProfit >= 0 ? "#059669" : "#DC2626", suffix: " SAR" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#F8FAFC", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>
                      {typeof s.value === "number" && s.suffix ? `${fmt(s.value)}${s.suffix}` : s.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: ar ? "الكمية المتاحة" : "On Hand", value: fmt(item.quantity_on_hand), color: "#059669" },
                  { label: ar ? "الكمية المحجوزة" : "Reserved", value: fmt(item.quantity_reserved), color: "#D97706" },
                  { label: ar ? "قيمة المخزون" : "Stock Value", value: `${fmt(Number(item.quantity_on_hand) * Number(item.cost_price))} SAR`, color: "#75617F" },
                  { label: ar ? "نقطة إعادة الطلب" : "Reorder Point", value: fmt(item.reorder_point), color: Number(item.quantity_on_hand) <= Number(item.reorder_point) ? "#DC2626" : "#059669" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#F8FAFC", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* جدول التشغيلات — للصيدلية فقط */}
      {item.tracking_type === "batch" && businessType !== null && businessType === "pharmacy" && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">
              {ar ? "التشغيلات (Batches)" : "Batches"}
              <span style={{ fontSize: 12, color: "var(--text-secondary)", marginInlineStart: 8 }}>
                ({batches.filter(b => b.quantity > 0).length} {ar ? "نشطة" : "active"})
              </span>
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowBatchModal(true)}>
              <Icon name="plus" size={14} /> {ar ? "إضافة تشغيلة" : "Add Batch"}
            </button>
          </div>
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            {batches.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 20px" }}>
                <div className="empty-state-title" style={{ fontSize: 13 }}>
                  {ar ? "لا توجد تشغيلات — أضف تشغيلة أولى" : "No batches — add the first batch"}
                </div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowBatchModal(true)}>
                  {ar ? "إضافة تشغيلة" : "Add Batch"}
                </button>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{ar ? "رقم التشغيلة" : "Batch No."}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "سعر التكلفة" : "Cost"}</th>
                    <th>{ar ? "تاريخ الصنع" : "Mfg. Date"}</th>
                    <th>{ar ? "تاريخ الانتهاء" : "Expiry Date"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الأيام المتبقية" : "Days Left"}</th>
                    <th>{ar ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b: any) => {
                    const badge = b.is_expired ? "badge-danger"
                      : b.days_to_expiry !== null && b.days_to_expiry <= 30 ? "badge-danger"
                      : b.is_near_expiry ? "badge-warning"
                      : "badge-success";
                    const statusAr = b.is_expired ? "منتهي"
                      : b.days_to_expiry !== null && b.days_to_expiry <= 30 ? "حرج"
                      : b.is_near_expiry ? "قريب الانتهاء"
                      : "صالح";
                    return (
                      <tr key={b.id} style={{ background: b.is_expired ? "#FEF2F2" : b.days_to_expiry !== null && b.days_to_expiry <= 30 ? "#FFF7ED" : "transparent" }}>
                        <td><code style={{ background: "#F1F5F9", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{b.batch_number}</code></td>
                        <td style={{ textAlign: "end", fontWeight: 700, color: b.quantity > 0 ? "#059669" : "var(--text-muted)" }}>{fmt(b.quantity)}</td>
                        <td style={{ textAlign: "end" }}>{fmt(b.cost_price)} SAR</td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {b.manufacture_date ? new Date(b.manufacture_date).toLocaleDateString("en-SA") : "—"}
                        </td>
                        <td style={{ fontWeight: 600, color: b.is_expired ? "#DC2626" : b.is_near_expiry ? "#D97706" : "var(--text-primary)" }}>
                          {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString("en-SA") : "—"}
                        </td>
                        <td style={{ textAlign: "end", fontWeight: 700, color: b.is_expired ? "#DC2626" : b.is_near_expiry ? "#D97706" : "#059669" }}>
                          {b.days_to_expiry !== null
                            ? b.days_to_expiry < 0
                              ? `${Math.abs(b.days_to_expiry)} ${ar ? "يوم مضى" : "days ago"}`
                              : `${b.days_to_expiry} ${ar ? "يوم" : "days"}`
                            : "—"}
                        </td>
                        <td><span className={`badge ${badge}`}>{statusAr}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal إضافة تشغيلة */}
      {showBatchModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 480 }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "إضافة تشغيلة جديدة" : "Add New Batch"}</h2>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{item.name_ar}</p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowBatchModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="grid-2">
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{ar ? "رقم التشغيلة (Lot/Batch)" : "Batch / Lot Number"} <span className="required">*</span></label>
                  <input className="form-input" value={batchForm.batch_number}
                    onChange={e => setBatchForm(f => ({ ...f, batch_number: e.target.value }))}
                    placeholder="LOT-XXXX" dir="ltr" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{ar ? "الكمية" : "Quantity"} <span className="required">*</span></label>
                  <input type="number" className="form-input" value={batchForm.quantity}
                    onChange={e => setBatchForm(f => ({ ...f, quantity: e.target.value }))}
                    min="0" placeholder="0" />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{ar ? "سعر التكلفة (ر.س)" : "Cost Price (SAR)"}</label>
                  <input type="number" className="form-input" value={batchForm.cost_price}
                    onChange={e => setBatchForm(f => ({ ...f, cost_price: e.target.value }))}
                    min="0" step="0.01" placeholder="0.00" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{ar ? "المستودع" : "Warehouse"}</label>
                  <select className="form-input form-select" value={batchForm.warehouse_id}
                    onChange={e => setBatchForm(f => ({ ...f, warehouse_id: e.target.value }))}>
                    <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                    {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{ar ? "تاريخ الانتهاء" : "Expiry Date"} <span className="required">*</span></label>
                  <input type="date" className="form-input" value={batchForm.expiry_date}
                    onChange={e => setBatchForm(f => ({ ...f, expiry_date: e.target.value }))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{ar ? "تاريخ الصنع (اختياري)" : "Manufacture Date"}</label>
                  <input type="date" className="form-input" value={batchForm.manufacture_date}
                    onChange={e => setBatchForm(f => ({ ...f, manufacture_date: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button className="btn btn-secondary" onClick={() => setShowBatchModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={handleAddBatch} disabled={savingBatch}>
                  {savingBatch ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "إضافة التشغيلة" : "Add Batch")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* جدول السيريالات */}
      {item.tracking_type === "serial" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {ar ? "السيريالات" : "Serial Numbers"}
              <span style={{ fontSize: 12, color: "var(--text-secondary)", marginInlineStart: 8 }}>
                ({allSerials.length} {ar ? "إجمالي" : "total"})
              </span>
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select className="form-input form-select" style={{ width: 160, height: 32, fontSize: 12 }}
                value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">{ar ? "كل الحالات" : "All"}</option>
                {Object.entries(SERIAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.ar}</option>)}
              </select>
              <Link href={`/${locale}/inventory/serials`} className="btn btn-primary btn-sm">
                <Icon name="plus" size={14} /> {ar ? "إضافة" : "Add"}
              </Link>
            </div>
          </div>
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            {serials.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 20px" }}>
                <div className="empty-state-title" style={{ fontSize: 13 }}>
                  {filterStatus ? (ar ? `لا توجد سيريالات بحالة "${SERIAL_STATUS[filterStatus]?.ar}"` : `No serials with status "${filterStatus}"`) : (ar ? "لا توجد سيريالات" : "No serials")}
                </div>
                {!filterStatus && (
                  <Link href={`/${locale}/inventory/serials`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                    {ar ? "إضافة سيريالات" : "Add Serials"}
                  </Link>
                )}
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{ar ? "رقم السيريال" : "Serial #"}</th>
                    <th>{ar ? "الحالة" : "Condition"}</th>
                    <th>{ar ? "الوضع" : "Status"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "التكلفة" : "Cost"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "سعر البيع" : "Sale Price"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الربح" : "Profit"}</th>
                    <th>{ar ? "ملاحظات" : "Notes"}</th>
                  </tr>
                </thead>
                <tbody>
                  {serials.map((s: any) => {
                    const st = SERIAL_STATUS[s.status] || { ar: s.status, badge: "badge-gray" };
                    const cond = CONDITION[s.condition] || { ar: s.condition, badge: "badge-gray" };
                    const profit = s.sale_price ? Number(s.sale_price) - Number(s.cost_price) : null;
                    return (
                      <tr key={s.id}>
                        <td><code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{s.serial_number}</code></td>
                        <td><span className={`badge ${cond.badge}`}>{cond.ar}</span></td>
                        <td><span className={`badge ${st.badge}`}>{st.ar}</span></td>
                        <td style={{ textAlign: "end", fontFamily: "monospace" }}>{fmt(s.cost_price)}</td>
                        <td style={{ textAlign: "end", fontFamily: "monospace" }}>{s.sale_price ? fmt(s.sale_price) : "—"}</td>
                        <td style={{ textAlign: "end", fontWeight: 700, color: profit !== null ? (profit >= 0 ? "#059669" : "#DC2626") : "var(--text-muted)" }}>
                          {profit !== null ? fmt(profit) : "—"}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{s.notes || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
