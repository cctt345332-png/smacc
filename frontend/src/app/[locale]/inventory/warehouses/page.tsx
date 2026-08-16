"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getWarehouses, createWarehouse, getStockByWarehouse, transferStockBulk, validateSerials, getItems } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";
import api from "@/lib/api";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const TRACKING_AR: Record<string, string> = {
  quantity: "كمية", serial: "سيريال", batch: "تشغيلة", variant: "متغيرات", weight: "وزن",
};

// ─── نوع سطر الـ transfer ────────────────────────────────────────────────────
interface TransferLine {
  id: string;                        // مؤقت للـ UI فقط
  item: any | null;                  // الصنف المختار (كامل)
  quantity: string;                  // للأصناف العادية
  selectedSerials: string[];         // للسيريال
  availableSerials: any[];           // سيريالات المستودع المصدر
  loadingSerials: boolean;
  serialTab: "list" | "paste";
  pasteSerials: string;
  validating: boolean;
  validationResult: any;
}

const emptyLine = (): TransferLine => ({
  id: Math.random().toString(36).slice(2),
  item: null, quantity: "",
  selectedSerials: [], availableSerials: [], loadingSerials: false,
  serialTab: "list", pasteSerials: "", validating: false, validationResult: null,
});

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

  // ─── Transfer state ──────────────────────────────────────────────────────────
  const [transferFromWh, setTransferFromWh] = useState("");
  const [transferToWh, setTransferToWh] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferLines, setTransferLines] = useState<TransferLine[]>([emptyLine()]);
  const [transferResult, setTransferResult] = useState<any>(null);

  // تحديث سطر واحد
  const updateLine = (id: string, patch: Partial<TransferLine>) =>
    setTransferLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));

  // جلب سيريالات عند تغيير الصنف أو مستودع المصدر
  const fetchSerials = async (lineId: string, item: any, fromWh: string) => {
    if (!item || item.tracking_type !== "serial" || !fromWh) {
      updateLine(lineId, { availableSerials: [], selectedSerials: [] });
      return;
    }
    updateLine(lineId, { loadingSerials: true, availableSerials: [], selectedSerials: [] });
    try {
      const { data } = await api.get("/inventory/serials/by-warehouse", {
        params: { warehouse_id: fromWh, product_id: item.id }
      });
      updateLine(lineId, { availableSerials: Array.isArray(data) ? data : [], loadingSerials: false });
    } catch { updateLine(lineId, { loadingSerials: false }); }
  };

  const resetTransfer = () => {
    setTransferFromWh(""); setTransferToWh(""); setTransferNotes("");
    setTransferLines([emptyLine()]); setTransferResult(null);
  };

  const handleTransfer = async () => {
    if (!transferFromWh || !transferToWh)
      return alert(ar ? "يرجى اختيار المستودعين" : "Please select both warehouses");
    if (transferFromWh === transferToWh)
      return alert(ar ? "المستودع المصدر والهدف مختلفان" : "Warehouses must be different");

    const filledLines = transferLines.filter(l => l.item);
    if (!filledLines.length)
      return alert(ar ? "يرجى اختيار صنف واحد على الأقل" : "Select at least one item");

    // بناء قائمة items للـ API
    const itemsPayload: any[] = [];
    for (const line of filledLines) {
      if (line.item.tracking_type === "serial") {
        if (!line.selectedSerials.length) {
          return alert(ar ? `اختر سيريالاً للصنف "${line.item.name_ar}"` : `Select serials for "${line.item.name_ar}"`);
        }
        itemsPayload.push({ item_id: line.item.id, serial_ids: line.selectedSerials });
      } else {
        if (!line.quantity || parseFloat(line.quantity) <= 0) {
          return alert(ar ? `أدخل كمية صحيحة للصنف "${line.item.name_ar}"` : `Enter valid quantity for "${line.item.name_ar}"`);
        }
        itemsPayload.push({ item_id: line.item.id, quantity: parseFloat(line.quantity) });
      }
    }

    setSaving(true);
    try {
      const { data } = await transferStockBulk({
        from_warehouse_id: transferFromWh,
        to_warehouse_id: transferToWh,
        items: itemsPayload,
        notes: transferNotes || undefined,
      });
      setTransferResult({
        ...data,
        date: new Date().toLocaleDateString("ar-SA"),
      });
      loadStock(selectedWarehouse || undefined);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  // ── طباعة ورقة المناقلة PDF ──
  const printTransfer = () => {
    if (!transferResult) return;
    const r = transferResult;
    const rows = (r.results || []).map((res: any, i: number) => {
      if (res.tracking_type === "serial") {
        return `
          <tr style="background:#F8FAFC"><td colspan="3" style="padding:8px 12px;font-weight:700">${i+1}. ${res.item_name} – ${res.transferred_count} سيريال</td></tr>
          ${(res.transferred || []).map((s: any, j: number) => `
            <tr><td style="padding:4px 24px;color:#64748B">${j+1}</td><td colspan="2" style="font-family:monospace;font-weight:600">${s.serial_number}</td></tr>
          `).join("")}
        `;
      }
      return `<tr><td style="padding:8px 12px">${i+1}</td><td>${res.item_name}</td><td style="text-align:center;font-weight:700">${res.transferred_count}</td></tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>ورقة مناقلة</title>
<style>
  body{font-family:Arial,sans-serif;padding:32px;font-size:13px;color:#1E293B}
  h1{font-size:22px;text-align:center;margin-bottom:4px}
  .subtitle{text-align:center;color:#64748B;margin-bottom:24px;font-size:12px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;background:#F8FAFC;padding:16px;border-radius:8px}
  .info-item label{font-size:11px;color:#64748B;display:block;margin-bottom:2px}
  .info-item span{font-weight:700;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  th{background:#1E293B;color:white;padding:8px 12px;text-align:right;font-size:12px}
  td{padding:7px 12px;border-bottom:1px solid #E2E8F0;font-size:12px}
  .summary{background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:14px;text-align:center}
  .summary .count{font-size:28px;font-weight:800;color:#059669}
  .footer{text-align:center;color:#94A3B8;font-size:11px;margin-top:32px;border-top:1px solid #E2E8F0;padding-top:12px}
  @media print{button{display:none}}
</style></head>
<body>
  <h1>ورقة مناقلة مخزون</h1>
  <div class="subtitle">مستند تحويل رسمي</div>
  <div class="info-grid">
    <div class="info-item"><label>التاريخ</label><span>${r.date||""}</span></div>
    <div class="info-item"><label>عدد الأصناف</label><span>${r.total_lines||0} صنف</span></div>
    <div class="info-item"><label>من مستودع</label><span>${r.from_warehouse||""}</span></div>
    <div class="info-item"><label>إلى مستودع</label><span>${r.to_warehouse||""}</span></div>
    ${r.notes ? `<div class="info-item" style="grid-column:1/-1"><label>ملاحظات</label><span>${r.notes}</span></div>` : ""}
  </div>
  <table>
    <thead><tr><th>#</th><th>الصنف</th><th style="text-align:center">الكمية</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="summary">
    <div class="count">${r.total_transferred}</div>
    <div>وحدة / سيريال تم نقلها</div>
  </div>
  ${r.total_errors > 0 ? `<div style="margin-top:12px;color:#DC2626;font-size:12px">تنبيه: ${r.total_errors} عنصر لم يُنقل بسبب أخطاء</div>` : ""}
  <div class="footer">تم الإنشاء بواسطة النظام — ${new Date().toLocaleString("ar-SA")}</div>
  <br><button onclick="window.print()">🖨️ طباعة</button>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  const load = async () => {
    try { const { data: wh } = await getWarehouses(); setWarehouses(wh); }
    catch {} finally { setLoading(false); }
  };

  const loadStock = async (warehouseId?: string) => {
    setLoadingStock(true);
    try { const { data } = await getStockByWarehouse(warehouseId); setStock(data); }
    catch {} finally { setLoadingStock(false); }
  };

  useEffect(() => {
    load(); loadStock();
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

  const totalValue = stock.reduce((s, r) => s + r.stock_value, 0);
  const lowStockCount = stock.filter(r => r.is_low_stock).length;
  const totalItems = new Set(stock.map(r => r.item_id)).size;

  // الأصناف المختارة مسبقاً في أسطر أخرى (لمنع التكرار)
  const usedItemIds = transferLines.map(l => l.item?.id).filter(Boolean);

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
        <button onClick={() => setSelectedWarehouse("")}
          style={{ padding: "10px 16px", borderRadius: 10, border: "2px solid", borderColor: selectedWarehouse === "" ? "var(--primary)" : "var(--border)", background: selectedWarehouse === "" ? "var(--primary)" : "white", color: selectedWarehouse === "" ? "white" : "var(--text-primary)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          {ar ? "كل المستودعات" : "All Warehouses"}
          <span style={{ marginInlineStart: 8, fontSize: 11, opacity: 0.8 }}>({warehouses.length})</span>
        </button>
        {warehouses.map(wh => (
          <button key={wh.id} onClick={() => setSelectedWarehouse(wh.id)}
            style={{ padding: "10px 16px", borderRadius: 10, border: "2px solid", borderColor: selectedWarehouse === wh.id ? "var(--primary)" : "var(--border)", background: selectedWarehouse === wh.id ? "var(--primary)" : "white", color: selectedWarehouse === wh.id ? "white" : "var(--text-primary)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
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
                    <td style={{ textAlign: "end", fontWeight: 600, color: row.available_qty > 0 ? "#059669" : "#DC2626" }}>{fmt(row.available_qty)}</td>
                    <td style={{ textAlign: "end", color: "#7C3AED", fontWeight: 600 }}>{fmt(row.stock_value)} SAR</td>
                    <td>
                      {row.is_low_stock
                        ? <span className="badge badge-danger">{ar ? "منخفض" : "Low Stock"}</span>
                        : <span className="badge badge-success">{ar ? "متاح" : "Available"}</span>}
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

      {/* ═══ Modal تحويل المخزون – متعدد الأصناف ═══ */}
      {showTransferModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 760, maxHeight: "94vh", display: "flex", flexDirection: "column" }} className="animate-slide">

            {/* Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "تحويل بين المستودعات" : "Stock Transfer"}</h2>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {ar ? "نقل أكثر من صنف دفعة واحدة بين مستودعين" : "Move multiple items between warehouses in one operation"}
                </p>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowTransferModal(false); resetTransfer(); }}>✕</button>
            </div>

            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>

              {/* نتيجة التحويل */}
              {transferResult ? (
                <div style={{ padding: "8px 0" }}>
                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <div style={{ fontSize: 48 }}>✅</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#059669", marginTop: 8 }}>
                      {ar ? "تم التحويل بنجاح" : "Transfer Complete"}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                      {transferResult.from_warehouse} → {transferResult.to_warehouse}
                    </div>
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 8 }}>
                      <span style={{ background: "#F0FDF4", color: "#059669", borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 700 }}>
                        {transferResult.total_lines} {ar ? "صنف" : "items"}
                      </span>
                      <span style={{ background: "#EFF6FF", color: "#2563EB", borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 700 }}>
                        {transferResult.total_transferred} {ar ? "وحدة" : "units"}
                      </span>
                      {transferResult.total_errors > 0 && (
                        <span style={{ background: "#FEF2F2", color: "#DC2626", borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 700 }}>
                          {transferResult.total_errors} {ar ? "خطأ" : "errors"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* تفاصيل كل صنف */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    {(transferResult.results || []).map((res: any, i: number) => (
                      <div key={i} style={{ border: `1px solid ${res.success ? "#86EFAC" : "#FCA5A5"}`, borderRadius: 10, padding: "10px 14px", background: res.success ? "#F0FDF4" : "#FEF2F2" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>
                            {res.success ? "✅" : "❌"} {res.item_name}
                          </span>
                          <span style={{ fontSize: 12, color: res.success ? "#059669" : "#DC2626", fontWeight: 600 }}>
                            {res.success
                              ? `${res.transferred_count} ${res.tracking_type === "serial" ? (ar ? "سيريال" : "serials") : (ar ? "وحدة" : "units")}`
                              : res.error}
                          </span>
                        </div>
                        {res.tracking_type === "serial" && res.transferred?.length > 0 && (
                          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {res.transferred.map((s: any) => (
                              <code key={s.serial_id} style={{ background: "white", border: "1px solid #BBF7D0", borderRadius: 4, padding: "2px 6px", fontSize: 11 }}>
                                {s.serial_number}
                              </code>
                            ))}
                          </div>
                        )}
                        {res.errors?.length > 0 && (
                          <div style={{ marginTop: 4, fontSize: 11, color: "#DC2626" }}>
                            {res.errors.map((e: any) => e.error || e.serial_number).join(" • ")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    <button className="btn btn-primary" onClick={printTransfer}>
                      🖨️ {ar ? "طباعة ورقة المناقلة" : "Print Transfer PDF"}
                    </button>
                    <button className="btn btn-secondary" onClick={() => { setShowTransferModal(false); resetTransfer(); }}>
                      {ar ? "إغلاق" : "Close"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* 1. المستودعان – في الأعلى دائماً */}
                  <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10 }}>
                      {ar ? "اتجاه التحويل" : "Transfer Direction"}
                    </div>
                    <div className="grid-2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">{ar ? "من مستودع" : "From"} <span className="required">*</span></label>
                        <select className="form-input form-select" value={transferFromWh}
                          onChange={e => {
                            setTransferFromWh(e.target.value);
                            // إعادة جلب السيريالات لكل السطور
                            setTransferLines(prev => prev.map(l => ({ ...l, availableSerials: [], selectedSerials: [] })));
                            transferLines.forEach(l => { if (l.item?.tracking_type === "serial") fetchSerials(l.id, l.item, e.target.value); });
                          }}>
                          <option value="">— {ar ? "اختر" : "Select"} —</option>
                          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">{ar ? "إلى مستودع" : "To"} <span className="required">*</span></label>
                        <select className="form-input form-select" value={transferToWh} onChange={e => setTransferToWh(e.target.value)}>
                          <option value="">— {ar ? "اختر" : "Select"} —</option>
                          {warehouses.filter(w => w.id !== transferFromWh).map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 2. قائمة الأصناف */}
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{ar ? "الأصناف المُحوَّلة" : "Items to Transfer"}</span>
                    <span style={{ background: "#2563EB", color: "white", borderRadius: 20, padding: "1px 10px", fontSize: 11 }}>
                      {transferLines.filter(l => l.item).length} {ar ? "صنف" : "items"}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                    {transferLines.map((line, idx) => (
                      <div key={line.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14, background: line.item ? "#FAFBFF" : "white" }}>
                        {/* رأس السطر */}
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: line.item ? 10 : 0 }}>
                          <div style={{ flex: 1 }}>
                            <select className="form-input form-select" style={{ fontSize: 13 }}
                              value={line.item?.id || ""}
                              onChange={e => {
                                const chosen = items.find((x: any) => x.id === e.target.value) || null;
                                updateLine(line.id, { item: chosen, quantity: "", selectedSerials: [], availableSerials: [], validationResult: null });
                                if (chosen && transferFromWh) fetchSerials(line.id, chosen, transferFromWh);
                              }}>
                              <option value="">— {ar ? "اختر الصنف" : "Select Item"} —</option>
                              {items.map((i: any) => {
                                const alreadyUsed = usedItemIds.includes(i.id) && line.item?.id !== i.id;
                                return (
                                  <option key={i.id} value={i.id} disabled={alreadyUsed}>
                                    {i.name_ar} ({i.sku}) {i.tracking_type === "serial" ? "🔱" : "📦"} {alreadyUsed ? "✓" : ""}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* حقل الكمية – للأصناف العادية فقط */}
                          {line.item && line.item.tracking_type !== "serial" && (
                            <input type="number" className="form-input" style={{ width: 110, fontSize: 13 }}
                              value={line.quantity} onChange={e => updateLine(line.id, { quantity: e.target.value })}
                              min="0.001" step="0.001" placeholder={ar ? "الكمية" : "Qty"} />
                          )}

                          {/* حذف السطر */}
                          {transferLines.length > 1 && (
                            <button className="btn btn-ghost btn-icon" style={{ color: "#DC2626", flexShrink: 0 }}
                              onClick={() => setTransferLines(prev => prev.filter(l => l.id !== line.id))}>
                              🗑
                            </button>
                          )}
                        </div>

                        {/* اختيار السيريالات */}
                        {line.item?.tracking_type === "serial" && (
                          <div style={{ marginTop: 4 }}>
                            {!transferFromWh ? (
                              <div style={{ fontSize: 12, color: "#92400E", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 6, padding: "6px 10px" }}>
                                💡 {ar ? "اختر 'من مستودع' أولاً لعرض السيريالات" : "Select 'From Warehouse' first"}
                              </div>
                            ) : line.loadingSerials ? (
                              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 0" }}>
                                {ar ? "جاري تحميل السيريالات..." : "Loading serials..."}
                              </div>
                            ) : (
                              <>
                                {/* تبويبات اختيار السيريال */}
                                <div style={{ display: "flex", borderBottom: "2px solid var(--border)", marginBottom: 10 }}>
                                  {([
                                    { key: "list" as const, label: ar ? "📋 من القائمة" : "📋 List" },
                                    { key: "paste" as const, label: ar ? "📄 لصق / Excel" : "📄 Paste / Excel" },
                                  ]).map(t => (
                                    <button key={t.key} onClick={() => updateLine(line.id, { serialTab: t.key })}
                                      style={{ flex: 1, padding: "6px", background: "none", border: "none", borderBottom: line.serialTab === t.key ? "2px solid var(--primary)" : "2px solid transparent", color: line.serialTab === t.key ? "var(--primary)" : "var(--text-secondary)", fontWeight: line.serialTab === t.key ? 700 : 500, fontSize: 11, cursor: "pointer", marginBottom: -2 }}>
                                      {t.label}
                                    </button>
                                  ))}
                                </div>

                                {/* قائمة السيريالات */}
                                {line.serialTab === "list" && (
                                  <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                                        {ar ? "متاح:" : "Available:"} <b>{line.availableSerials.length}</b>
                                        {line.selectedSerials.length > 0 && (
                                          <span style={{ color: "#059669", marginInlineStart: 8 }}>
                                            ✅ {line.selectedSerials.length} {ar ? "مختار" : "selected"}
                                          </span>
                                        )}
                                      </span>
                                      <div style={{ display: "flex", gap: 4 }}>
                                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: "2px 8px" }}
                                          onClick={() => updateLine(line.id, { selectedSerials: line.availableSerials.map((s: any) => s.id) })}>
                                          {ar ? "الكل" : "All"}
                                        </button>
                                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: "2px 8px" }}
                                          onClick={() => updateLine(line.id, { selectedSerials: [] })}>
                                          {ar ? "إلغاء" : "Clear"}
                                        </button>
                                      </div>
                                    </div>
                                    {line.availableSerials.length === 0 ? (
                                      <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "10px 0" }}>
                                        {ar ? "لا توجد سيريالات في المستودع المصدر" : "No serials in source warehouse"}
                                      </div>
                                    ) : (
                                      <div style={{ maxHeight: 160, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                                        {line.availableSerials.map((s: any) => {
                                          const checked = line.selectedSerials.includes(s.id);
                                          return (
                                            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 6, border: `1px solid ${checked ? "var(--primary)" : "var(--border)"}`, background: checked ? "#EFF6FF" : "white", cursor: "pointer", fontSize: 11 }}>
                                              <input type="checkbox" checked={checked}
                                                onChange={e => updateLine(line.id, { selectedSerials: e.target.checked ? [...line.selectedSerials, s.id] : line.selectedSerials.filter(x => x !== s.id) })} />
                                              <code style={{ fontWeight: 700, fontSize: 10 }}>{s.serial_number}</code>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* لصق من Excel */}
                                {line.serialTab === "paste" && (
                                  <div>
                                    <textarea className="form-input" style={{ width: "100%", minHeight: 80, fontFamily: "monospace", fontSize: 11, direction: "ltr" }}
                                      value={line.pasteSerials}
                                      onChange={e => updateLine(line.id, { pasteSerials: e.target.value })}
                                      placeholder={"356789012345678\n356789012345679\n..."} />
                                    <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}
                                        disabled={line.validating || !line.pasteSerials.trim() || !transferFromWh}
                                        onClick={async () => {
                                          const sns = line.pasteSerials.split(/[\r\n\t,;]+/).map(s => s.trim()).filter(s => s.length >= 8);
                                          if (!sns.length) return;
                                          updateLine(line.id, { validating: true, validationResult: null });
                                          try {
                                            const { data } = await validateSerials({ serial_numbers: sns, warehouse_id: transferFromWh });
                                            updateLine(line.id, {
                                              validating: false, validationResult: data,
                                              selectedSerials: data.found?.length ? data.found.map((f: any) => f.serial_id) : line.selectedSerials,
                                            });
                                          } catch { updateLine(line.id, { validating: false }); }
                                        }}>
                                        {line.validating ? "..." : (ar ? "🔍 تحقق" : "🔍 Validate")}
                                      </button>
                                      {line.validationResult && (
                                        <span style={{ fontSize: 11 }}>
                                          <span style={{ color: "#059669", fontWeight: 700 }}>✅ {line.validationResult.found?.length}</span>
                                          {line.validationResult.not_found?.length > 0 && (
                                            <span style={{ color: "#DC2626", marginInlineStart: 6, fontWeight: 700 }}>❌ {line.validationResult.not_found.length}</span>
                                          )}
                                          {line.validationResult.wrong_warehouse?.length > 0 && (
                                            <span style={{ color: "#D97706", marginInlineStart: 6, fontWeight: 700 }}>⚠️ {line.validationResult.wrong_warehouse.length}</span>
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* زر إضافة صنف */}
                  <button className="btn btn-secondary btn-sm" style={{ width: "100%", marginBottom: 16 }}
                    onClick={() => setTransferLines(prev => [...prev, emptyLine()])}>
                    ＋ {ar ? "إضافة صنف آخر" : "Add Another Item"}
                  </button>

                  {/* ملاحظات */}
                  <div className="form-group">
                    <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
                    <input className="form-input" value={transferNotes} onChange={e => setTransferNotes(e.target.value)}
                      placeholder={ar ? "سبب التحويل..." : "Transfer reason..."} />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!transferResult && (
              <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {transferLines.filter(l => l.item).length > 0 && (
                    <span>
                      {transferLines.filter(l => l.item).length} {ar ? "صنف جاهز للنقل" : "items ready"}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => { setShowTransferModal(false); resetTransfer(); }}>{ar ? "إلغاء" : "Cancel"}</button>
                  <button className="btn btn-primary" onClick={handleTransfer} disabled={saving}>
                    {saving ? (ar ? "جاري التحويل..." : "Transferring...") : (ar ? "↔ تحويل الكل" : "↔ Transfer All")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
