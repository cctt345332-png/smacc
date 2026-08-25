"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAsset, getAssetCategories } from "@/lib/assets";
import { getCostCenters } from "@/lib/accounting";

const DEP_METHODS = [
  { value: "straight_line", ar: "القسط الثابت (Straight Line)", en: "Straight Line" },
  { value: "declining_balance", ar: "القسط المتناقص (Declining Balance)", en: "Declining Balance" },
];

export default function NewAssetPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    asset_number: "", name_ar: "", name_en: "", category_id: "",
    purchase_date: new Date().toISOString().split("T")[0],
    purchase_cost: "", salvage_value: "0",
    useful_life_years: "5", depreciation_method: "straight_line",
    depreciation_rate: "20", serial_number: "", location: "",
    responsible_person: "", cost_center_id: "", vendor_name: "",
    invoice_number: "", warranty_expiry: "", notes: "",
  });

  useEffect(() => {
    Promise.all([getAssetCategories(), getCostCenters()]).then(([c, cc]) => {
      setCategories(c.data);
      setCostCenters(cc.data);
    });
  }, []);

  // عند اختيار الفئة — نملأ طريقة الاستهلاك والعمر الإنتاجي تلقائياً
  const onCategoryChange = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    if (cat) {
      setForm(f => ({
        ...f, category_id: catId,
        depreciation_method: cat.depreciation_method,
        useful_life_years: String(cat.useful_life_years),
        depreciation_rate: String(cat.depreciation_rate),
      }));
    } else {
      setForm(f => ({ ...f, category_id: catId }));
    }
  };

  const handleSave = async () => {
    if (!form.asset_number || !form.name_ar || !form.category_id || !form.purchase_cost) {
      return alert(ar ? "أدخل جميع الحقول المطلوبة" : "Fill all required fields");
    }
    setSaving(true);
    try {
      await createAsset({
        ...form,
        purchase_date: new Date(form.purchase_date).toISOString(),
        purchase_cost: parseFloat(form.purchase_cost),
        salvage_value: parseFloat(form.salvage_value) || 0,
        useful_life_years: parseInt(form.useful_life_years),
        depreciation_rate: parseFloat(form.depreciation_rate),
        cost_center_id: form.cost_center_id || null,
        warranty_expiry: form.warranty_expiry ? new Date(form.warranty_expiry).toISOString() : null,
        serial_number: form.serial_number || null,
        name_en: form.name_en || null,
        vendor_name: form.vendor_name || null,
        invoice_number: form.invoice_number || null,
        notes: form.notes || null,
      });
      router.push(`/${locale}/assets`);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/assets`}>{ar ? "الأصول الثابتة" : "Fixed Assets"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "أصل جديد" : "New Asset"}</span>
          </div>
          <h1 className="page-title">{ar ? "إضافة أصل ثابت جديد" : "Add New Fixed Asset"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/assets`} className="btn btn-secondary btn-sm">{ar ? "إلغاء" : "Cancel"}</Link>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ الأصل" : "Save Asset")}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* البيانات الأساسية */}
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "البيانات الأساسية" : "Basic Information"}</span></div>
          <div className="card-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "رقم الأصل" : "Asset Number"} <span className="required">*</span></label>
                <input className="form-input" value={form.asset_number} onChange={e => f("asset_number", e.target.value)} placeholder="FA-001" />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الفئة" : "Category"} <span className="required">*</span></label>
                <select className="form-input form-select" value={form.category_id} onChange={e => onCategoryChange(e.target.value)}>
                  <option value="">{ar ? "اختر فئة..." : "Select category..."}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{ar ? c.name_ar : c.name_en}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "اسم الأصل (عربي)" : "Asset Name (Arabic)"} <span className="required">*</span></label>
              <input className="form-input" value={form.name_ar} onChange={e => f("name_ar", e.target.value)} placeholder={ar ? "سيارة تويوتا كامري 2024" : "Toyota Camry 2024"} />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "اسم الأصل (إنجليزي)" : "Asset Name (English)"}</label>
              <input className="form-input" value={form.name_en} onChange={e => f("name_en", e.target.value)} placeholder="Toyota Camry 2024" />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "الرقم التسلسلي" : "Serial Number"}</label>
                <input className="form-input" value={form.serial_number} onChange={e => f("serial_number", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الموقع" : "Location"}</label>
                <input className="form-input" value={form.location} onChange={e => f("location", e.target.value)} placeholder={ar ? "المكتب الرئيسي" : "Head Office"} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{ar ? "المسؤول عنه" : "Responsible Person"}</label>
                <input className="form-input" value={form.responsible_person} onChange={e => f("responsible_person", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "مركز التكلفة" : "Cost Center"}</label>
                <select className="form-input form-select" value={form.cost_center_id} onChange={e => f("cost_center_id", e.target.value)}>
                  <option value="">{ar ? "— اختياري —" : "— Optional —"}</option>
                  {costCenters.map(c => <option key={c.id} value={c.id}>{c.code} — {ar ? c.name_ar : c.name_en}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* بيانات الشراء والاستهلاك */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">{ar ? "بيانات الشراء" : "Purchase Details"}</span></div>
            <div className="card-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "تاريخ الشراء" : "Purchase Date"} <span className="required">*</span></label>
                  <input type="date" className="form-input" value={form.purchase_date} onChange={e => f("purchase_date", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "تكلفة الشراء (ر.س)" : "Purchase Cost (SAR)"} <span className="required">*</span></label>
                  <input type="number" className="form-input" value={form.purchase_cost} onChange={e => f("purchase_cost", e.target.value)} min="0" step="0.01" />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "اسم المورد" : "Vendor Name"}</label>
                  <input className="form-input" value={form.vendor_name} onChange={e => f("vendor_name", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "رقم الفاتورة" : "Invoice Number"}</label>
                  <input className="form-input" value={form.invoice_number} onChange={e => f("invoice_number", e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "تاريخ انتهاء الضمان" : "Warranty Expiry"}</label>
                <input type="date" className="form-input" value={form.warranty_expiry} onChange={e => f("warranty_expiry", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">{ar ? "إعدادات الاستهلاك" : "Depreciation Settings"}</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">{ar ? "طريقة الاستهلاك" : "Depreciation Method"}</label>
                <select className="form-input form-select" value={form.depreciation_method} onChange={e => f("depreciation_method", e.target.value)}>
                  {DEP_METHODS.map(m => <option key={m.value} value={m.value}>{ar ? m.ar : m.en}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "العمر الإنتاجي (سنوات)" : "Useful Life (Years)"}</label>
                  <input type="number" className="form-input" value={form.useful_life_years} onChange={e => f("useful_life_years", e.target.value)} min="1" />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "نسبة الاستهلاك %" : "Depreciation Rate %"}</label>
                  <input type="number" className="form-input" value={form.depreciation_rate} onChange={e => f("depreciation_rate", e.target.value)} min="0" max="100" step="0.01" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "القيمة التخريدية (ر.س)" : "Salvage Value (SAR)"}</label>
                <input type="number" className="form-input" value={form.salvage_value} onChange={e => f("salvage_value", e.target.value)} min="0" step="0.01" />
                <p className="form-hint">{ar ? "القيمة المتبقية بعد انتهاء العمر الإنتاجي" : "Remaining value after useful life ends"}</p>
              </div>

              {/* معاينة الاستهلاك */}
              {form.purchase_cost && form.useful_life_years && (
                <div style={{ background: "#F8FAFC", borderRadius: 8, padding: 12, fontSize: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>
                    {ar ? "معاينة الاستهلاك السنوي" : "Annual Depreciation Preview"}
                  </div>
                  {(() => {
                    const cost = parseFloat(form.purchase_cost) || 0;
                    const salvage = parseFloat(form.salvage_value) || 0;
                    const years = parseInt(form.useful_life_years) || 1;
                    const annual = (cost - salvage) / years;
                    const monthly = annual / 12;
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <div style={{ color: "var(--text-muted)" }}>{ar ? "سنوي" : "Annual"}</div>
                          <div style={{ fontWeight: 700, color: "var(--primary)" }}>{annual.toLocaleString("en-US", { minimumFractionDigits: 2 })} {ar ? "ر.س" : "SAR"}</div>
                        </div>
                        <div>
                          <div style={{ color: "var(--text-muted)" }}>{ar ? "شهري" : "Monthly"}</div>
                          <div style={{ fontWeight: 700, color: "#65707E" }}>{monthly.toLocaleString("en-US", { minimumFractionDigits: 2 })} {ar ? "ر.س" : "SAR"}</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ملاحظات */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><span className="card-title">{ar ? "ملاحظات" : "Notes"}</span></div>
        <div className="card-body">
          <textarea className="form-input" rows={3} value={form.notes} onChange={e => f("notes", e.target.value)} placeholder={ar ? "أي ملاحظات إضافية..." : "Any additional notes..."} />
        </div>
      </div>
    </>
  );
}
