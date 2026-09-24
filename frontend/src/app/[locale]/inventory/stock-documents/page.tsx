"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createStockDocument, getItems, getWarehouses } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";

export default function StockDocumentsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [serialText, setSerialText] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    Promise.all([getItems({ limit: 500 }), getWarehouses()]).then(([itemsRes, warehousesRes]) => {
      const itemData = itemsRes.data;
      setItems(Array.isArray(itemData) ? itemData : (itemData?.items || []));
      const warehouseData = warehousesRes.data;
      setWarehouses(Array.isArray(warehouseData) ? warehouseData : (warehouseData?.items || []));
    }).catch(() => setMessage({ ok: false, text: ar ? "تعذر تحميل الأصناف والمستودعات" : "Unable to load items and warehouses" }));
  }, [ar]);

  const selectedItem = useMemo(() => items.find(item => item.id === itemId), [items, itemId]);
  const isSerial = selectedItem?.tracking_type === "serial";
  const serialNumbers = serialText.split(/[\n,\t]+/).map(value => value.trim()).filter(Boolean);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!itemId || !warehouseId) {
      setMessage({ ok: false, text: ar ? "اختر الصنف والمستودع أولاً" : "Select an item and warehouse first" });
      return;
    }
    if (isSerial && serialNumbers.length === 0) {
      setMessage({ ok: false, text: ar ? "أدخل أرقام السيريالات" : "Enter serial numbers" });
      return;
    }
    if (!isSerial && (!quantity || Number(quantity) <= 0)) {
      setMessage({ ok: false, text: ar ? "أدخل كمية أكبر من صفر" : "Enter a quantity greater than zero" });
      return;
    }
    setBusy(true);
    try {
      const { data } = await createStockDocument({
        direction, item_id: itemId, warehouse_id: warehouseId,
        quantity: isSerial ? serialNumbers.length : Number(quantity),
        unit_cost: Number(unitCost || selectedItem?.cost_price || 0),
        serial_numbers: isSerial ? serialNumbers : [], notes,
      });
      setMessage({ ok: true, text: ar ? `تم حفظ سند ${direction === "in" ? "الإدخال" : "الإخراج"} للصنف ${data.item_name}` : `Stock ${direction} document saved for ${data.item_name}` });
      setQuantity(""); setSerialText(""); setNotes("");
    } catch (error: any) {
      setMessage({ ok: false, text: error?.response?.data?.detail || (ar ? "تعذر حفظ سند المخزون" : "Unable to save stock document") });
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><Link href={`/${locale}/inventory`}>{ar ? "المخزون" : "Inventory"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "سندات المخزون" : "Stock Documents"}</span></div>
          <h1 className="page-title">{ar ? "سندات المخزون" : "Stock Documents"}</h1>
          <p className="page-subtitle">{ar ? "إدخال وإخراج مخزني مستقل عن فواتير البيع والشراء" : "Manual stock input and output documents"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/inventory/movements`} className="btn btn-secondary"><Icon name="trending" size={15} /> {ar ? "حركات المخزون" : "Movements"}</Link>
        </div>
      </div>

      <div className="card" style={{ width: "100%" }}>
        <div className="card-header"><span className="card-title">{ar ? "إنشاء سند مخزني" : "Create stock document"}</span></div>
        <div className="card-body">
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button type="button" className={`btn ${direction === "in" ? "btn-primary" : "btn-secondary"}`} onClick={() => setDirection("in")}><Icon name="plus" size={15} /> {ar ? "إدخال مخزني" : "Stock input"}</button>
            <button type="button" className="btn" onClick={() => setDirection("out")} style={{ background: direction === "out" ? "#DC2626" : "#FEE2E2", color: direction === "out" ? "#FFFFFF" : "#B91C1C", borderColor: "#DC2626" }}><Icon name="reverse" size={15} /> {ar ? "إخراج مخزني" : "Stock output"}</button>
          </div>
          {message && <div className={`alert ${message.ok ? "alert-success" : "alert-danger"}`} style={{ marginBottom: 16 }}>{message.text}</div>}
          <form onSubmit={submit}>
            <div className="grid-2">
              <label className="form-group"><span className="form-label">{ar ? "المستودع" : "Warehouse"} *</span><select className="form-input form-select" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}><option value="">{ar ? "اختر المستودع" : "Select warehouse"}</option>{warehouses.map(w => <option key={w.id} value={w.id}>{ar ? w.name_ar : (w.name_en || w.name_ar)}</option>)}</select></label>
              <label className="form-group"><span className="form-label">{ar ? "الصنف" : "Item"} *</span><select className="form-input form-select" value={itemId} onChange={e => setItemId(e.target.value)}><option value="">{ar ? "اختر الصنف" : "Select item"}</option>{items.map(item => <option key={item.id} value={item.id}>{item.name_ar}{item.sku ? ` — ${item.sku}` : ""}</option>)}</select></label>
            </div>
            {selectedItem && <div style={{ background: "#F7F2F8", padding: "10px 12px", borderRadius: 8, margin: "4px 0 16px", fontSize: 12, color: "#5A187E" }}>{ar ? "نوع التتبع:" : "Tracking:"} <strong>{isSerial ? (ar ? "سيريال" : "Serial") : (ar ? "كمية" : "Quantity")}</strong></div>}
            {isSerial ? (
              <label className="form-group"><span className="form-label">{ar ? "السيريالات" : "Serial numbers"} *</span><textarea className="form-input" rows={7} value={serialText} onChange={e => setSerialText(e.target.value)} placeholder={ar ? "سيريال واحد في كل سطر أو افصل بفاصلة" : "One serial per line or comma-separated"} /><span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{serialNumbers.length} {ar ? "سيريال" : "serials"}</span></label>
            ) : (
              <div className="grid-2"><label className="form-group"><span className="form-label">{ar ? "الكمية" : "Quantity"} *</span><input className="form-input" type="number" min="0.001" step="0.001" value={quantity} onChange={e => setQuantity(e.target.value)} /></label><label className="form-group"><span className="form-label">{ar ? "تكلفة الوحدة" : "Unit cost"}</span><input className="form-input" type="number" min="0" step="0.0001" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder={String(selectedItem?.cost_price || 0)} /></label></div>
            )}
            {isSerial && direction === "in" && <label className="form-group"><span className="form-label">{ar ? "تكلفة السيريال" : "Serial cost"}</span><input className="form-input" type="number" min="0" step="0.0001" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder={String(selectedItem?.cost_price || 0)} /></label>}
            <label className="form-group"><span className="form-label">{ar ? "سبب / البيان" : "Reason / notes"}</span><textarea className="form-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder={ar ? "مثال: تسوية زيادة، تلف، استخدام داخلي..." : "e.g. adjustment, damage, internal use..."} /></label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}><Link href={`/${locale}/inventory`} className="btn btn-secondary">{ar ? "إلغاء" : "Cancel"}</Link><button className="btn" disabled={busy} style={{ background: direction === "in" ? "#5A187E" : "#DC2626", color: "#FFFFFF", borderColor: direction === "in" ? "#5A187E" : "#DC2626" }}>{busy ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? `حفظ سند ${direction === "in" ? "الإدخال" : "الإخراج"}` : `Save ${direction === "in" ? "input" : "output"}`)}</button></div>
          </form>
        </div>
      </div>
    </>
  );
}

function IconFallback() { return null; }
