"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getItems, getCategories, getWarehouses, updateItem, deleteItem } from "@/lib/inventory";
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
  { value: "quantity", ar: "كمية",     en: "Quantity",  badge: "badge-info",    desc: "" },
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
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [company, setCompany] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTracking, setFilterTracking] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogFields, setCatalogFields] = useState({
    image: true, name: true, sku: true, barcode: false, price: true,
    category: true, quantity: false, description: false, color: false,
  });

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
    getWarehouses().then(({ data }) => setWarehouses(Array.isArray(data) ? data : (data?.items || []))).catch(() => {});
    getCompany().then(({ data }) => setCompany(data || {})).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [filterTracking, filterCategory, filterLowStock]);

  const handleEdit = (item: any) => {
    setEditItem(item);
    const fallbackWarehouse = (warehouses || []).find((w: any) => w.is_default)?.id || warehouses?.[0]?.id || "";
    setEditForm({
      name_ar: item.name_ar, name_en: item.name_en || "",
      barcode: item.barcode || "", category_id: item.category_id || "",
      sale_price: item.sale_price, cost_price: item.cost_price,
      vat_rate: item.vat_rate, reorder_point: item.reorder_point,
      color: item.color || "", storage: item.storage || "",
      pos_enabled: item.pos_enabled === true,
      store_enabled: item.store_enabled === true,
      default_warehouse_id: item.default_warehouse_id || fallbackWarehouse,
      is_active: item.is_active,
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.name_ar) return alert(ar ? "الاسم مطلوب" : "Name required");
    setSaving(true);
    try {
      const selectedWarehouse = editForm.default_warehouse_id || (
        editForm.pos_enabled && editItem.tracking_type !== "serial"
          ? ((warehouses || []).find((w: any) => w.is_default)?.id || warehouses?.[0]?.id || null)
          : null
      );
      const saved = await updateItem(editItem.id, {
        ...editForm,
        pos_enabled: Boolean(editForm.pos_enabled),
        store_enabled: Boolean(editForm.store_enabled),
        sale_price: parseFloat(editForm.sale_price) || 0,
        cost_price: parseFloat(editForm.cost_price) || 0,
        vat_rate: parseFloat(editForm.vat_rate) || 15,
        reorder_point: parseFloat(editForm.reorder_point) || 0,
        default_warehouse_id: selectedWarehouse,
        category_id: editForm.category_id || null,
        color: editForm.color || null,
        storage: editForm.storage || null,
      });
      if (saved?.data?.pos_enabled === false && editForm.pos_enabled) {
        throw new Error(ar ? "لم يتم حفظ تفعيل نقطة البيع" : "POS setting was not saved");
      }
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

  const exportCatalog = () => {
    const selected = items.filter(item => selectedIds.includes(item.id));
    if (!selected.length) return alert(ar ? "حدد منتجًا واحدًا على الأقل" : "Select at least one product");
    const esc = (value: any) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
    const imageOf = (item: any) => {
      try {
        const parsed = item.store_images_json ? JSON.parse(item.store_images_json) : [];
        return Array.isArray(parsed) ? parsed[0] : (typeof parsed === "string" ? parsed : "");
      } catch { return ""; }
    };
    const field = (item: any, key: string, label: string, value: any) => catalogFields[key as keyof typeof catalogFields] ? `<div class="field"><b>${label}</b><span>${esc(value || "—")}</span></div>` : "";
    const cards = selected.map(item => `
      <article class="product-card">
        ${catalogFields.image ? `<div class="image-box">${imageOf(item) ? `<img src="${esc(imageOf(item))}" alt="${esc(item.name_ar)}" />` : `<span>مسار</span>`}</div>` : ""}
        <div class="product-body">
          ${catalogFields.name ? `<h2>${esc(item.name_ar)}</h2>${item.name_en ? `<div class="en-name">${esc(item.name_en)}</div>` : ""}` : ""}
          ${field(item, "sku", "SKU", item.sku)}
          ${field(item, "barcode", ar ? "الباركود" : "Barcode", item.barcode)}
          ${field(item, "price", ar ? "سعر البيع شامل الضريبة" : "Sale price incl. VAT", item.sale_price ? `${fmt(item.sale_price)} SAR` : "—")}
          ${field(item, "category", ar ? "التصنيف" : "Category", item.category?.name_ar)}
          ${field(item, "quantity", ar ? "المتاح" : "Available", item.quantity_on_hand)}
          ${field(item, "color", ar ? "اللون / السعة" : "Color / Storage", [item.color, item.storage].filter(Boolean).join(" / "))}
          ${catalogFields.description && item.description_ar ? `<p class="description">${esc(item.description_ar)}</p>` : ""}
        </div>
      </article>`).join("");
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>كتالوج المنتجات</title><style>
      *{box-sizing:border-box}body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#24152d;background:#fff;margin:0;padding:12mm}header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #5a187e;padding-bottom:12px;margin-bottom:18px}header img{width:76px;height:76px;object-fit:contain}header h1{margin:0;color:#5a187e;font-size:25px}header p{margin:4px 0 0;color:#6b7280;font-size:12px}.catalog-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.product-card{border:1px solid #ded4e5;border-radius:10px;overflow:hidden;break-inside:avoid;background:#fff;box-shadow:0 2px 7px #32104412}.image-box{height:145px;background:#faf7fc;display:flex;align-items:center;justify-content:center;border-bottom:1px solid #eee}.image-box img{width:100%;height:100%;object-fit:contain;padding:8px}.image-box span{font-size:22px;font-weight:700;color:#5a187e}.product-body{padding:10px}.product-body h2{font-size:15px;margin:0;color:#351044;line-height:1.35}.en-name{font-size:10px;color:#777;margin-top:2px;direction:ltr;text-align:right}.field{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed #eee;padding:4px 0;font-size:10px}.field b{color:#777;font-weight:500}.field span{font-weight:700;text-align:left}.description{font-size:10px;color:#555;line-height:1.5;margin:7px 0 0}footer{margin-top:18px;border-top:1px solid #ddd;padding-top:8px;color:#777;font-size:10px;text-align:center}@media print{@page{size:A4 portrait;margin:10mm}body{padding:0}.product-card{box-shadow:none}.catalog-grid{gap:8px}}
    </style></head><body><header>${company.logo_data ? `<img src="${esc(company.logo_data)}" alt="الشعار" />` : ""}<div><h1>${esc(company.name || "مسار")}</h1><p>كتالوج المنتجات — ${selected.length} صنف — ${new Date().toLocaleDateString("ar-SA")}</p></div></header><main class="catalog-grid">${cards}</main><footer>${esc(company.vat_number ? `الرقم الضريبي: ${company.vat_number}` : "مسار ERP")}</footer></body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html); win.document.close();
    win.onload = () => setTimeout(() => win.print(), 300);
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href={`/${locale}/inventory/adjustments`} className="btn btn-primary">
            <Icon name="check" size={16} /> {ar ? "بدء جرد المخزون" : "Start Stock Count"}
          </Link>
          {/* زر إضافة سيريالات — يظهر فقط لنشاط الجوالات */}
          <SerialsButton locale={locale} ar={ar} />
          <button className="btn btn-secondary" onClick={() => setCatalogOpen(true)} title={ar ? "إنشاء كتالوج" : "Create catalog"} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="12" x2="12" y2="18"/>
              <polyline points="9 15 12 18 15 15"/>
            </svg>
            {ar ? `كتالوج PDF${selectedIds.length ? ` (${selectedIds.length})` : ""}` : `PDF Catalog${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
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
                  <th style={{ width: 42 }}><input type="checkbox" checked={items.length > 0 && items.every(item => selectedIds.includes(item.id))} onChange={e => setSelectedIds(e.target.checked ? items.map(item => item.id) : [])} /></th>
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
                      <td><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={e => setSelectedIds(ids => e.target.checked ? [...new Set([...ids, item.id])] : ids.filter(id => id !== item.id))} /></td>
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
                        {tracking?.desc && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{tracking.desc}</div>}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.category?.name_ar || "—"}</td>
                      <td style={{ textAlign: "end" }}>
                        {item.tracking_type === "serial" ? (
                          <span style={{ color: "#6F4A84", fontWeight: 600 }}>
                            {Number(item.serial_count ?? item.quantity_on_hand ?? 0).toLocaleString("en-US")} {ar ? "سيريال" : "serials"}
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
      {catalogOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 210, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{ar ? "إعداد كتالوج المنتجات" : "Product catalog settings"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setCatalogOpen(false)}>✕</button>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 0 }}>{ar ? `سيتم تصدير ${selectedIds.length} منتج محدد` : `${selectedIds.length} selected products will be exported`}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "18px 0" }}>
              {([
                ["image", ar ? "صورة المنتج" : "Product image"], ["name", ar ? "اسم المنتج" : "Product name"],
                ["sku", "SKU"], ["barcode", ar ? "الباركود" : "Barcode"], ["price", ar ? "سعر البيع" : "Sale price"],
                ["category", ar ? "التصنيف" : "Category"], ["quantity", ar ? "الكمية" : "Quantity"],
                ["color", ar ? "اللون والسعة" : "Color / Storage"], ["description", ar ? "الوصف" : "Description"],
              ] as const).map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={catalogFields[key]} onChange={e => setCatalogFields(fields => ({ ...fields, [key]: e.target.checked }))} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setCatalogOpen(false)}>{ar ? "إلغاء" : "Cancel"}</button>
              <button className="btn btn-primary" onClick={() => { setCatalogOpen(false); setTimeout(exportCatalog, 0); }}>{ar ? "طباعة الكتالوج" : "Print catalog"}</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal التعديل */}
      {editItem && (
        <EditItemModal
          item={editItem} form={editForm} setForm={setEditForm}
          onSave={handleSaveEdit} onClose={() => setEditItem(null)}
          saving={saving} ar={ar} categories={categories} warehouses={warehouses}
        />
      )}
    </>
  );
}

// ── Modal تعديل الصنف ─────────────────────────────────────────────────
// هذا المكون منفصل لتجنب تعقيد الصفحة الرئيسية
function EditItemModal({ item, form, setForm, onSave, onClose, saving, ar, categories, warehouses }: any) {
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
            <div style={{ marginTop: 4, padding: "8px 10px", border: "1px solid #D5C8DD", background: "#F7F2F8", color: "#6F4A84", fontSize: 12, lineHeight: 1.7 }}>
              {ar
                ? "بطاقة الصنف هي المرجع الموحد. عند الحفظ تُطبّق تكلفة وسعر البيع على كل السيريالات المتاحة في المخزون، ولا تتغير تكلفة أو ربح الأجهزة المباعة سابقاً."
                : "The item card is the unified source. Saving applies cost and sale price to all in-stock serials without changing historical cost or profit for sold units."}
            </div>
          )}
          {!isSerial && (
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "نقطة إعادة الطلب" : "Reorder Point"}</label>
                <input type="number" className="form-input" value={form.reorder_point}
                  onChange={e => setForm((f: any) => ({ ...f, reorder_point: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "مستودع الكمية" : "Quantity warehouse"}</label>
                <select className="form-input form-select" value={form.default_warehouse_id || ""}
                  onChange={e => setForm((f: any) => ({ ...f, default_warehouse_id: e.target.value }))}>
                  <option value="">{ar ? "اختر المستودع" : "Select warehouse"}</option>
                  {(warehouses || []).map((w: any) => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                </select>
              </div>
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
