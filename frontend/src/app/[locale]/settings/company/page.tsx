"use client";
import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { getCompany, updateCompany, uploadLogo, deleteLogo } from "@/lib/settings";
import { Icon } from "@/components/ui/Icons";

const SAUDI_CITIES = ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "الظهران", "الطائف", "تبوك", "أبها", "القصيم", "حائل", "جازان", "نجران", "الجوف"];

export default function CompanyPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [company, setCompany] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try { const { data } = await getCompany(); setCompany(data); } catch {}
  };

  useEffect(() => { load(); }, []);

  const upd = (k: string, v: any) => setCompany((c: any) => ({ ...c, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCompany({
        name: company.name,
        name_en: company.name_en || null,
        vat_number: company.vat_number || null,
        cr_number: company.cr_number || null,
        address_street: company.address_street || null,
        address_building: company.address_building || null,
        address_city: company.address_city || null,
        address_district: company.address_district || null,
        address_postal: company.address_postal || null,
        address_country: company.address_country || "SA",
        phone: company.phone || null,
        email: company.email || null,
        website: company.website || null,
        currency: company.currency || "SAR",
        fiscal_year_start: company.fiscal_year_start || 1,
        business_type: company.business_type || "general",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await uploadLogo(file);
      setCompany((c: any) => ({ ...c, logo_data: data.logo_data }));
    } catch (e: any) { alert(e?.response?.data?.detail || "Logo upload failed"); }
    finally { setUploading(false); }
  };

  const handleDeleteLogo = async () => {
    if (!confirm(ar ? "حذف الشعار؟" : "Delete logo?")) return;
    try { await deleteLogo(); setCompany((c: any) => ({ ...c, logo_data: null })); } catch {}
  };

  if (!company) return <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;

  const months = ar
    ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/settings`}>{ar ? "الإعدادات" : "Settings"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "بيانات الشركة" : "Company Info"}</span>
          </div>
          <h1 className="page-title">{ar ? "بيانات الشركة" : "Company Information"}</h1>
          <p className="page-subtitle">{ar ? "البيانات الأساسية للشركة — تظهر في الفواتير والتقارير" : "Company details — shown on invoices and reports"}</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ البيانات" : "Save")}
        </button>
      </div>

      {saved && (
        <div style={{ background: "#F0E7F4", border: "1px solid #C8AED4", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#3E0865", fontSize: 13, fontWeight: 600 }}>
          {ar ? "تم حفظ بيانات الشركة بنجاح" : "Company information saved successfully"}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* نوع النشاط التجاري — يُدار من لوحة المدير العام */}
          <div className="card" style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }}>
            <div className="card-header">
              <span className="card-title" style={{ color: "#64748B" }}>
                {ar ? "نوع النشاط التجاري" : "Business Type"}
              </span>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#EFF6FF", borderRadius: 10, border: "1px solid #BFDBFE" }}>
                <span style={{ fontSize: 24 }}>
                  {company.business_type === "mobile_phones" ? "📱" :
                   company.business_type === "pharmacy" ? "💊" :
                   company.business_type === "grocery" ? "🛒" :
                   company.business_type === "spices" ? "🌿" :
                   company.business_type === "clothing" ? "👕" :
                   company.business_type === "spare_parts" ? "🔧" :
                   company.business_type === "construction" ? "🏗️" : "📦"}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1E40AF" }}>
                    {company.business_type === "mobile_phones" ? (ar ? "جوالات وإلكترونيات" : "Mobile Phones") :
                     company.business_type === "pharmacy" ? (ar ? "صيدلية" : "Pharmacy") :
                     company.business_type === "grocery" ? (ar ? "بقالة وسوبرماركت" : "Grocery") :
                     company.business_type === "spices" ? (ar ? "عطارة وتوابل" : "Spices") :
                     company.business_type === "clothing" ? (ar ? "ملابس وأزياء" : "Clothing") :
                     company.business_type === "spare_parts" ? (ar ? "قطع غيار" : "Spare Parts") :
                     company.business_type === "construction" ? (ar ? "مواد بناء" : "Construction") :
                     (ar ? "نشاط عام" : "General Business")}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                    {ar ? "لتغيير النشاط التجاري، تواصل مع المدير العام" : "To change business type, contact the super admin"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* البيانات الأساسية */}
          <div className="card">
            <div className="card-header"><span className="card-title">{ar ? "البيانات الأساسية" : "Basic Information"}</span></div>
            <div className="card-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "اسم الشركة (عربي)" : "Company Name (Arabic)"} <span className="required">*</span></label>
                  <input className="form-input" value={company.name || ""} onChange={e => upd("name", e.target.value)} placeholder="شركة المثال" />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "اسم الشركة (إنجليزي)" : "Company Name (English)"}</label>
                  <input className="form-input" value={company.name_en || ""} onChange={e => upd("name_en", e.target.value)} placeholder="Example Company" />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "الهاتف" : "Phone"}</label>
                  <input className="form-input" value={company.phone || ""} onChange={e => upd("phone", e.target.value)} placeholder="+966 11 xxx xxxx" />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "البريد الإلكتروني" : "Email"}</label>
                  <input type="email" className="form-input" value={company.email || ""} onChange={e => upd("email", e.target.value)} placeholder="info@company.com" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الموقع الإلكتروني" : "Website"}</label>
                <input className="form-input" value={company.website || ""} onChange={e => upd("website", e.target.value)} placeholder="https://www.company.com" />
              </div>
            </div>
          </div>

          {/* البيانات الضريبية — متطلبات زاتكا */}
          <div className="card" style={{ borderColor: "#BFDBFE" }}>
            <div className="card-header" style={{ background: "#EFF6FF" }}>
              <span className="card-title" style={{ color: "#1E40AF" }}>
                <Icon name="tax" size={16} /> {ar ? "البيانات الضريبية — متطلبات زاتكا" : "Tax Information — ZATCA Requirements"}
              </span>
            </div>
            <div className="card-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">
                    {ar ? "الرقم الضريبي (VAT Number)" : "VAT Number"}
                  </label>
                  <input className="form-input" value={company.vat_number || ""} onChange={e => upd("vat_number", e.target.value)} placeholder="300XXXXXXXXX1003" maxLength={15} />
                  <p className="form-hint">{ar ? "15 رقم — يبدأ وينتهي بـ 3" : "15 digits — starts and ends with 3"}</p>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "رقم السجل التجاري" : "CR Number"}</label>
                  <input className="form-input" value={company.cr_number || ""} onChange={e => upd("cr_number", e.target.value)} placeholder="1010XXXXXX" />
                </div>
              </div>
            </div>
          </div>

          {/* العنوان — متطلبات زاتكا */}
          <div className="card">
            <div className="card-header"><span className="card-title">{ar ? "العنوان — متطلبات زاتكا" : "Address — ZATCA Requirements"}</span></div>
            <div className="card-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "اسم الشارع" : "Street Name"}</label>
                  <input className="form-input" value={company.address_street || ""} onChange={e => upd("address_street", e.target.value)} placeholder={ar ? "شارع الملك فهد" : "King Fahd Road"} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "رقم المبنى" : "Building Number"}</label>
                  <input className="form-input" value={company.address_building || ""} onChange={e => upd("address_building", e.target.value)} placeholder="1234" />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "المدينة" : "City"}</label>
                  <input className="form-input" list="cities-list" value={company.address_city || ""} onChange={e => upd("address_city", e.target.value)} placeholder={ar ? "الرياض" : "Riyadh"} />
                  <datalist id="cities-list">{SAUDI_CITIES.map(c => <option key={c} value={c} />)}</datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "الحي" : "District"}</label>
                  <input className="form-input" value={company.address_district || ""} onChange={e => upd("address_district", e.target.value)} placeholder={ar ? "العليا" : "Al Olaya"} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "الرمز البريدي" : "Postal Code"}</label>
                  <input className="form-input" value={company.address_postal || ""} onChange={e => upd("address_postal", e.target.value)} placeholder="12345" maxLength={5} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "الدولة" : "Country"}</label>
                  <input className="form-input" value={company.address_country || "SA"} onChange={e => upd("address_country", e.target.value)} placeholder="SA" maxLength={3} />
                </div>
              </div>
            </div>
          </div>

          {/* إعدادات مالية */}
          <div className="card">
            <div className="card-header"><span className="card-title">{ar ? "الإعدادات المالية" : "Financial Settings"}</span></div>
            <div className="card-body">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "العملة الأساسية" : "Base Currency"}</label>
                  <select className="form-input form-select" value={company.currency || "SAR"} onChange={e => upd("currency", e.target.value)}>
                    <option value="SAR">SAR — ريال سعودي</option>
                    <option value="USD">USD — دولار أمريكي</option>
                    <option value="EUR">EUR — يورو</option>
                    <option value="AED">AED — درهم إماراتي</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "بداية السنة المالية" : "Fiscal Year Start"}</label>
                  <select className="form-input form-select" value={company.fiscal_year_start || 1} onChange={e => upd("fiscal_year_start", parseInt(e.target.value))}>
                    {months.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* الشعار */}
        <div className="card" style={{ position: "sticky", top: 80 }}>
          <div className="card-header"><span className="card-title">{ar ? "شعار الشركة" : "Company Logo"}</span></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            {/* Preview */}
            <div style={{
              width: 160, height: 160, borderRadius: 16, border: "2px dashed var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "#F8FAFC", overflow: "hidden",
            }}>
              {company.logo_data ? (
                <img src={company.logo_data} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 8 }} />
              ) : (
                <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
                  <Icon name="building" size={40} />
                  <div style={{ fontSize: 12, marginTop: 8 }}>{ar ? "لا يوجد شعار" : "No logo"}</div>
                </div>
              )}
            </div>

            {/* Upload */}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" style={{ display: "none" }} onChange={handleLogoUpload} />
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? (ar ? "جاري الرفع..." : "Uploading...") : (ar ? "رفع شعار" : "Upload Logo")}
            </button>
            {company.logo_data && (
              <button className="btn btn-secondary" style={{ width: "100%", color: "var(--danger)" }} onClick={handleDeleteLogo}>
                {ar ? "حذف الشعار" : "Remove Logo"}
              </button>
            )}
            <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
              {ar ? "PNG, JPG, SVG — حد أقصى 2MB" : "PNG, JPG, SVG — Max 2MB"}
            </p>

            {/* Preview in invoice */}
            {company.logo_data && (
              <div style={{ width: "100%", background: "#F8FAFC", borderRadius: 8, padding: 12, marginTop: 8 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textAlign: "center" }}>
                  {ar ? "معاينة في الفاتورة" : "Invoice Preview"}
                </div>
                <div style={{ background: "white", borderRadius: 6, padding: 10, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                  <img src={company.logo_data} alt="Logo" style={{ width: 40, height: 40, objectFit: "contain" }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{company.name}</div>
                    {company.vat_number && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>VAT: {company.vat_number}</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
