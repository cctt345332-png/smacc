"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { getWarehouses, createWarehouse, getStockByWarehouse, transferStock, transferSerials, validateSerials, getItems, getSerials } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";
import api from "@/lib/api";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const TRACKING_AR: Record<string, string> = {
  quantity: "كمية", serial: "سيريال", batch: "تشغيلة", variant: "متغيرات", weight: "وزن",
};

export default function WarehousesPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [stock, setStock] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState({ name_ar: "", name_en: "", branch_name: "", is_default: false });
  const [transferForm, setTransferForm] = useState({ item_id: "", from_warehouse_id: "", to_warehouse_id: "", quantity: "", notes: "" });

  // ─── Transfer state الجديد ───────────────────────────────────────────
  const [transferItem, setTransferItem] = useState<any>(null);         // الصنف المختار
  const [transferFromWh, setTransferFromWh] = useState("");            // المستودع المصدر
  const [transferToWh, setTransferToWh] = useState("");                // المستودع الهدف
  const [transferNotes, setTransferNotes] = useState("");
  const [transferQty, setTransferQty] = useState("");                  // للأصناف العادية
  const [availableSerials, setAvailableSerials] = useState<any[]>([]);  // سيريالات المستودع المصدر
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);  // IDs المختارة
  const [serialTab, setSerialTab] = useState<"list" | "paste">("list");  // طريقة الاختيار
  const [pasteSerials, setPasteSerials] = useState("");                // لصق من Excel
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null); // نتيجة التحقق
  const [transferResult, setTransferResult] = useState<any>(null);     // نتيجة التحويل (للـ PDF)

  // جلب سيريالات المستودع المصدر عند تغييره
  useEffect(() => {
    if (!transferItem || transferItem.tracking_type !== "serial" || !transferFromWh) {
      setAvailableSerials([]);
      setSelectedSerials([]);
      return;
    }
    api.get("/inventory/serials/by-warehouse", {
      params: { warehouse_id: transferFromWh, product_id: transferItem.id }
    }).then(({ data }) => setAvailableSerials(Array.isArray(data) ? data : [])).catch(() => {});
  }, [transferItem, transferFromWh]);

  // التحقق من السيريالات عند اللصق
  const handleValidatePaste = async () => {
    const sns = pasteSerials.split(/[\r\n\t,;]+/).map(s => s.trim()).filter(s => s.length >= 8);
    if (!sns.length || !transferFromWh) return;
    setValidating(true);
    setValidationResult(null);
    try {
      const { data } = await validateSerials({ serial_numbers: sns, warehouse_id: transferFromWh });
      setValidationResult(data);
      // الموجودة تُضاف للمختارة تلقائياً
      if (data.found?.length) {
        setSelectedSerials(data.found.map((f: any) => f.serial_id));
      }
    } catch {} finally { setValidating(false); }
  };

  const resetTransfer = () => {
    setTransferItem(null); setTransferFromWh(""); setTransferToWh(""); setTransferNotes("");
    setTransferQty(""); setAvailableSerials([]); setSelectedSerials([]);
    setSerialTab("list"); setPasteSerials(""); setValidationResult(null); setTransferResult(null);
  };

  const handleTransfer = async () => {
    if (!transferItem || !transferFromWh || !transferToWh)
      return alert(ar ? "يرجى تعبئة جميع الحقول" : "Please fill all fields");
    if (transferFromWh === transferToWh)
      return alert(ar ? "المستودعان مختلفان" : "Warehouses must be different");

    setSaving(true);
    try {
      if (transferItem.tracking_type === "serial") {
        if (!selectedSerials.length) return alert(ar ? "اختر سيريالاً على الأقل" : "Select at least one serial");
        const { data } = await transferSerials({
          serial_ids: selectedSerials, to_warehouse_id: transferToWh, notes: transferNotes || undefined,
        });
        setTransferResult({
          ...data,
          item_name: transferItem.name_ar,
          from_warehouse: warehouses.find(w => w.id === transferFromWh)?.name_ar,
          to_warehouse: warehouses.find(w => w.id === transferToWh)?.name_ar,
          date: new Date().toLocaleDateString("ar-SA"),
          notes: transferNotes,
        });
      } else {
        if (!transferQty || parseFloat(transferQty) <= 0)
          return alert(ar ? "أدخل كمية صحيحة" : "Enter valid quantity");
        const { data } = await transferStock({
          item_id: transferItem.id, from_warehouse_id: transferFromWh,
          to_warehouse_id: transferToWh, quantity: parseFloat(transferQty), notes: transferNotes || null,
        });
        setTransferResult({
          transferred_count: parseFloat(transferQty),
          item_name: transferItem.name_ar,
          from_warehouse: warehouses.find(w => w.id === transferFromWh)?.name_ar,
          to_warehouse: warehouses.find(w => w.id === transferToWh)?.name_ar,
          date: new Date().toLocaleDateString("ar-SA"),
          notes: transferNotes,
          transferred: [],
        });
      }
      loadStock(selectedWarehouse || undefined);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  // ── طباعة ورقة المناقلة PDF ──
  const printTransfer = () => {
    if (!transferResult) return;
    const r = transferResult;
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>ورقة مناقلة</title>
<style>
  body { font-family: Arial, sans-serif; padding: 32px; font-size: 13px; color: #1E293B; }
  h1 { font-size: 22px; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; color: #64748B; margin-bottom: 24px; font-size: 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; background: #F8FAFC; padding: 16px; border-radius: 8px; }
  .info-item label { font-size: 11px; color: #64748B; display: block; margin-bottom: 2px; }
  .info-item span { font-weight: 700; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #1E293B; color: white; padding: 8px 12px; text-align: right; font-size: 12px; }
  td { padding: 7px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; }
  tr:nth-child(even) td { background: #F8FAFC; }
  .summary { background: #F0FDF4; border: 1px solid #86EFAC; border-radius: 8px; padding: 14px; text-align: center; }
  .summary .count { font-size: 28px; font-weight: 800; color: #059669; }
  .footer { text-align: center; color: #94A3B8; font-size: 11px; margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 12px; }
  @media print { button { display: none; } }
</style></head>
<body>
  <h1>ورقة مناقلة مخزون</h1>
  <div class="subtitle">مستند تحويل رسمي</div>
  <div class="info-grid">
    <div class="info-item"><label>الصنف</label><span>${r.item_name || ""}</span></div>
    <div class="info-item"><label>التاريخ</label><span>${r.date || ""}</span></div>
    <div class="info-item"><label>من مستودع</label><span>${r.from_warehouse || ""}</span></div>
    <div class="info-item"><label>إلى مستودع</label><span>${r.to_warehouse || ""}</span></div>
    ${r.notes ? `<div class="info-item" style="grid-column:1/-1"><label>ملاحظات</label><span>${r.notes}</span></div>` : ""}
  </div>
  ${r.transferred?.length ? `
  <table>
    <thead><tr><th>#</th><th>رقم السيريال</th></tr></thead>
    <tbody>${r.transferred.map((t: any, i: number) => `<tr><td>${i + 1}</td><td style="font-family:monospace;font-weight:700">${t.serial_number}</td></tr>`).join("")}</tbody>
  </table>` : ""}
  <div class="summary">
    <div class="count">${r.transferred_count}</div>
    <div>${r.transferred?.length ? "سيريال تم نقله" : "وحدة تم نقلها"}</div>
  </div>
  ${r.error_count > 0 ? `<div style="margin-top:12px;color:#DC2626;font-size:12px">تنبيه: ${r.error_count} سيريال لم يُنقل بسبب أخطاء</div>` : ""}
  <div class="footer">تم الإنشاء بواسطة النظام — ${new Date().toLocaleString("ar-SA")}</div>
  <br><button onclick="window.print()">🖨️ طباعة</button>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  const load = async () => {
    try {
      const { data: wh } = await getWarehouses();
      setWarehouses(wh);
    } catch {} finally { setLoading(false); }
  };

  const loadStock = async (warehouseId?: string) => {
    setLoadingStock(true);
    try {
      const { data } = await getStockByWarehouse(warehouseId);
      setStock(data);
    } catch {} finally { setLoadingStock(false); }
  };

  useEffect(() => {
    load();
    loadStock();
    getItems({}).then(({ data }) => setItems(data)).catch(() => {});
  }, []);

  useEffect(() => { loadStock(selectedWarehouse || undefined); }, [selectedWarehouse]);

  const handleAddWarehouse = async () => {
    if (!warehouseForm.name_ar) return alert(ar ? "اسم المستودع مطلوب" : "Warehouse name required");
    setSaving(true);
    try {
      await createWarehouse(warehouseForm);
      setShowAddModal(false);
      setWarehouseForm({ name_ar: "", name_en: "", branch_name: "", is_default: false });
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };


  // إجماليات
  const totalValue = stock.reduce((s, r) => s + r.stock_value, 0);
  const lowStockCount = stock.filter(r => r.is_low_stock).length;
  const totalItems = new Set(stock.map(r => r.item_id)).size;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/inventory`}>{ar ? "المخزون" : "Inventory"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "المستودعات" : "Warehouses"}</span>
          </div>
          <h1 className="page-title">{ar ? "المستودعات" : "Warehouses"}</h1>
          <p className="page-subtitle">{ar ? "إدارة المخزون لكل مستودع مع إمكانية التحويل" : "Manage stock per warehouse with transfer capability"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowTransferModal(true)}>
            <Icon name="reverse" size={14} /> {ar ? "تحويل بين المستودعات" : "Transfer Stock"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <Icon name="plus" size={14} /> {ar ? "+ مستودع جديد" : "+ New Warehouse"}
          </button>
        </div>
      </div>

      {/* بطاقات المستودعات */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button
          onClick={() => setSelectedWarehouse("")}
          style={{
            padding: "10px 16px", borderRadius: 10, border: "2px solid",
            borderColor: selectedWarehouse === "" ? "var(--primary)" : "var(--border)",
            background: selectedWarehouse === "" ? "var(--primary)" : "white",
            color: selectedWarehouse === "" ? "white" : "var(--text-primary)",
            fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
          {ar ? "كل المستودعات" : "All Warehouses"}
          <span style={{ marginInlineStart: 8, fontSize: 11, opacity: 0.8 }}>({warehouses.length})</span>
        </button>
        {warehouses.map(wh => (
          <button key={wh.id}
            onClick={() => setSelectedWarehouse(wh.id)}
            style={{
              padding: "10px 16px", borderRadius: 10, border: "2px solid",
              borderColor: selectedWarehouse === wh.id ? "var(--primary)" : "var(--border)",
              background: selectedWarehouse === wh.id ? "var(--primary)" : "white",
              color: selectedWarehouse === wh.id ? "white" : "var(--text-primary)",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>
            {wh.name_ar}
            {wh.is_default && <span style={{ marginInlineStart: 6, fontSize: 10, opacity: 0.8 }}>{ar ? "(افتراضي)" : "(default)"}</span>}
          </button>
        ))}
      </div>

      {/* إحصائيات */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          { label: ar ? "إجمالي الأصناف" : "Total Items", value: totalItems, color: "#2563EB" },
          { label: ar ? "قيمة المخزون" : "Stock Value", value: `${fmt(totalValue)} SAR`, color: "#7C3AED" },
          { label: ar ? "أصناف منخفضة" : "Low Stock", value: lowStockCount, color: lowStockCount > 0 ? "#DC2626" : "#059669" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* جدول المخزون */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {selectedWarehouse
              ? `${ar ? "مخزون" : "Stock in"} ${warehouses.find(w => w.id === selectedWarehouse)?.name_ar || ""}`
              : (ar ? "مخزون جميع المستودعات" : "All Warehouses Stock")}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{stock.length} {ar ? "صنف" : "items"}</span>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loadingStock ? (
            <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : stock.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{ar ? "لا يوجد مخزون" : "No stock found"}</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                {ar ? "أضف كميات للأصناف عبر صفحة الأصناف" : "Add quantities via the Items page"}
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الصنف" : "Item"}</th>
                  <th>{ar ? "التصنيف" : "Category"}</th>
                  <th>{ar ? "نوع التتبع" : "Tracking"}</th>
                  {!selectedWarehouse && <th>{ar ? "المستودع" : "Warehouse"}</th>}
                  <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المتاح" : "Available"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "قيمة المخزون" : "Stock Value"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((row: any) => (
                  <tr key={row.stock_id} style={row.is_low_stock ? { background: "#FFF5F5" } : {}}>
                    <td>
                      <Link href={`/${locale}/inventory/items/${row.item_id}`} style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>
                        {row.item_name}
                      </Link>
                      {row.item_sku && <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{row.item_sku}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{row.category_name || "—"}</td>
                    <td><span className="badge badge-info" style={{ fontSize: 11 }}>{TRACKING_AR[row.item_tracking] || row.item_tracking}</span></td>
                    {!selectedWarehouse && <td style={{ fontSize: 13 }}>{row.warehouse_name}</td>}
                    <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(row.quantity)}</td>
                    <td style={{ textAlign: "end", fontWeight: 600, color: row.available_qty > 0 ? "#059669" : "#DC2626" }}>
                      {fmt(row.available_qty)}
                    </td>
                    <td style={{ textAlign: "end", color: "#7C3AED", fontWeight: 600 }}>{fmt(row.stock_value)} SAR</td>
                    <td>
                      {row.is_low_stock
                        ? <span className="badge badge-danger">{ar ? "منخفض" : "Low Stock"}</span>
                        : <span className="badge badge-success">{ar ? "متاح" : "Available"}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                  <td colSpan={!selectedWarehouse ? 6 : 5} style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                  <td style={{ textAlign: "end", padding: "12px 16px", color: "#7C3AED" }}>{fmt(totalValue)} SAR</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Modal إضافة مستودع */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 400 }} className="animate-slide">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "مستودع جديد" : "New Warehouse"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group">
                <label className="form-label">{ar ? "الاسم بالعربي" : "Arabic Name"} <span className="required">*</span></label>
                <input className="form-input" value={warehouseForm.name_ar} onChange={e => setWarehouseForm(f => ({ ...f, name_ar: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الاسم بالإنجليزي" : "English Name"}</label>
                <input className="form-input" value={warehouseForm.name_en} onChange={e => setWarehouseForm(f => ({ ...f, name_en: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الفرع" : "Branch"}</label>
                <input className="form-input" value={warehouseForm.branch_name} onChange={e => setWarehouseForm(f => ({ ...f, branch_name: e.target.value }))} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginBottom: 16 }}>
                <input type="checkbox" checked={warehouseForm.is_default} onChange={e => setWarehouseForm(f => ({ ...f, is_default: e.target.checked }))} />
                {ar ? "تعيين كمستودع افتراضي" : "Set as default"}
              </label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={handleAddWarehouse} disabled={saving}>
                  {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal تحويل المخزون الذكي ═══ */}
      {showTransferModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "92vh", display: "flex", flexDirection: "column" }} className="animate-slide">

            {/* Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "تحويل بين المستودعات" : "Stock Transfer"}</h2>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {transferItem?.tracking_type === "serial"
                    ? (ar ? "تحويل سيريالات — اختر تحديداً أو ارفع Excel" : "Serial transfer — select or upload Excel")
                    : (ar ? "نقل كمية من مستودع لآخر" : "Move quantity between warehouses")}
                </p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowTransferModal(false); resetTransfer(); }}>✕</button>
            </div>

            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>

              {/* إذا نجح التحويل — عرض النتيجة + زر PDF */}
              {transferResult ? (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div style={{ fontSize: 48 }}>✅</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#059669", marginTop: 8 }}>
                    {ar ? `تم نقل ${transferResult.transferred_count} ${transferResult.transferred?.length ? "سيريال" : "وحدة"} بنجاح` : `${transferResult.transferred_count} units transferred`}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                    {transferResult.from_warehouse} → {transferResult.to_warehouse}
                  </div>
                  {transferResult.error_count > 0 && (
                    <div style={{ color: "#DC2626", fontSize: 12, marginTop: 8 }}>
                      ⚠️ {ar ? `${transferResult.error_count} سيريال لم يُنقل` : `${transferResult.error_count} serials failed`}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
                    <button className="btn btn-primary" onClick={printTransfer}>
                      🖨️ {ar ? "طباعة ورقة المناقلة PDF" : "Print Transfer PDF"}
                    </button>
                    <button className="btn btn-secondary" onClick={() => { setShowTransferModal(false); resetTransfer(); }}>
                      {ar ? "إغلاق" : "Close"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* 1. اختيار الصنف */}
                  <div className="form-group">
                    <label className="form-label">{ar ? "الصنف" : "Item"} <span className="required">*</span></label>
                    <select className="form-input form-select" value={transferItem?.id || ""}
                      onChange={e => { const i = items.find((x: any) => x.id === e.target.value); setTransferItem(i || null); setSelectedSerials([]); }}>
                      <option value="">— {ar ? "اختر الصنف" : "Select Item"} —</option>
                      {items.map((i: any) => (
                        <option key={i.id} value={i.id}>
                          {i.name_ar} ({i.sku}) {i.tracking_type === "serial" ? "📱 سيريال" : "📦"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. المستودعات */}
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">{ar ? "من مستودع" : "From"} <span className="required">*</span></label>
                      <select className="form-input form-select" value={transferFromWh} onChange={e => setTransferFromWh(e.target.value)}>
                        <option value="">— {ar ? "اختر" : "Select"} —</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{ar ? "إلى مستودع" : "To"} <span className="required">*</span></label>
                      <select className="form-input form-select" value={transferToWh} onChange={e => setTransferToWh(e.target.value)}>
                        <option value="">— {ar ? "اختر" : "Select"} —</option>
                        {warehouses.filter(w => w.id !== transferFromWh).map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* تلميح للسيريالات — يظهر المستودعات التي فيها سيريالات */}
                  {transferItem?.tracking_type === "serial" && !transferFromWh && (
                    <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400E", marginBottom: 8 }}>
                      💡 {ar ? "اختر 'من مستودع' أولاً لعرض السيريالات المتاحة فيه" : "Select 'From Warehouse' first to see available serials"}
                    </div>
                  )}

                  {/* 3أ. صنف عادي → كمية */}
                  {transferItem && transferItem.tracking_type !== "serial" && (
                    <div className="form-group">
                      <label className="form-label">{ar ? "الكمية" : "Quantity"} <span className="required">*</span></label>
                      <input type="number" className="form-input" value={transferQty}
                        onChange={e => setTransferQty(e.target.value)} min="0.001" step="0.001" placeholder="0" />
                    </div>
                  )}

                  {/* 3ب. صنف سيريال → اختيار السيريالات */}
                  {transferItem?.tracking_type === "serial" && transferFromWh && (
                    <div>
                      {/* تبويبات */}
                      <div style={{ display: "flex", borderBottom: "2px solid var(--border)", marginBottom: 14 }}>
                        {([
                          { key: "list", label: ar ? "📋 اختيار من القائمة" : "📋 Select from list" },
                          { key: "paste", label: ar ? "📄 رفع Excel / لصق" : "📄 Excel / Paste" },
                        ] as const).map(t => (
                          <button key={t.key} onClick={() => setSerialTab(t.key)}
                            style={{ flex: 1, padding: "8px", background: "none", border: "none", borderBottom: serialTab === t.key ? "2px solid var(--primary)" : "2px solid transparent", color: serialTab === t.key ? "var(--primary)" : "var(--text-secondary)", fontWeight: serialTab === t.key ? 700 : 500, fontSize: 12, cursor: "pointer", marginBottom: -2 }}>
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* قائمة السيريالات */}
                      {serialTab === "list" && (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>
                              {ar ? "سيريالات المستودع المصدر" : "Source Warehouse Serials"}
                              <span style={{ marginInlineStart: 6, background: "#2563EB", color: "white", borderRadius: 20, padding: "1px 8px", fontSize: 11 }}>{availableSerials.length}</span>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                                onClick={() => setSelectedSerials(availableSerials.map((s: any) => s.id))}>
                                {ar ? "تحديد الكل" : "Select All"}
                              </button>
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                                onClick={() => setSelectedSerials([])}>
                                {ar ? "إلغاء الكل" : "Clear"}
                              </button>
                            </div>
                          </div>
                          {availableSerials.length === 0 ? (
                            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px 0", fontSize: 13 }}>
                              {ar ? "لا توجد سيريالات في هذا المستودع" : "No serials in this warehouse"}
                            </div>
                          ) : (
                            <div style={{ maxHeight: 220, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                              {availableSerials.map((s: any) => {
                                const checked = selectedSerials.includes(s.id);
                                return (
                                  <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, border: `1px solid ${checked ? "var(--primary)" : "var(--border)"}`, background: checked ? "#EFF6FF" : "white", cursor: "pointer", fontSize: 12 }}>
                                    <input type="checkbox" checked={checked} onChange={e => setSelectedSerials(prev => e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id))} />
                                    <code style={{ fontWeight: 700 }}>{s.serial_number}</code>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                          {selectedSerials.length > 0 && (
                            <div style={{ marginTop: 8, fontSize: 12, color: "#059669", fontWeight: 600 }}>
                              ✅ {selectedSerials.length} {ar ? "سيريال مختار" : "serials selected"}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Excel / لصق */}
                      {serialTab === "paste" && (
                        <div>
                          <textarea className="form-input" style={{ width: "100%", minHeight: 100, fontFamily: "monospace", fontSize: 12, direction: "ltr" }}
                            value={pasteSerials} onChange={e => setPasteSerials(e.target.value)}
                            placeholder={"356789012345678\n356789012345679\n..."} />
                          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                            <button className="btn btn-secondary btn-sm" onClick={handleValidatePaste} disabled={validating || !pasteSerials.trim()}>
                              {validating ? "..." : (ar ? "🔍 تحقق من السيريالات" : "🔍 Validate")}
                            </button>
                            {validationResult && (
                              <div style={{ fontSize: 12 }}>
                                <span style={{ color: "#059669", fontWeight: 700 }}>✅ {validationResult.found?.length}</span>
                                {validationResult.not_found?.length > 0 && <span style={{ color: "#DC2626", marginInlineStart: 8, fontWeight: 700 }}>❌ {validationResult.not_found.length} {ar ? "غير موجود" : "not found"}</span>}
                                {validationResult.wrong_warehouse?.length > 0 && <span style={{ color: "#D97706", marginInlineStart: 8, fontWeight: 700 }}>⚠️ {validationResult.wrong_warehouse.length} {ar ? "في مستودع آخر" : "wrong warehouse"}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ملاحظات */}
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
                    <input className="form-input" value={transferNotes} onChange={e => setTransferNotes(e.target.value)}
                      placeholder={ar ? "سبب التحويل..." : "Transfer reason..."} />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!transferResult && (
              <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
                <button className="btn btn-secondary" onClick={() => { setShowTransferModal(false); resetTransfer(); }}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={handleTransfer} disabled={saving}>
                  {saving ? (ar ? "جاري التحويل..." : "Transferring...") : (ar ? "↔ تحويل" : "↔ Transfer")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
