"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createItem, getCategories, getWarehouses } from "@/lib/inventory";
import { getCompany } from "@/lib/settings";
import { Icon } from "@/components/ui/Icons";

// ── إعدادات كل نشاط ──────────────────────────────────────────────────
const BUSINESS_CONFIG: Record<string, {
  tracking: string; unit: string; lockTracking: boolean;
  showCondition: boolean; showExpiry: boolean; showVariants: boolean;
  showInitialQty: boolean; units: string[];
  trackingLabel: { ar: string; en: string };
}> = {
  mobile_phones: { tracking: "serial",   unit: "piece", lockTracking: true,  showCondition: true,  showExpiry: false, showVariants: false, showInitialQty: false, units: ["piece"],                          trackingLabel: { ar: "سيريال (IMEI)", en: "Serial (IMEI)" } },
  pharmacy:      { tracking: "batch",    unit: "piece", lockTracking: true,  showCondition: false, showExpiry: true,  showVariants: false, showInitialQty: true,  units: ["piece","pack","box"],             trackingLabel: { ar: "تشغيلة + انتهاء", en: "Batch + Expiry" } },
  grocery:       { tracking: "quantity", unit: "piece", lockTracking: false, showCondition: false, showExpiry: false, showVariants: false, showInitialQty: true,  units: ["piece","kg","liter","pack","box"], trackingLabel: { ar: "كمية", en: "Quantity" } },
  spices:        { tracking: "weight",   unit: "gram",  lockTracking: true,  showCondition: false, showExpiry: true,  showVariants: false, showInitialQty: true,  units: ["gram","kg"],                      trackingLabel: { ar: "وزن (جرام/كيلو)", en: "Weight (gram/kg)" } },
  clothing:      { tracking: "variant",  unit: "piece", lockTracking: true,  showCondition: false, showExpiry: false, showVariants: true,  showInitialQty: false, units: ["piece"],                          trackingLabel: { ar: "متغيرات (مقاس+لون)", en: "Variants (size+color)" } },
  spare_parts:   { tracking: "serial",   unit: "piece", lockTracking: false, showCondition: true,  showExpiry: false, showVariants: false, showInitialQty: false, units: ["piece"],                          trackingLabel: { ar: "سيريال / كمية", en: "Serial / Quantity" } },
  construction:  { tracking: "quantity", unit: "meter", lockTracking: false, showCondition: false, showExpiry: false, showVariants: false, showInitialQty: true,  units: ["meter","ton","piece","box"],       trackingLabel: { ar: "كمية", en: "Quantity" } },
  general:       { tracking: "quantity", unit: "piece", lockTracking: false, showCondition: false, showExpiry: false, showVariants: false, showInitialQty: true,  units: ["piece","kg","liter","meter","box","pack","ton","gram"], trackingLabel: { ar: "كمية", en: "Quantity" } },
};

const UNIT_LABELS: Record<string, string> = {
  piece: "قطعة", kg: "كيلوجرام", gram: "جرام", liter: "لتر",
  meter: "متر", box: "صندوق", pack: "عبوة", ton: "طن",
};

const TRACKING_TYPES = [
  { value: "quantity", ar: "كمية" }, { value: "serial", ar: "سيريال" },
  { value: "batch", ar: "تشغيلة" }, { value: "variant", ar: "متغيرات" },
  { value: "weight", ar: "وزن" },
];

export default function NewItemPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [businessType, setBusinessType] = useState("general");
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // متغيرات الملابس
  const [variants, setVariants] = useState([{ size: "", color: "", qty: "0", price: "" }]);

  const [form, setForm] = useState({
    name_ar: "", name_en: "", sku: "", barcode: "",
    tracking_type: "quantity", unit_type: "piece",
    category_id: "", default_warehouse_id: "",
    cost_price: "", sale_price: "", vat_rate: "15",
    reorder_point: "0", initial_qty: "0",
    store_enabled: false, pos_enabled: true,
    store_images_json: "",
    color: "", storage: "",
    // حقول الصيدلية
    manufacturer: "",
    sfda_number: "",
    dosage_form: "",
    concentration: "",
    requires_prescription: false,
    generic_name: "",
    country_of_origin: "",
    import_license: "",
    gs1_code: "",
    nphies_code: "",
    // التشغيلة الأولية للصيدلية
    initial_batch_number: "",
    initial_expiry_date: "",
    initial_manufacture_date: "",
  });

  // خيار "بسيريال أو بدون" — خاص بنشاط الجوالات
  const [useSerial, setUseSerial] = useState(true);

  const cfg = BUSINESS_CONFIG[businessType] || BUSINESS_CONFIG.general;

  useEffect(() => {
    Promise.all([getCategories(), getWarehouses(), getCompany()])
      .then(([c, w, co]) => {
        setCategories(c.data);
        setWarehouses(w.data);
        const bt = co.data?.business_type || "general";
        setBusinessType(bt);
        const config = BUSINESS_CONFIG[bt] || BUSINESS_CONFIG.general;
        // للجوالات: افتراضي بسيريال
        const defaultTracking = config.tracking;
        setForm(f => ({ ...f, tracking_type: defaultTracking, unit_type: config.unit }));
        setUseSerial(config.tracking === "serial");
      })
      .catch(() => {});
  }, []);

  const upd = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert(ar ? "الصورة أكبر من 2MB" : "Image exceeds 2MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      upd("store_images_json", JSON.stringify([result]));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name_ar) return alert(ar ? "اسم الصنف مطلوب" : "Item name is required");
    if (!useSerial && !form.sale_price) return alert(ar ? "سعر البيع مطلوب" : "Sale price is required");
    // للصيدلية: رقم التشغيلة وتاريخ الانتهاء مطلوبان إذا كانت هناك كمية أولية
    if (businessType === "pharmacy" && parseFloat(form.initial_qty) > 0) {
      if (!form.initial_batch_number) return alert(ar ? "رقم التشغيلة مطلوب" : "Batch number is required");
      if (!form.initial_expiry_date) return alert(ar ? "تاريخ الانتهاء مطلوب" : "Expiry date is required");
    }
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        tracking_type: useSerial ? "serial" : "quantity",
        cost_price: parseFloat(form.cost_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
        vat_rate: parseFloat(form.vat_rate) || 15,
        reorder_point: parseFloat(form.reorder_point) || 0,
        category_id: form.category_id || null,
        default_warehouse_id: form.default_warehouse_id || null,
        store_images_json: form.store_images_json || null,
        color: form.color || null,
        storage: form.storage || null,
        // حقول الصيدلية
        manufacturer: form.manufacturer || null,
        sfda_number: form.sfda_number || null,
        dosage_form: form.dosage_form || null,
        concentration: form.concentration || null,
        requires_prescription: form.requires_prescription,
        generic_name: form.generic_name || null,
        country_of_origin: form.country_of_origin || null,
        import_license: form.import_license || null,
        gs1_code: form.gs1_code || null,
        nphies_code: form.nphies_code || null,
      };
      if (cfg.showInitialQty && parseFloat(form.initial_qty) > 0) {
        payload.initial_qty = parseFloat(form.initial_qty);
      }
      // التشغيلة الأولية للصيدلية
      if (businessType === "pharmacy" && form.initial_batch_number && form.initial_expiry_date) {
        payload.initial_batch = {
          batch_number: form.initial_batch_number,
          expiry_date: form.initial_expiry_date,
          manufacture_date: form.initial_manufacture_date || null,
          quantity: parseFloat(form.initial_qty) || 0,
          cost_price: parseFloat(form.cost_price) || 0,
        };
      }
      const { data } = await createItem(payload);
      router.push(`/${locale}/inventory/items/${data.id}`);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/inventory/items`}>{ar ? "الأصناف" : "Items"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "صنف جديد" : "New Item"}</span>
          </div>
          <h1 className="page-title">{ar ? "إضافة صنف جديد" : "Add New Item"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/inventory/items`} className="btn btn-secondary">{ar ? "إلغاء" : "Cancel"}</Link>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Icon name="check" size={16} />
            {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ الصنف" : "Save Item")}
          </button>
        </div>
      </div>

      {/* شريط النشاط */}
      <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366F1" }} />
        <span style={{ color: "#4338CA", fontWeight: 600 }}>
          {ar ? "نوع التتبع حسب نشاطك:" : "Tracking type for your business:"}
        </span>
        <span style={{ color: "#6366F1", fontWeight: 700 }}>
          {ar ? cfg.trackingLabel.ar : cfg.trackingLabel.en}
        </span>
        <Link href={`/${locale}/settings/company`} style={{ marginInlineStart: "auto", fontSize: 12, color: "#6366F1" }}>
          {ar ? "تغيير النشاط" : "Change Business Type"}
        </Link>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* البيانات الأساسية */}
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "البيانات الأساسية" : "Basic Info"}</span></div>
          <div className="card-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "الاسم بالعربي" : "Arabic Name"} <span className="required">*</span></label>
                <input className="form-input" value={form.name_ar} onChange={e => upd("name_ar", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الاسم بالإنجليزي" : "English Name"}</label>
                <input className="form-input" value={form.name_en} onChange={e => upd("name_en", e.target.value)} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">SKU</label>
                <input className="form-input" value={form.sku} onChange={e => upd("sku", e.target.value)} placeholder={ar ? "يُولَّد تلقائياً" : "Auto-generated"} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الباركود" : "Barcode"}</label>
                <input className="form-input" value={form.barcode} onChange={e => upd("barcode", e.target.value)} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "التصنيف" : "Category"}</label>
                <select className="form-input form-select" value={form.category_id} onChange={e => upd("category_id", e.target.value)}>
                  <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "المستودع" : "Warehouse"}</label>
                <select className="form-input form-select" value={form.default_warehouse_id} onChange={e => upd("default_warehouse_id", e.target.value)}>
                  <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                </select>
              </div>
            </div>

            {/* نوع التتبع — يُقفل حسب النشاط */}
            <div className="form-group">
              <label className="form-label">{ar ? "نوع التتبع" : "Tracking Type"}</label>
              {cfg.lockTracking ? (
                // للجوالات: خيار بسيريال أو بدون
                cfg.tracking === "serial" ? (
                  <div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <button type="button"
                        onClick={() => { setUseSerial(true); upd("tracking_type", "serial"); }}
                        style={{
                          flex: 1, padding: "10px 12px", borderRadius: 8, border: "2px solid",
                          borderColor: useSerial ? "var(--primary)" : "var(--border)",
                          background: useSerial ? "var(--primary)" : "white",
                          color: useSerial ? "white" : "var(--text-primary)",
                          fontWeight: 600, fontSize: 13, cursor: "pointer",
                        }}>
                        <div>{ar ? "بسيريال (IMEI)" : "With Serial (IMEI)"}</div>
                        <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{ar ? "كل وحدة لها سيريال مستقل" : "Each unit has its own serial"}</div>
                      </button>
                      <button type="button"
                        onClick={() => { setUseSerial(false); upd("tracking_type", "quantity"); }}
                        style={{
                          flex: 1, padding: "10px 12px", borderRadius: 8, border: "2px solid",
                          borderColor: !useSerial ? "#6F4A84" : "var(--border)",
                          background: !useSerial ? "#6F4A84" : "white",
                          color: !useSerial ? "white" : "var(--text-primary)",
                          fontWeight: 600, fontSize: 13, cursor: "pointer",
                        }}>
                        <div>{ar ? "بدون سيريال" : "Without Serial"}</div>
                        <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{ar ? "كمية عادية (كابلات، حافظات...)" : "Quantity (cables, cases...)"}</div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "#F1F5F9", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="lock" size={14} />
                    {ar ? cfg.trackingLabel.ar : cfg.trackingLabel.en}
                  </div>
                )
              ) : (
                <select className="form-input form-select" value={form.tracking_type} onChange={e => upd("tracking_type", e.target.value)}>
                  {TRACKING_TYPES.map(t => <option key={t.value} value={t.value}>{t.ar}</option>)}
                </select>
              )}
            </div>

            {/* اللون والسعة — للجوالات والإلكترونيات */}
            {(businessType === "mobile_phones" || businessType === "spare_parts") && (
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "اللون (اختياري)" : "Color (optional)"}</label>
                  <input className="form-input" value={form.color}
                    onChange={e => upd("color", e.target.value)}
                    placeholder={ar ? "أسود، أبيض، تيتانيوم..." : "Black, White, Titanium..."} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "السعة (اختياري)" : "Storage (optional)"}</label>
                  <input className="form-input" value={form.storage}
                    onChange={e => upd("storage", e.target.value)}
                    placeholder="128GB, 256GB, 512GB..." />
                </div>
              </div>
            )}

            {/* وحدة القياس */}
            <div className="form-group">
              <label className="form-label">{ar ? "وحدة القياس" : "Unit"}</label>
              <select className="form-input form-select" value={form.unit_type} onChange={e => upd("unit_type", e.target.value)}>
                {cfg.units.map(u => <option key={u} value={u}>{UNIT_LABELS[u] || u}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* الصورة + الربط */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* صورة المنتج */}
          <div className="card">
            <div className="card-header"><span className="card-title">{ar ? "صورة المنتج" : "Product Image"}</span></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 140, height: 140, borderRadius: 12, border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", overflow: "hidden" }}>
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                    <Icon name="box" size={32} />
                    <div style={{ fontSize: 11, marginTop: 6 }}>{ar ? "لا توجد صورة" : "No image"}</div>
                  </div>
                )}
              </div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer", width: "100%", textAlign: "center" }}>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImage} />
                {ar ? "رفع صورة" : "Upload Image"}
              </label>
              {imagePreview && (
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", width: "100%" }}
                  onClick={() => { setImagePreview(null); upd("store_images_json", ""); }}>
                  {ar ? "حذف الصورة" : "Remove Image"}
                </button>
              )}
              <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                {ar ? "PNG, JPG — حد أقصى 2MB" : "PNG, JPG — Max 2MB"}
              </p>
            </div>
          </div>

          {/* الربط */}
          <div className="card">
            <div className="card-header"><span className="card-title">{ar ? "الربط" : "Integration"}</span></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.pos_enabled} onChange={e => upd("pos_enabled", e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ar ? "نقطة البيع" : "Point of Sale"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "يظهر في شاشة الكاشير" : "Visible in POS screen"}</div>
                </div>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.store_enabled} onChange={e => upd("store_enabled", e.target.checked)} style={{ width: 16, height: 16, accentColor: "#6366F1" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ar ? "المتجر الإلكتروني" : "Online Store"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "يظهر في المتجر الإلكتروني" : "Visible in online store"}</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* التسعير */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">{ar ? "التسعير" : "Pricing"}</span></div>
        <div className="card-body">
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">
                {ar ? "سعر التكلفة (ر.س)" : "Cost Price (SAR)"}
                {useSerial && <span style={{ fontSize: 11, color: "var(--text-muted)", marginInlineStart: 6 }}>{ar ? "— يُحدد لكل سيريال" : "— Set per serial"}</span>}
              </label>
              <input type="number" className="form-input" value={form.cost_price}
                onChange={e => upd("cost_price", e.target.value)} min="0" step="0.01"
                disabled={useSerial}
                style={useSerial ? { background: "#F1F5F9", color: "var(--text-muted)" } : {}} />
            </div>
            <div className="form-group">
              <label className="form-label">
                {ar ? "سعر البيع (ر.س)" : "Sale Price (SAR)"}
                {useSerial
                  ? <span style={{ fontSize: 11, color: "#D97706", marginInlineStart: 6 }}>{ar ? "— سعر افتراضي للمنتج (يمكن تعديله لكل سيريال)" : "— Default price (can override per serial)"}</span>
                  : <span className="required"> *</span>
                }
              </label>
              <input type="number" className="form-input" value={form.sale_price}
                onChange={e => upd("sale_price", e.target.value)} min="0" step="0.01"
                onFocus={e => e.target.select()}
                placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "ضريبة القيمة المضافة %" : "VAT %"}</label>
              <select className="form-input form-select" value={form.vat_rate} onChange={e => upd("vat_rate", e.target.value)}>
                <option value="15">15% — خاضع</option>
                <option value="0">0% — صفري</option>
                <option value="-1">{ar ? "معفى" : "Exempt"}</option>
              </select>
            </div>
          </div>

          {/* الكمية الأولية — للمنتجات بدون سيريال */}
          {(cfg.showInitialQty || !useSerial) && (
            <div className="grid-2" style={{ marginTop: 8 }}>
              <div className="form-group">
                <label className="form-label">{ar ? "الكمية الأولية" : "Initial Quantity"}</label>
                <input type="number" className="form-input" value={form.initial_qty}
                  onChange={e => upd("initial_qty", e.target.value)} min="0" />
                <p className="form-hint">{ar ? "الكمية الموجودة حالياً في المستودع" : "Current quantity in warehouse"}</p>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "نقطة إعادة الطلب" : "Reorder Point"}</label>
                <input type="number" className="form-input" value={form.reorder_point}
                  onChange={e => upd("reorder_point", e.target.value)} min="0" />
                <p className="form-hint">{ar ? "تنبيه عند الوصول لهذه الكمية" : "Alert when reaching this quantity"}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* حقول خاصة بالصيدلية */}
      {businessType === "pharmacy" && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">{ar ? "بيانات الدواء" : "Medication Details"}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {ar ? "متطلبات SFDA — هيئة الغذاء والدواء" : "SFDA Requirements"}
            </span>
          </div>
          <div className="card-body">

            {/* القسم 1: هوية الدواء */}
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              {ar ? "هوية الدواء" : "Drug Identity"}
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "الاسم العلمي (المادة الفعّالة)" : "Generic Name (Active Ingredient)"}</label>
                <input className="form-input" value={form.generic_name}
                  onChange={e => upd("generic_name", e.target.value)}
                  placeholder={ar ? "مثال: Paracetamol, Amoxicillin" : "e.g. Paracetamol, Amoxicillin"} dir="ltr" />
                <p className="form-hint">{ar ? "الاسم الدوائي العلمي — مهم للاستبدال بالمثيل" : "INN name — important for generic substitution"}</p>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "شكل الدواء" : "Dosage Form"}</label>
                <select className="form-input form-select" value={form.dosage_form}
                  onChange={e => upd("dosage_form", e.target.value)}>
                  <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                  {[
                    { v: "tablet",      ar: "أقراص (Tablet)" },
                    { v: "capsule",     ar: "كبسول (Capsule)" },
                    { v: "syrup",       ar: "شراب (Syrup)" },
                    { v: "injection",   ar: "حقن (Injection)" },
                    { v: "cream",       ar: "كريم / مرهم (Cream/Ointment)" },
                    { v: "drops",       ar: "قطرات (Drops)" },
                    { v: "inhaler",     ar: "بخاخ (Inhaler)" },
                    { v: "suppository", ar: "تحاميل (Suppository)" },
                    { v: "powder",      ar: "مسحوق (Powder)" },
                    { v: "patch",       ar: "لصقة (Patch)" },
                    { v: "gel",         ar: "جل (Gel)" },
                    { v: "solution",    ar: "محلول (Solution)" },
                    { v: "other",       ar: "أخرى" },
                  ].map(d => <option key={d.v} value={d.v}>{d.ar}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "التركيز / الجرعة" : "Concentration / Strength"}</label>
                <input className="form-input" value={form.concentration}
                  onChange={e => upd("concentration", e.target.value)}
                  placeholder="500mg, 250mg/5ml, 10mg..." dir="ltr" />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الشركة المصنّعة" : "Manufacturer"}</label>
                <input className="form-input" value={form.manufacturer}
                  onChange={e => upd("manufacturer", e.target.value)}
                  placeholder={ar ? "اسم الشركة المصنّعة" : "Manufacturer name"} />
              </div>
            </div>

            {/* القسم 2: تسجيل SFDA */}
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "16px 0 10px" }}>
              {ar ? "تسجيل SFDA وبلد المنشأ" : "SFDA Registration & Origin"}
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "رقم تسجيل SFDA" : "SFDA Registration Number"}</label>
                <input className="form-input" value={form.sfda_number}
                  onChange={e => upd("sfda_number", e.target.value)}
                  placeholder="SA-XXXX-XXXX" dir="ltr" />
                <p className="form-hint">{ar ? "رقم التسجيل من هيئة الغذاء والدواء السعودية" : "Saudi Food & Drug Authority registration number"}</p>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "بلد المنشأ" : "Country of Origin"}</label>
                <input className="form-input" list="countries-list" value={form.country_of_origin}
                  onChange={e => upd("country_of_origin", e.target.value)}
                  placeholder={ar ? "مثال: السعودية، الأردن، ألمانيا" : "e.g. Saudi Arabia, Jordan, Germany"} />
                <datalist id="countries-list">
                  {["المملكة العربية السعودية","الأردن","مصر","الإمارات","ألمانيا","الولايات المتحدة","المملكة المتحدة","فرنسا","الهند","الصين","سويسرا","إيطاليا","بلجيكا","كندا"].map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "رقم ترخيص الاستيراد" : "Import License Number"}</label>
                <input className="form-input" value={form.import_license}
                  onChange={e => upd("import_license", e.target.value)}
                  placeholder={ar ? "للأدوية المستوردة فقط" : "For imported drugs only"} dir="ltr" />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "يحتاج وصفة طبية" : "Requires Prescription"}</label>
                <div style={{ paddingTop: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={form.requires_prescription}
                      onChange={e => upd("requires_prescription", e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{ar ? "دواء بوصفة طبية (Rx)" : "Prescription Drug (Rx)"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "لا يُصرف إلا بوصفة طبية" : "Dispensed only with prescription"}</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* القسم 3: الأكواد الدولية */}
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "16px 0 10px" }}>
              {ar ? "الأكواد الدولية والتأمين الصحي" : "International Codes & Insurance"}
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "رمز GS1 / GTIN" : "GS1 / GTIN Code"}</label>
                <input className="form-input" value={form.gs1_code}
                  onChange={e => upd("gs1_code", e.target.value)}
                  placeholder="0XXXXXXXXXXXXXXXXX" dir="ltr" />
                <p className="form-hint">{ar ? "الباركود الدولي للدواء (14 رقم)" : "International drug barcode (14 digits)"}</p>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "رمز نوفا NPHIES" : "NPHIES Code"}</label>
                <input className="form-input" value={form.nphies_code}
                  onChange={e => upd("nphies_code", e.target.value)}
                  placeholder="NPHIES-XXXXXX" dir="ltr" />
                <p className="form-hint">{ar ? "رمز نظام المعلومات الصحية الوطني — للتأمين الصحي" : "National Platform for Health Information Exchange — for insurance claims"}</p>
              </div>
            </div>

            {/* التشغيلة الأولية */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                {ar ? "التشغيلة الأولية (الكمية الموجودة حالياً)" : "Initial Batch (Current Stock)"}
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">{ar ? "رقم التشغيلة (Lot/Batch)" : "Batch / Lot Number"} <span className="required">*</span></label>
                  <input className="form-input" value={form.initial_batch_number}
                    onChange={e => upd("initial_batch_number", e.target.value)}
                    placeholder="LOT-XXXX" dir="ltr" />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "تاريخ الانتهاء (Expiry)" : "Expiry Date"} <span className="required">*</span></label>
                  <input type="date" className="form-input" value={form.initial_expiry_date}
                    onChange={e => upd("initial_expiry_date", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "تاريخ الصنع (اختياري)" : "Manufacture Date (optional)"}</label>
                  <input type="date" className="form-input" value={form.initial_manufacture_date}
                    onChange={e => upd("initial_manufacture_date", e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "8px 12px", marginTop: 4 }}>
                {ar
                  ? "عند استلام دفعات جديدة من المورد، ستُدخل تشغيلة جديدة لكل شحنة. النظام يتتبع كل تشغيلة بشكل مستقل ويُنبهك قبل انتهاء الصلاحية."
                  : "When receiving new shipments, enter a new batch for each delivery. System tracks each batch independently and alerts before expiry."}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* متغيرات الملابس */}
      {cfg.showVariants && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">{ar ? "المتغيرات (مقاس + لون)" : "Variants (Size + Color)"}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setVariants(v => [...v, { size: "", color: "", qty: "0", price: "" }])}>
              <Icon name="plus" size={14} /> {ar ? "إضافة متغير" : "Add Variant"}
            </button>
          </div>
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "المقاس" : "Size"}</th>
                  <th>{ar ? "اللون" : "Color"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "سعر خاص (اختياري)" : "Special Price"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr key={i}>
                    <td><input className="form-input" style={{ width: 80 }} value={v.size} placeholder="S, M, L, XL" onChange={e => setVariants(vs => vs.map((x, j) => j === i ? { ...x, size: e.target.value } : x))} /></td>
                    <td><input className="form-input" style={{ width: 100 }} value={v.color} placeholder={ar ? "أحمر، أزرق..." : "Red, Blue..."} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? { ...x, color: e.target.value } : x))} /></td>
                    <td><input type="number" className="form-input" style={{ width: 80, textAlign: "end" }} value={v.qty} min="0" onChange={e => setVariants(vs => vs.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} /></td>
                    <td><input type="number" className="form-input" style={{ width: 100, textAlign: "end" }} value={v.price} placeholder={ar ? "كسعر البيع" : "Same as sale"} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} /></td>
                    <td>{variants.length > 1 && <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "var(--danger)" }} onClick={() => setVariants(vs => vs.filter((_, j) => j !== i))}><Icon name="trash" size={14} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ملاحظة حسب النشاط */}
      {useSerial && (
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#1E40AF" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{ar ? "بعد الحفظ:" : "After saving:"}</div>
          {ar ? "ستتمكن من إضافة السيريالات من صفحة السيريالات. كل سيريال له تكلفة وسعر بيع مستقل — يُحسب الربح لكل وحدة." : "You can add serials from the Serials page. Each serial has its own cost and sale price — profit calculated per unit."}
        </div>
      )}
      {cfg.showExpiry && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: "#92400E" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{ar ? "بعد الحفظ:" : "After saving:"}</div>
          {ar ? "عند استلام البضاعة ستُدخل رقم التشغيلة وتاريخ الانتهاء. النظام سيُنبهك قبل انتهاء الصلاحية." : "When receiving goods, enter batch number and expiry date. System will alert before expiry."}
        </div>
      )}
    </>
  );
}
