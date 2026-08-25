"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getItems, getCategories, updateItem, deleteItem } from "@/lib/inventory";
import { getCompany } from "@/lib/settings";
import { Icon } from "@/components/ui/Icons";

// زر إضافة سيريالات — يظهر فقط لنشاط الجوالات وقطع الغيار
function SerialsButton({ locale, ar }: { locale: string; ar: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    getCompany().then(({ data }) => {
      setShow(["mobile_phones", "spare_parts"].includes(data?.business_type || ""));
    }).catch(() => {});
  }, []);
  if (!show) return null;
  return (
    <Link href={`/${locale}/inventory/serials`} className="btn btn-secondary">
      <Icon name="receipt" size={16} /> {ar ? "إضافة سيريالات" : "Add Serials"}
    </Link>
  );
}

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const TRACKING_TYPES = [
  { value: "quantity", ar: "كمية",     en: "Quantity",  badge: "badge-info",    desc: "بقالات، عطارات" },
  { value: "serial",   ar: "سيريال",   en: "Serial",    badge: "badge-success", desc: "جوالات، إلكترونيات" },
  { value: "batch",    ar: "تشغيلة",   en: "Batch",     badge: "badge-warning", desc: "صيدليات" },
  { value: "variant",  ar: "متغيرات",  en: "Variants",  badge: "badge-gray",    desc: "ملابس، أحذية" },
  { value: "weight",   ar: "وزن",      en: "Weight",    badge: "badge-info",    desc: "عطارات، ذهب" },
];

export default function ItemsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTracking, setFilterTracking] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const params: any = {};
      if (search) params.search = search;
      if (filterTracking) params.tracking_type = filterTracking;
      if (filterCategory) params.category_id = filterCategory;
      if (filterLowStock) params.low_stock = true;
      const { data } = await getItems(params);
      setItems(data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    getCategories().then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [filterTracking, filterCategory, filterLowStock]);

  const handleEdit = (item: any) => {
    setEditItem(item);
    setEditForm({
      name_ar: item.name_ar, name_en: item.name_en || "",
      barcode: item.barcode || "", category_id: item.category_id || "",
      sale_price: item.sale_price, cost_price: item.cost_price,
      vat_rate: item.vat_rate, reorder_point: item.reorder_point,
      color: item.color || "", storage: item.storage || "",
      pos_enabled: item.pos_enabled, store_enabled: item.store_enabled,
      is_active: item.is_active,
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.name_ar) return alert(ar ? "الاسم مطلوب" : "Name required");
    setSaving(true);
    try {
      await updateItem(editItem.id, {
        ...editForm,
        sale_price: parseFloat(editForm.sale_price) || 0,
        cost_price: parseFloat(editForm.cost_price) || 0,
        vat_rate: parseFloat(editForm.vat_rate) || 15,
        reorder_point: parseFloat(editForm.reorder_point) || 0,
        category_id: editForm.category_id || null,
        color: editForm.color || null,
        storage: editForm.storage || null,
      });
      setEditItem(null);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item: any) => {
    if (!confirm(ar ? `حذف "${item.name_ar}"؟ لا يمكن التراجع.` : `Delete "${item.name_ar}"? This cannot be undone.`)) return;
    try {
      await deleteItem(item.id);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
  };

  const exportToPDF = () => {
    const filtered = items.filter(item => {
      const q = search.toLowerCase();
      return !q || item.name_ar?.toLowerCase().includes(q) || item.sku?.toLowerCase().includes(q) || item.barcode?.toLowerCase().includes(q);
    });

    const rows = filtered.map(item => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${item.sku || "—"}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px">${item.barcode || "—"}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500">${item.name_ar || ""}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${item.name_en || ""}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
    <head><meta charset="UTF-8"><title>${ar ? "قائمة الأصناف" : "Items List"}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      .sub { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      thead tr { background: #587795; color: white; }
      thead th { padding: 8px 10px; font-size: 12px; font-weight: 700; text-align: start; }
      tbody tr:nth-child(even) { background: #f9fafb; }
      @media print {
        @page { margin: 15mm; size: A4 portrait; }
        body { padding: 0; }
      }
    </style></head>
    <body>
      <h1>${ar ? "قائمة الأصناف" : "Items List"}</h1>
      <p class="sub">${ar ? "الإجمالي:" : "Total:"} ${filtered.length} ${ar ? "صنف" : "items"} — ${new Date().toLocaleDateString("ar-SA")}</p>
      <table>
        <thead><tr>
          <th>SKU</th>
          <th>${ar ? "الباركود" : "Barcode"}</th>
          <th>${ar ? "اسم الصنف" : "Item Name"}</th>
          <th>${ar ? "الاسم بالإنجليزي" : "English Name"}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); };
  };

  const getTrackingInfo = (type: string) => TRACKING_TYPES.find(t => t.value === type);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/inventory`}>{ar ? "المخزون" : "Inventory"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الأصناف" : "Items"}</span>
          </div>
          <h1 className="page-title">{ar ? "الأصناف" : "Inventory Items"}</h1>
          <p className="page-subtitle">{ar ? "إدارة المنتجات والأصناف بجميع أنواع التتبع" : "Manage products with all tracking types"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* زر إضافة سيريالات — يظهر فقط لنشاط الجوالات */}
          <SerialsButton locale={locale} ar={ar} />
          <button className="btn btn-secondary" onClick={exportToPDF} title={ar ? "تصدير PDF" : "Export PDF"} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="12" x2="12" y2="18"/>
              <polyline points="9 15 12 18 15 15"/>
            </svg>
            {ar ? "تصدير PDF" : "Export PDF"}
          </button>
          <Link href={`/${locale}/inventory/items/new`} className="btn btn-primary">
            <Icon name="plus" size={16} /> {ar ? "+ صنف جديد" : "+ New Item"}
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input className="form-input" style={{ width: 240 }}
            placeholder={ar ? "بحث بالاسم أو الباركود..." : "Search by name or barcode..."}
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load()} />
          <select className="form-input form-select" style={{ width: 160 }} value={filterTracking} onChange={e => setFilterTracking(e.target.value)}>
            <option value="">{ar ? "كل أنواع التتبع" : "All Types"}</option>
            {TRACKING_TYPES.map(t => <option key={t.value} value={t.value}>{ar ? t.ar : t.en}</option>)}
          </select>
          <select className="form-input form-select" style={{ width: 180 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">{ar ? "كل التصنيفات" : "All Categories"}</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={filterLowStock} onChange={e => setFilterLowStock(e.target.checked)} />
            {ar ? "منخفض المخزون فقط" : "Low stock only"}
          </label>
          <button className="btn btn-secondary btn-sm" onClick={load}>{ar ? "بحث" : "Search"}</button>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {items.length} {ar ? "صنف" : "items"}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : items.length === 0 ? (            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}>
                <Icon name="inventory" size={24} />
              </div>
              <div className="empty-state-title">{ar ? "لا توجد أصناف" : "No items found"}</div>
              <Link href={`/${locale}/inventory/items/new`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                {ar ? "إضافة صنف جديد" : "Add New Item"}
              </Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الصنف" : "Item"}</th>
                  <th>{ar ? "SKU / الباركود" : "SKU / Barcode"}</th>
                  <th>{ar ? "نوع التتبع" : "Tracking"}</th>
                  <th>{ar ? "التصنيف" : "Category"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الكمية / السيريالات" : "Qty / Serials"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "سعر البيع" : "Sale Price"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const tracking = getTrackingInfo(item.tracking_type);
                  const isLow = item.tracking_type === "quantity" && Number(item.quantity_on_hand) <= Number(item.reorder_point);
                  return (
                    <tr key={item.id} style={isLow ? { background: "#FFF5F5" } : {}}>
                      <td>
                        <Link href={`/${locale}/inventory/items/${item.id}`} style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>
                          {item.name_ar}
                        </Link>
                        {item.name_en && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.name_en}</div>}
                      </td>
                      <td style={{ fontSize: 12, fontFamily: "monospace" }}>
                        {item.sku && <div>{item.sku}</div>}
                        {item.barcode && <div style={{ color: "var(--text-muted)" }}>{item.barcode}</div>}
                      </td>
                      <td>
                        <span className={`badge ${tracking?.badge || "badge-gray"}`}>
                          {ar ? tracking?.ar : tracking?.en}
                        </span>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{tracking?.desc}</div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.category?.name_ar || "—"}</td>
                      <td style={{ textAlign: "end" }}>
                        {item.tracking_type === "serial" ? (
                          <span style={{ color: "#059669", fontWeight: 600 }}>
                            {ar ? "سيريالات" : "Serials"}
                          </span>
                        ) : (
                          <span style={{ fontWeight: 600, color: isLow ? "var(--danger)" : "var(--text-primary)" }}>
                            {fmt(item.quantity_on_hand)}
                            {isLow && <span style={{ fontSize: 10, display: "block", color: "var(--danger)" }}>{ar ? "منخفض" : "Low"}</span>}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(item.sale_price)} SAR</td>
                      <td>
                        <span className={`badge ${item.is_active ? "badge-success" : "badge-gray"}`}>
                          {item.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Link href={`/${locale}/inventory/items/${item.id}`} className="btn btn-ghost btn-sm btn-icon" title={ar ? "عرض" : "View"}>
                            <Icon name="view" size={14} />
                          </Link>
                          <button className="btn btn-ghost btn-sm btn-icon" title={ar ? "تعديل" : "Edit"}
                            onClick={() => handleEdit(item)}>
                            <Icon name="edit" size={14} />
                          </button>
                          <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "var(--danger)" }}
                            title={ar ? "حذف" : "Delete"} onClick={() => handleDelete(item)}>
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {/* Modal التعديل */}
      {editItem && (
        <EditItemModal
          item={editItem} form={editForm} setForm={setEditForm}
          onSave={handleSaveEdit} onClose={() => setEditItem(null)}
          saving={saving} ar={ar} categories={categories}
        />
      )}
    </>
  );
}

// ── Modal تعديل الصنف ─────────────────────────────────────────────────
// هذا المكون منفصل لتجنب تعقيد الصفحة الرئيسية
function EditItemModal({ item, form, setForm, onSave, onClose, saving, ar, categories }: any) {
  if (!item) return null;
  const isSerial = item.tracking_type === "serial";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", display: "flex", flexDirection: "column" }} className="animate-slide">
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "تعديل الصنف" : "Edit Item"}</h2>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{item.name_ar}</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{ar ? "الاسم بالعربي" : "Arabic Name"} <span className="required">*</span></label>
              <input className="form-input" value={form.name_ar} onChange={e => setForm((f: any) => ({ ...f, name_ar: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "الاسم بالإنجليزي" : "English Name"}</label>
              <input className="form-input" value={form.name_en} onChange={e => setForm((f: any) => ({ ...f, name_en: e.target.value }))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{ar ? "الباركود" : "Barcode"}</label>
              <input className="form-input" value={form.barcode} onChange={e => setForm((f: any) => ({ ...f, barcode: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "التصنيف" : "Category"}</label>
              <select className="form-input form-select" value={form.category_id} onChange={e => setForm((f: any) => ({ ...f, category_id: e.target.value }))}>
                <option value="">{ar ? "— بدون تصنيف —" : "— No Category —"}</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </div>
          </div>
          {/* اللون والسعة للجوالات */}
          {(item.tracking_type === "serial") && (
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "اللون" : "Color"}</label>
                <input className="form-input" value={form.color} onChange={e => setForm((f: any) => ({ ...f, color: e.target.value }))} placeholder={ar ? "أسود، أبيض..." : "Black, White..."} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "السعة" : "Storage"}</label>
                <input className="form-input" value={form.storage} onChange={e => setForm((f: any) => ({ ...f, storage: e.target.value }))} placeholder="128GB, 256GB..." />
              </div>
            </div>
          )}
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">
                {isSerial ? (ar ? "سعر التكلفة الموحد" : "Unified Cost Price") : (ar ? "سعر التكلفة" : "Cost Price")}
              </label>
              <input type="number" className="form-input" value={form.cost_price}
                onFocus={e => (e.target as HTMLInputElement).select()}
                placeholder="0.00"
                min="0" step="0.01"
                onChange={e => setForm((f: any) => ({ ...f, cost_price: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{isSerial ? (ar ? "سعر البيع الموحد" : "Unified Sale Price") : (ar ? "سعر البيع" : "Sale Price")}</label>
              <input type="number" className="form-input" value={form.sale_price}
                onFocus={e => (e.target as HTMLInputElement).select()}
                placeholder="0.00"
                min="0" step="0.01"
                onChange={e => setForm((f: any) => ({ ...f, sale_price: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "ضريبة %" : "VAT %"}</label>
              <select className="form-input form-select" value={form.vat_rate} onChange={e => setForm((f: any) => ({ ...f, vat_rate: e.target.value }))}>
                <option value="15">15%</option>
                <option value="0">0%</option>
              </select>
            </div>
          </div>
          {isSerial && (
            <div style={{ marginTop: 4, padding: "8px 10px", border: "1px solid #B8D5C8", background: "#F2F8F3", color: "#15543E", fontSize: 12, lineHeight: 1.7 }}>
              {ar
                ? "بطاقة الصنف هي المرجع الموحد. عند الحفظ تُطبّق تكلفة وسعر البيع على كل السيريالات المتاحة في المخزون، ولا تتغير تكلفة أو ربح الأجهزة المباعة سابقاً."
                : "The item card is the unified source. Saving applies cost and sale price to all in-stock serials without changing historical cost or profit for sold units."}
            </div>
          )}
          {!isSerial && (
            <div className="form-group">
              <label className="form-label">{ar ? "نقطة إعادة الطلب" : "Reorder Point"}</label>
              <input type="number" className="form-input" style={{ maxWidth: 160 }} value={form.reorder_point}
                onChange={e => setForm((f: any) => ({ ...f, reorder_point: e.target.value }))} />
            </div>
          )}
          <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={form.pos_enabled} onChange={e => setForm((f: any) => ({ ...f, pos_enabled: e.target.checked }))} />
              {ar ? "نقطة البيع" : "POS"}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={form.store_enabled} onChange={e => setForm((f: any) => ({ ...f, store_enabled: e.target.checked }))} />
              {ar ? "المتجر الإلكتروني" : "Online Store"}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))} />
              {ar ? "نشط" : "Active"}
            </label>
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التعديلات" : "Save Changes")}
          </button>
        </div>
      </div>
    </div>
  );
}
