"use client";
import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { getVendors, createVendor } from "@/lib/purchases";
import { getAccounts } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";

const VENDOR_TYPES = [
  { value: "company",    ar: "شركة",   en: "Company",    badge: "badge-info" },
  { value: "individual", ar: "فرد",    en: "Individual", badge: "badge-gray" },
  { value: "government", ar: "حكومي",  en: "Government", badge: "badge-warning" },
];

const PAYMENT_TERMS = [0, 15, 30, 45, 60, 90];
const SAUDI_CITIES = ["الرياض","جدة","مكة المكرمة","المدينة المنورة","الدمام","الخبر","الطائف","تبوك","أبها","القصيم","حائل","جازان","نجران","الجوف"];

const emptyForm = {
  vendor_type: "company",
  name_ar: "", name_en: "",
  vat_number: "", cr_number: "", national_id: "",
  owner_name: "", activity_type: "",
  address_building: "", address_street: "",
  address_district: "", address_city: "",
  address_postal: "", address_additional: "",
  address_country: "SA",
  phone: "", phone2: "", email: "", website: "",
  payment_terms_days: "30", credit_limit: "0",
  ap_account_id: "", notes: "",
};

export default function VendorsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [vendors, setVendors] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [activeTab, setActiveTab] = useState<"basic" | "address" | "financial" | "docs">("basic");
  const [docs, setDocs] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    try { const { data } = await getVendors(search || undefined); setVendors(data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    getAccounts().then(({ data }) => setAccounts(data)).catch(() => {});
  }, []);

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name_ar) return alert(ar ? "الاسم بالعربي مطلوب" : "Arabic name is required");
    setSaving(true);
    try {
      await createVendor({
        ...form,
        payment_terms_days: parseInt(form.payment_terms_days) || 30,
        credit_limit: parseFloat(form.credit_limit) || 0,
        vat_number: form.vat_number || null,
        cr_number: form.cr_number || null,
        national_id: form.national_id || null,
        owner_name: form.owner_name || null,
        activity_type: form.activity_type || null,
        name_en: form.name_en || null,
        phone2: form.phone2 || null,
        website: form.website || null,
        ap_account_id: form.ap_account_id || null,
        notes: form.notes || null,
      });
      setShowModal(false);
      setForm({ ...emptyForm });
      setDocs({});
      setActiveTab("basic");
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const handleFileChange = (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDocs(d => ({ ...d, [docType]: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q || v.name_ar.includes(q) || (v.vendor_number || "").toLowerCase().includes(q) || (v.vat_number || "").includes(q);
    const matchType = !filterType || v.vendor_type === filterType;
    return matchSearch && matchType;
  });

  const typeInfo = (t: string) => VENDOR_TYPES.find(x => x.value === t);

  const isCompany = form.vendor_type === "company";
  const isIndividual = form.vendor_type === "individual";
  const isGov = form.vendor_type === "government";

  const tabs = [
    { key: "basic",     ar: "البيانات الأساسية", en: "Basic Info" },
    { key: "address",   ar: "العنوان الوطني",    en: "National Address" },
    { key: "financial", ar: "البيانات المالية",  en: "Financial" },
    { key: "docs",      ar: "المستندات",         en: "Documents" },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/purchases`}>{ar ? "المشتريات" : "Purchases"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الموردون" : "Vendors"}</span>
          </div>
          <h1 className="page-title">{ar ? "الموردون" : "Vendors"}</h1>
          <p className="page-subtitle">{ar ? "إدارة قاعدة بيانات الموردين" : "Manage vendor database"}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ ...emptyForm }); setDocs({}); setActiveTab("basic"); setShowModal(true); }}>
          <Icon name="plus" size={16} /> {ar ? "+ مورد جديد" : "+ New Vendor"}
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input className="form-input" style={{ width: 260 }}
            placeholder={ar ? "بحث بالاسم أو الرقم الضريبي..." : "Search by name or VAT..."}
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load()} />
          <select className="form-input form-select" style={{ width: 160 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">{ar ? "كل الأنواع" : "All Types"}</option>
            {VENDOR_TYPES.map(t => <option key={t.value} value={t.value}>{ar ? t.ar : t.en}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={load}>{ar ? "بحث" : "Search"}</button>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {filtered.length} {ar ? "مورد" : "vendors"}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}>
                <Icon name="users" size={24} />
              </div>
              <div className="empty-state-title">{ar ? "لا يوجد موردون" : "No vendors"}</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم المورد" : "Vendor #"}</th>
                  <th>{ar ? "الاسم" : "Name"}</th>
                  <th>{ar ? "النوع" : "Type"}</th>
                  <th>{ar ? "الرقم الضريبي" : "VAT"}</th>
                  <th>{ar ? "الهاتف" : "Phone"}</th>
                  <th>{ar ? "المدينة" : "City"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => {
                  const t = typeInfo(v.vendor_type);
                  return (
                    <tr key={v.id}>
                      <td><code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{v.vendor_number}</code></td>
                      <td>
                        <Link href={`/${locale}/purchases/vendors/${v.id}`} style={{ textDecoration: "none" }}>
                          <div style={{ fontWeight: 600 }}>{v.name_ar}</div>
                          {v.name_en && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{v.name_en}</div>}
                        </Link>
                      </td>
                      <td><span className={`badge ${t?.badge || "badge-gray"}`}>{ar ? t?.ar : t?.en}</span></td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{v.vat_number || "—"}</td>
                      <td style={{ fontSize: 12 }}>{v.phone || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{v.address_city || "—"}</td>
                      <td><span className={`badge ${v.is_active !== false ? "badge-success" : "badge-gray"}`}>{v.is_active !== false ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Link href={`/${locale}/purchases/vendors/${v.id}`} className="btn btn-ghost btn-sm btn-icon"><Icon name="view" size={14} /></Link>
                          <Link href={`/${locale}/purchases/vendors/${v.id}`} className="btn btn-ghost btn-sm btn-icon"><Icon name="edit" size={14} /></Link>
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

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "92vh", display: "flex", flexDirection: "column" }} className="animate-slide">
            {/* Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "مورد جديد" : "New Vendor"}</h2>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {VENDOR_TYPES.map(t => (
                    <button key={t.value} onClick={() => upd("vendor_type", t.value)}
                      className={`btn btn-sm ${form.vendor_type === t.value ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: 12 }}>
                      {ar ? t.ar : t.en}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                  style={{ padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    color: activeTab === tab.key ? "var(--primary)" : "var(--text-secondary)",
                    borderBottom: activeTab === tab.key ? "2px solid var(--primary)" : "2px solid transparent", marginBottom: -1 }}>
                  {ar ? tab.ar : tab.en}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>

              {/* ── البيانات الأساسية ── */}
              {activeTab === "basic" && (
                <>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">{ar ? "الاسم بالعربي" : "Arabic Name"} <span className="required">*</span></label>
                      <input className="form-input" value={form.name_ar} onChange={e => upd("name_ar", e.target.value)}
                        placeholder={isIndividual ? (ar ? "محمد أحمد العمري" : "Full Name") : (ar ? "شركة المثال" : "Company Name")} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{ar ? "الاسم بالإنجليزي" : "English Name"}</label>
                      <input className="form-input" value={form.name_en} onChange={e => upd("name_en", e.target.value)} />
                    </div>
                  </div>

                  {(isCompany || isGov) && (
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">{ar ? "الرقم الضريبي" : "VAT Number"}</label>
                        <input className="form-input" value={form.vat_number} onChange={e => upd("vat_number", e.target.value)} placeholder="300XXXXXXXXX1003" maxLength={15} />
                        <p className="form-hint">{ar ? "15 رقم — يبدأ وينتهي بـ 3" : "15 digits"}</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">{ar ? "رقم السجل التجاري" : "CR Number"}</label>
                        <input className="form-input" value={form.cr_number} onChange={e => upd("cr_number", e.target.value)} placeholder="1010XXXXXX" />
                      </div>
                    </div>
                  )}

                  {isIndividual && (
                    <div className="form-group">
                      <label className="form-label">{ar ? "رقم الهوية الوطنية / الإقامة" : "National ID / Iqama"}</label>
                      <input className="form-input" value={form.national_id} onChange={e => upd("national_id", e.target.value)} placeholder="1XXXXXXXXX" maxLength={10} />
                    </div>
                  )}

                  {isCompany && (
                    <>
                      <div className="divider" />
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {ar ? "بيانات المالك / المدير" : "Owner / Manager Info"}
                      </div>
                      <div className="grid-2">
                        <div className="form-group">
                          <label className="form-label">{ar ? "اسم المالك" : "Owner Name"}</label>
                          <input className="form-input" value={form.owner_name} onChange={e => upd("owner_name", e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">{ar ? "النشاط التجاري" : "Business Activity"}</label>
                          <input className="form-input" value={form.activity_type} onChange={e => upd("activity_type", e.target.value)} placeholder={ar ? "تجارة التجزئة" : "Retail Trade"} />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="divider" />
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">{ar ? "الهاتف" : "Phone"}</label>
                      <input className="form-input" value={form.phone} onChange={e => upd("phone", e.target.value)} placeholder="+966 5x xxx xxxx" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{ar ? "هاتف إضافي" : "Phone 2"}</label>
                      <input className="form-input" value={form.phone2} onChange={e => upd("phone2", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">{ar ? "البريد الإلكتروني" : "Email"}</label>
                      <input type="email" className="form-input" value={form.email} onChange={e => upd("email", e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{ar ? "الموقع الإلكتروني" : "Website"}</label>
                      <input className="form-input" value={form.website} onChange={e => upd("website", e.target.value)} placeholder="https://" />
                    </div>
                  </div>
                </>
              )}

              {/* ── العنوان الوطني ── */}
              {activeTab === "address" && (
                <>
                  <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: "#1E40AF" }}>
                    {ar ? "العنوان الوطني مطلوب للفواتير الضريبية وفق متطلبات زاتكا" : "National address required for ZATCA-compliant tax invoices"}
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">{ar ? "رقم المبنى" : "Building No."}</label>
                      <input className="form-input" value={form.address_building} onChange={e => upd("address_building", e.target.value)} placeholder="1234" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{ar ? "اسم الشارع" : "Street Name"}</label>
                      <input className="form-input" value={form.address_street} onChange={e => upd("address_street", e.target.value)} placeholder={ar ? "شارع الملك فهد" : "King Fahd Road"} />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">{ar ? "الحي" : "District"}</label>
                      <input className="form-input" value={form.address_district} onChange={e => upd("address_district", e.target.value)} placeholder={ar ? "العليا" : "Al Olaya"} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{ar ? "المدينة" : "City"}</label>
                      <input className="form-input" list="cities-list-v" value={form.address_city} onChange={e => upd("address_city", e.target.value)} placeholder={ar ? "الرياض" : "Riyadh"} />
                      <datalist id="cities-list-v">{SAUDI_CITIES.map(c => <option key={c} value={c} />)}</datalist>
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">{ar ? "الرمز البريدي" : "Postal Code"}</label>
                      <input className="form-input" value={form.address_postal} onChange={e => upd("address_postal", e.target.value)} placeholder="12345" maxLength={5} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{ar ? "الرمز الإضافي" : "Additional Code"}</label>
                      <input className="form-input" value={form.address_additional} onChange={e => upd("address_additional", e.target.value)} placeholder="6789" maxLength={4} />
                    </div>
                  </div>
                </>
              )}

              {/* ── البيانات المالية ── */}
              {activeTab === "financial" && (
                <>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">{ar ? "شروط الدفع (أيام)" : "Payment Terms (days)"}</label>
                      <select className="form-input form-select" value={form.payment_terms_days} onChange={e => upd("payment_terms_days", e.target.value)}>
                        {PAYMENT_TERMS.map(d => <option key={d} value={d}>{d} {ar ? "يوم" : "days"}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{ar ? "حد الائتمان (ر.س)" : "Credit Limit (SAR)"}</label>
                      <input type="number" className="form-input" value={form.credit_limit} onChange={e => upd("credit_limit", e.target.value)} min="0" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "حساب الدائنين (AP)" : "AP Account"}</label>
                    <select className="form-input form-select" value={form.ap_account_id} onChange={e => upd("ap_account_id", e.target.value)}>
                      <option value="">{ar ? "— اختر الحساب —" : "— Select Account —"}</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
                    <textarea className="form-input" rows={3} value={form.notes} onChange={e => upd("notes", e.target.value)} />
                  </div>
                </>
              )}

              {/* ── المستندات ── */}
              {activeTab === "docs" && (
                <>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                    {ar ? "ارفع صور أو ملفات PDF للمستندات الرسمية (حد أقصى 5MB لكل ملف)" : "Upload images or PDFs of official documents (max 5MB each)"}
                  </p>
                  {[
                    { key: "cr_document",  ar: "صورة السجل التجاري",       en: "CR Document",    show: isCompany || isGov },
                    { key: "vat_document", ar: "شهادة التسجيل الضريبي",    en: "VAT Certificate", show: isCompany || isGov },
                    { key: "national_id_document", ar: "صورة الهوية الوطنية", en: "National ID",  show: true },
                  ].filter(d => d.show).map(doc => (
                    <div key={doc.key} className="form-group">
                      <label className="form-label">{ar ? doc.ar : doc.en}</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input ref={el => { fileRefs.current[doc.key] = el; }} type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                          onChange={e => handleFileChange(doc.key, e)} />
                        <button className="btn btn-secondary btn-sm" onClick={() => fileRefs.current[doc.key]?.click()}>
                          {ar ? "اختر ملف" : "Choose File"}
                        </button>
                        {docs[doc.key] ? (
                          <span style={{ fontSize: 12, color: "#6F4A84", fontWeight: 600 }}>✓ {ar ? "تم الاختيار" : "Selected"}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{ar ? "لم يتم الاختيار" : "No file chosen"}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {tabs.map(tab => (
                  <div key={tab.key} style={{ width: 8, height: 8, borderRadius: "50%", background: activeTab === tab.key ? "var(--primary)" : "var(--border)" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ المورد" : "Save Vendor")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
