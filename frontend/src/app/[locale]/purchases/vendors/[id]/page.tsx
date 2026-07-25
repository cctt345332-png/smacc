"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { getVendor, updateVendor, getBills } from "@/lib/purchases";
import { getAccounts } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const VENDOR_TYPES = [
  { value: "company",    ar: "شركة",   en: "Company",    badge: "badge-info" },
  { value: "individual", ar: "فرد",    en: "Individual", badge: "badge-gray" },
  { value: "government", ar: "حكومي",  en: "Government", badge: "badge-warning" },
];
const PAYMENT_TERMS = [0, 15, 30, 45, 60, 90];
const SAUDI_CITIES = ["الرياض","جدة","مكة المكرمة","المدينة المنورة","الدمام","الخبر","الطائف","تبوك","أبها","القصيم","حائل","جازان","نجران","الجوف"];

const BILL_STATUS: Record<string, { ar: string; badge: string }> = {
  draft:     { ar: "مسودة",  badge: "badge-warning" },
  confirmed: { ar: "مؤكدة",  badge: "badge-info" },
  paid:      { ar: "مدفوعة", badge: "badge-success" },
  partial:   { ar: "جزئية",  badge: "badge-warning" },
  cancelled: { ar: "ملغاة",  badge: "badge-danger" },
};

const tabs = [
  { key: "basic",     ar: "بيانات أساسية", en: "Basic Info" },
  { key: "address",   ar: "العنوان",        en: "Address" },
  { key: "financial", ar: "المالية",        en: "Financial" },
  { key: "docs",      ar: "المستندات",      en: "Documents" },
];

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontFamily: mono ? "monospace" : undefined, color: value ? "var(--text-primary)" : "var(--text-muted)" }}>{value || "—"}</div>
    </div>
  );
}

export default function VendorDetailPage({ params: { locale, id } }: { params: { locale: string; id: string } }) {
  const ar = locale === "ar";
  const [vendor, setVendor] = useState<any>(null);
  const [bills, setBills] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [activeTab, setActiveTab] = useState("basic");
  const [docs, setDocs] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    try {
      const [vRes, bRes] = await Promise.all([getVendor(id), getBills({ vendor_id: id })]);
      setVendor(vRes.data);
      setBills((bRes.data || []).slice(0, 5));
      const v = vRes.data;
      setForm({
        vendor_type: v.vendor_type || "company",
        name_ar: v.name_ar || "", name_en: v.name_en || "",
        vat_number: v.vat_number || "", cr_number: v.cr_number || "",
        national_id: v.national_id || "", owner_name: v.owner_name || "",
        activity_type: v.activity_type || "",
        address_building: v.address_building || "", address_street: v.address_street || "",
        address_district: v.address_district || "", address_city: v.address_city || "",
        address_postal: v.address_postal || "", address_additional: v.address_additional || "",
        address_country: v.address_country || "SA",
        phone: v.phone || "", phone2: v.phone2 || "",
        email: v.email || "", website: v.website || "",
        payment_terms_days: String(v.payment_terms_days ?? "30"),
        credit_limit: String(v.credit_limit ?? "0"),
        ap_account_id: v.ap_account_id || "", notes: v.notes || "",
      });
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    getAccounts().then(({ data }) => setAccounts(data)).catch(() => {});
  }, [id]);

  const upd = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name_ar) return alert(ar ? "الاسم بالعربي مطلوب" : "Arabic name is required");
    setSaving(true);
    try {
      await updateVendor(id, {
        ...form,
        payment_terms_days: parseInt(form.payment_terms_days) || 30,
        credit_limit: parseFloat(form.credit_limit) || 0,
        vat_number: form.vat_number || null, cr_number: form.cr_number || null,
        national_id: form.national_id || null, owner_name: form.owner_name || null,
        activity_type: form.activity_type || null, name_en: form.name_en || null,
        phone2: form.phone2 || null, website: form.website || null,
        ap_account_id: form.ap_account_id || null, notes: form.notes || null,
      });
      setShowModal(false);
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

  if (loading) return <div className="empty-state" style={{ minHeight: "60vh" }}><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;
  if (!vendor) return <div className="empty-state" style={{ minHeight: "60vh" }}><div className="empty-state-title">{ar ? "المورد غير موجود" : "Vendor not found"}</div></div>;

  const typeInfo = VENDOR_TYPES.find(t => t.value === vendor.vendor_type);
  const isCompany = form.vendor_type === "company";
  const isIndividual = form.vendor_type === "individual";
  const isGov = form.vendor_type === "government";

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/purchases`}>{ar ? "المشتريات" : "Purchases"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/purchases/vendors`}>{ar ? "الموردون" : "Vendors"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{vendor.vendor_number}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <h1 className="page-title">{vendor.name_ar}</h1>
            <span className={`badge ${typeInfo?.badge || "badge-gray"}`}>{ar ? typeInfo?.ar : typeInfo?.en}</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{vendor.vendor_number}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/reports/purchases/statement?vendor_id=${id}`} className="btn btn-secondary btn-sm">
            <Icon name="ledger" size={14} /> {ar ? "كشف الحساب" : "Statement"}
          </Link>
          <button className="btn btn-primary btn-sm" onClick={() => { setActiveTab("basic"); setShowModal(true); }}>
            <Icon name="edit" size={14} /> {ar ? "تعديل" : "Edit"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              color: activeTab === t.key ? "var(--primary)" : "var(--text-secondary)",
              borderBottom: activeTab === t.key ? "2px solid var(--primary)" : "2px solid transparent", marginBottom: -1 }}>
            {ar ? t.ar : t.en}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: "20px 24px" }}>
          {activeTab === "basic" && (
            <div className="grid-2">
              <Field label={ar ? "الاسم بالعربي" : "Arabic Name"} value={vendor.name_ar} />
              <Field label={ar ? "الاسم بالإنجليزي" : "English Name"} value={vendor.name_en} />
              <Field label={ar ? "الرقم الضريبي" : "VAT Number"} value={vendor.vat_number} mono />
              <Field label={ar ? "رقم السجل التجاري" : "CR Number"} value={vendor.cr_number} mono />
              <Field label={ar ? "رقم الهوية" : "National ID"} value={vendor.national_id} mono />
              <Field label={ar ? "اسم المالك" : "Owner Name"} value={vendor.owner_name} />
              <Field label={ar ? "النشاط التجاري" : "Activity"} value={vendor.activity_type} />
              <Field label={ar ? "الهاتف" : "Phone"} value={vendor.phone} />
              <Field label={ar ? "هاتف إضافي" : "Phone 2"} value={vendor.phone2} />
              <Field label={ar ? "البريد الإلكتروني" : "Email"} value={vendor.email} />
              <Field label={ar ? "الموقع الإلكتروني" : "Website"} value={vendor.website} />
            </div>
          )}
          {activeTab === "address" && (
            <div className="grid-2">
              <Field label={ar ? "رقم المبنى" : "Building No."} value={vendor.address_building} />
              <Field label={ar ? "اسم الشارع" : "Street"} value={vendor.address_street} />
              <Field label={ar ? "الحي" : "District"} value={vendor.address_district} />
              <Field label={ar ? "المدينة" : "City"} value={vendor.address_city} />
              <Field label={ar ? "الرمز البريدي" : "Postal Code"} value={vendor.address_postal} />
              <Field label={ar ? "الرمز الإضافي" : "Additional Code"} value={vendor.address_additional} />
            </div>
          )}
          {activeTab === "financial" && (
            <div className="grid-2">
              <Field label={ar ? "شروط الدفع" : "Payment Terms"} value={vendor.payment_terms_days ? `${vendor.payment_terms_days} ${ar ? "يوم" : "days"}` : undefined} />
              <Field label={ar ? "حد الائتمان" : "Credit Limit"} value={vendor.credit_limit != null ? `${fmt(vendor.credit_limit)} SAR` : undefined} />
              <Field label={ar ? "ملاحظات" : "Notes"} value={vendor.notes} />
            </div>
          )}
          {activeTab === "docs" && (
            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {ar ? "لا توجد مستندات مرفوعة حالياً." : "No documents uploaded yet."}
            </div>
          )}
        </div>
      </div>

      {/* Recent Bills */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "آخر الفواتير الواردة" : "Recent Bills"}</span>
          <Link href={`/${locale}/purchases/bills`} className="btn btn-ghost btn-sm">{ar ? "عرض الكل" : "View All"}</Link>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {bills.length === 0 ? (
            <div className="empty-state" style={{ padding: "32px 20px" }}>
              <div className="empty-state-title" style={{ fontSize: 13 }}>{ar ? "لا توجد فواتير" : "No bills"}</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم الفاتورة" : "Bill #"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "الاستحقاق" : "Due"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المتبقي" : "Remaining"}</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b: any) => {
                  const st = BILL_STATUS[b.status] || { ar: b.status, badge: "badge-gray" };
                  const rem = Math.max(0, Number(b.total || 0) - Number(b.paid_amount || 0));
                  return (
                    <tr key={b.id}>
                      <td><Link href={`/${locale}/purchases/bills/${b.id}`} style={{ fontWeight: 600, color: "var(--primary)" }}>{b.bill_number}</Link></td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{b.bill_date?.split("T")[0] || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{b.due_date?.split("T")[0] || "—"}</td>
                      <td><span className={`badge ${st.badge}`}>{st.ar}</span></td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(b.total)} SAR</td>
                      <td style={{ textAlign: "end", color: rem > 0.01 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>{fmt(rem)} SAR</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "92vh", display: "flex", flexDirection: "column" }} className="animate-slide">
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "تعديل المورد" : "Edit Vendor"}</h2>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {VENDOR_TYPES.map(t => (
                    <button key={t.value} onClick={() => upd("vendor_type", t.value)}
                      className={`btn btn-sm ${form.vendor_type === t.value ? "btn-primary" : "btn-secondary"}`} style={{ fontSize: 12 }}>
                      {ar ? t.ar : t.en}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{ padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    color: activeTab === tab.key ? "var(--primary)" : "var(--text-secondary)",
                    borderBottom: activeTab === tab.key ? "2px solid var(--primary)" : "2px solid transparent", marginBottom: -1 }}>
                  {ar ? tab.ar : tab.en}
                </button>
              ))}
            </div>
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              {activeTab === "basic" && (
                <>
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
                  {(isCompany || isGov) && (
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">{ar ? "الرقم الضريبي" : "VAT Number"}</label>
                        <input className="form-input" value={form.vat_number} onChange={e => upd("vat_number", e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{ar ? "رقم السجل التجاري" : "CR Number"}</label>
                        <input className="form-input" value={form.cr_number} onChange={e => upd("cr_number", e.target.value)} />
                      </div>
                    </div>
                  )}
                  {isIndividual && (
                    <div className="form-group">
                      <label className="form-label">{ar ? "رقم الهوية" : "National ID"}</label>
                      <input className="form-input" value={form.national_id} onChange={e => upd("national_id", e.target.value)} />
                    </div>
                  )}
                  {isCompany && (
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">{ar ? "اسم المالك" : "Owner Name"}</label>
                        <input className="form-input" value={form.owner_name} onChange={e => upd("owner_name", e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{ar ? "النشاط التجاري" : "Activity"}</label>
                        <input className="form-input" value={form.activity_type} onChange={e => upd("activity_type", e.target.value)} />
                      </div>
                    </div>
                  )}
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">{ar ? "الهاتف" : "Phone"}</label>
                      <input className="form-input" value={form.phone} onChange={e => upd("phone", e.target.value)} />
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
                      <input className="form-input" value={form.website} onChange={e => upd("website", e.target.value)} />
                    </div>
                  </div>
                </>
              )}
              {activeTab === "address" && (
                <>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">{ar ? "رقم المبنى" : "Building No."}</label>
                      <input className="form-input" value={form.address_building} onChange={e => upd("address_building", e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{ar ? "اسم الشارع" : "Street"}</label>
                      <input className="form-input" value={form.address_street} onChange={e => upd("address_street", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">{ar ? "الحي" : "District"}</label>
                      <input className="form-input" value={form.address_district} onChange={e => upd("address_district", e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{ar ? "المدينة" : "City"}</label>
                      <input className="form-input" list="cities-vd" value={form.address_city} onChange={e => upd("address_city", e.target.value)} />
                      <datalist id="cities-vd">{SAUDI_CITIES.map(c => <option key={c} value={c} />)}</datalist>
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">{ar ? "الرمز البريدي" : "Postal Code"}</label>
                      <input className="form-input" value={form.address_postal} onChange={e => upd("address_postal", e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{ar ? "الرمز الإضافي" : "Additional Code"}</label>
                      <input className="form-input" value={form.address_additional} onChange={e => upd("address_additional", e.target.value)} />
                    </div>
                  </div>
                </>
              )}
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
              {activeTab === "docs" && (
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {ar ? "ارفع صور أو ملفات PDF للمستندات الرسمية" : "Upload images or PDFs of official documents"}
                </p>
              )}
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التعديلات" : "Save Changes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
