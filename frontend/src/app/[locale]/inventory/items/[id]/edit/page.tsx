"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getItem, getCategories, updateItem } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";

export default function EditItemPage({ params: { locale, id } }: { params: { locale: string; id: string } }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [item, setItem] = useState<any>(null);
  const [form, setForm] = useState<any>({
    name_ar: "", name_en: "", barcode: "", category_id: "",
    sale_price: "", cost_price: "", vat_rate: "15",
    reorder_point: "", color: "", storage: "",
    pos_enabled: true, store_enabled: false, is_active: true,
  });

  useEffect(() => {
    Promise.all([getItem(id), getCategories()])
      .then(([itemRes, catRes]) => {
        const i = itemRes.data;
        setItem(i);
        setCategories(catRes.data);
        setForm({
          name_ar: i.name_ar || "",
          name_en: i.name_en || "",
          barcode: i.barcode || "",
          category_id: i.category_id || "",
          sale_price: i.sale_price ?? "",
          cost_price: i.cost_price ?? "",
          vat_rate: i.vat_rate ?? "15",
          reorder_point: i.reorder_point ?? "",
          color: i.color || "",
          storage: i.storage || "",
          pos_enabled: i.pos_enabled ?? true,
          store_enabled: i.store_enabled ?? false,
          is_active: i.is_active ?? true,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!form.name_ar) return alert(ar ? "الاسم بالعربي مطلوب" : "Arabic name is required");
    setSaving(true);
    try {
      await updateItem(id, {
        ...form,
        sale_price: parseFloat(form.sale_price) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        vat_rate: parseFloat(form.vat_rate) || 15,
        reorder_point: parseFloat(form.reorder_point) || 0,
        category_id: form.category_id || null,
        color: form.color || null,
        storage: form.storage || null,
      });
      router.push(`/${locale}/inventory/items/${id}`);
    } catch (e: any) {
      alert(e?.response?.data?.detail || (ar ? "حدث خطأ" : "An error occurred"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-title">{ar ? "الصنف غير موجود" : "Item not found"}</div>
      </div>
    );
  }

  const isSerial = item.tracking_type === "serial";

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/inventory/items`}>{ar ? "الأصناف" : "Items"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/inventory/items/${id}`}>{item.name_ar}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "تعديل" : "Edit"}</span>
          </div>
          <h1 className="page-title">{ar ? "تعديل الصنف" : "Edit Item"}</h1>
          <p className="page-subtitle">{item.name_ar}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/inventory/items/${id}`} className="btn btn-secondary">
            {ar ? "إلغاء" : "Cancel"}
          </Link>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Icon name="check" size={16} />
            {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التعديلات" : "Save Changes")}
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <div className="card-header">
          <span className="card-title">{ar ? "بيانات الصنف" : "Item Details"}</span>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 0 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">
                {ar ? "الاسم بالعربي" : "Arabic Name"} <span className="required">*</span>
              </label>
              <input
                className="form-input"
                value={form.name_ar}
                onChange={e => setForm((f: any) => ({ ...f, name_ar: e.target.value }))}
                dir="rtl"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "الاسم بالإنجليزي" : "English Name"}</label>
              <input
                className="form-input"
                value={form.name_en}
                onChange={e => setForm((f: any) => ({ ...f, name_en: e.target.value }))}
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{ar ? "الباركود" : "Barcode"}</label>
              <input
                className="form-input"
                value={form.barcode}
                onChange={e => setForm((f: any) => ({ ...f, barcode: e.target.value }))}
                dir="ltr"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "التصنيف" : "Category"}</label>
              <select
                className="form-input form-select"
                value={form.category_id}
                onChange={e => setForm((f: any) => ({ ...f, category_id: e.target.value }))}
              >
                <option value="">{ar ? "— بدون تصنيف —" : "— No Category —"}</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name_ar}</option>
                ))}
              </select>
            </div>
          </div>

          {isSerial && (
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "اللون" : "Color"}</label>
                <input
                  className="form-input"
                  value={form.color}
                  onChange={e => setForm((f: any) => ({ ...f, color: e.target.value }))}
                  placeholder={ar ? "أسود، أبيض..." : "Black, White..."}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "السعة" : "Storage"}</label>
                <input
                  className="form-input"
                  value={form.storage}
                  onChange={e => setForm((f: any) => ({ ...f, storage: e.target.value }))}
                  placeholder="128GB, 256GB..."
                  dir="ltr"
                />
              </div>
            </div>
          )}

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">
                {ar ? "سعر التكلفة" : "Cost Price"}
                {isSerial && (
                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginInlineStart: 4 }}>
                    {ar ? "(متوسط)" : "(avg)"}
                  </span>
                )}
              </label>
              <input
                type="number"
                className="form-input"
                value={form.cost_price}
                onChange={e => setForm((f: any) => ({ ...f, cost_price: e.target.value }))}
                disabled={isSerial}
                style={isSerial ? { background: "#F1F5F9" } : {}}
                min="0"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                {ar ? "سعر البيع" : "Sale Price"}
                {item?.tracking_type === "serial" && (
                  <span style={{ fontSize: 11, color: "#D97706", marginInlineStart: 6 }}>
                    {ar ? "— سعر افتراضي (يُستخدم في فواتير المندوب)" : "— Default price (used in rep invoices)"}
                  </span>
                )}
              </label>
              <input
                type="number"
                className="form-input"
                value={form.sale_price}
                onChange={e => setForm((f: any) => ({ ...f, sale_price: e.target.value }))}
                onFocus={e => e.target.select()}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "ضريبة القيمة المضافة %" : "VAT %"}</label>
              <select
                className="form-input form-select"
                value={form.vat_rate}
                onChange={e => setForm((f: any) => ({ ...f, vat_rate: e.target.value }))}
              >
                <option value="15">15%</option>
                <option value="0">0%</option>
              </select>
            </div>
          </div>

          {!isSerial && (
            <div className="form-group" style={{ maxWidth: 200 }}>
              <label className="form-label">{ar ? "نقطة إعادة الطلب" : "Reorder Point"}</label>
              <input
                type="number"
                className="form-input"
                value={form.reorder_point}
                onChange={e => setForm((f: any) => ({ ...f, reorder_point: e.target.value }))}
                min="0"
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 24, marginTop: 8, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.pos_enabled}
                onChange={e => setForm((f: any) => ({ ...f, pos_enabled: e.target.checked }))}
              />
              {ar ? "نقطة البيع" : "POS Enabled"}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.store_enabled}
                onChange={e => setForm((f: any) => ({ ...f, store_enabled: e.target.checked }))}
              />
              {ar ? "المتجر الإلكتروني" : "Online Store"}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm((f: any) => ({ ...f, is_active: e.target.checked }))}
              />
              {ar ? "نشط" : "Active"}
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
