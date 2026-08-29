"use client";
import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, getCustomerReceivableAccounts } from "@/lib/sales";
import api from "@/lib/api";
import { Icon } from "@/components/ui/Icons";

const CUSTOMER_TYPES = [
  { value: "company",    ar: "شركة",   en: "Company",    badge: "badge-info" },
  { value: "individual", ar: "فرد",    en: "Individual", badge: "badge-gray" },
  { value: "government", ar: "حكومي",  en: "Government", badge: "badge-warning" },
];

const PAYMENT_TERMS = [0, 15, 30, 45, 60, 90];
const SAUDI_CITIES = ["الرياض","جدة","مكة المكرمة","المدينة المنورة","الدمام","الخبر","الطائف","تبوك","أبها","القصيم","حائل","جازان","نجران","الجوف"];

const emptyForm = {
  customer_type: "company",
  name_ar: "", name_en: "",
  vat_number: "", cr_number: "", national_id: "",
  owner_name: "", owner_national_id: "",
  license_number: "", activity_type: "",
  address_building: "", address_street: "",
  address_district: "", address_city: "",
  address_postal: "", address_additional: "",
  address_country: "SA",
  phone: "", phone2: "", email: "", website: "",
  payment_terms_days: "30", credit_limit: "0", ar_account_id: "", opening_balance: "0", notes: "",
};

export default function CustomersPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerAccounts, setCustomerAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [activeTab, setActiveTab] = useState<"basic" | "address" | "financial" | "docs">("basic");
  const [docs, setDocs] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    try { const { data } = await getCustomers(search || undefined); setCustomers(data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!showModal) return;
    getCustomerReceivableAccounts()
      .then(({ data }) => setCustomerAccounts(data))
      .catch(() => setCustomerAccounts([]));
  }, [showModal]);

  // فتح modal إضافة عميل تلقائياً إذا جاء من الداشبورد
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "new") {
        setForm({ ...emptyForm });
        setDocs({});
        setActiveTab("basic");
        setShowModal(true);
      }
    }
  }, []);

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const openNew = () => { setEditingCustomer(null); setForm({ ...emptyForm }); setDocs({}); setActiveTab("basic"); setShowModal(true); };
  const openEdit = (customer: any) => {
    setEditingCustomer(customer);
    setForm({ ...emptyForm, ...Object.fromEntries(Object.entries(emptyForm).map(([key, value]) => [key, customer[key] == null ? value : String(customer[key])])) });
    setDocs({}); setActiveTab("basic"); setShowModal(true);
  };
  const handleDelete = async (customer: any) => {
    if (!window.confirm(ar ? `حذف العميل «${customer.name_ar}»؟ لا يمكن التراجع.` : `Delete ${customer.name_ar}? This cannot be undone.`)) return;
    try { await deleteCustomer(customer.id); await load(); }
    catch (e: any) { alert(e?.response?.data?.detail || (ar ? "تعذر حذف العميل" : "Could not delete customer")); }
  };

  const handleSave = async () => {
    if (!form.name_ar) return alert(ar ? "الاسم بالعربي مطلوب" : "Arabic name is required");
    if (!editingCustomer && !form.ar_account_id) return alert(ar ? "يجب اختيار حساب العميل الرئيسي من شجرة الحسابات" : "Select the customer's main account from the chart of accounts");
    setSaving(true);
    try {
      const payload = {
        ...form,
        payment_terms_days: parseInt(form.payment_terms_days) || 30,
        credit_limit: parseFloat(form.credit_limit) || 0,
        opening_balance: parseFloat(form.opening_balance) || 0,
        ar_account_id: form.ar_account_id || null,
        vat_number: form.vat_number || null,
        cr_number: form.cr_number || null,
        national_id: form.national_id || null,
        owner_name: form.owner_name || null,
        owner_national_id: form.owner_national_id || null,
        license_number: form.license_number || null,
        activity_type: form.activity_type || null,
        name_en: form.name_en || null,
        phone2: form.phone2 || null,
        website: form.website || null,
        notes: form.notes || null,
      };
      const { data } = editingCustomer ? await updateCustomer(editingCustomer.id, payload) : await createCustomer(payload);
      // رفع الملفات إذا وجدت
      for (const [docType, b64] of Object.entries(docs)) {
        if (b64) {
          const blob = await fetch(b64).then(r => r.blob());
          const fd = new FormData();
          fd.append("file", blob, `${docType}.pdf`);
          await api.post(`/sales/customers/${data.id}/documents/${docType}`, fd);
        }
      }
      setShowModal(false);
      setEditingCustomer(null);
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

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name_ar.includes(q) || c.customer_number.toLowerCase().includes(q) || (c.vat_number || "").includes(q);
    const matchType = !filterType || c.customer_type === filterType;
    return matchSearch && matchType;
  });

  const typeInfo = (t: string) => CUSTOMER_TYPES.find(x => x.value === t);

  // الحقول حسب نوع العميل
  const isCompany = form.customer_type === "company";
  const isIndividual = form.customer_type === "individual";
  const isGov = form.customer_type === "government";

  const tabs = [{ key: "basic", ar: "بيانات العميل", en: "Customer details" }];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/sales`}>{ar ? "المبيعات" : "Sales"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "العملاء" : "Customers"}</span>
          </div>
          <h1 className="page-title">{ar ? "العملاء" : "Customers"}</h1>
          <p className="page-subtitle">{ar ? "إدارة قاعدة بيانات العملاء" : "Manage customer database"}</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Icon name="plus" size={16} /> {ar ? "+ عميل جديد" : "+ New Customer"}
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
            {CUSTOMER_TYPES.map(t => <option key={t.value} value={t.value}>{ar ? t.ar : t.en}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={load}>{ar ? "بحث" : "Search"}</button>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {filtered.length} {ar ? "عميل" : "customers"}
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
              <div className="empty-state-title">{ar ? "لا يوجد عملاء" : "No customers"}</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم العميل" : "Customer #"}</th>
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
                {filtered.map(c => {
                  const t = typeInfo(c.customer_type);
                  return (
                    <tr key={c.id}>
                      <td><code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{c.customer_number}</code></td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name_ar}</div>
                        {c.name_en && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.name_en}</div>}
                      </td>
                      <td><span className={`badge ${t?.badge || "badge-gray"}`}>{ar ? t?.ar : t?.en}</span></td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.vat_number || "—"}</td>
                      <td style={{ fontSize: 12 }}>{c.phone || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.address_city || "—"}</td>
                      <td><span className={`badge ${c.is_active !== false ? "badge-success" : "badge-gray"}`}>{c.is_active !== false ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Link href={`/${locale}/sales/customers/${c.id}`} className="btn btn-ghost btn-sm btn-icon" title={ar ? "عرض العميل" : "View customer"}><Icon name="view" size={14} /></Link>
                          <button className="btn btn-ghost btn-sm btn-icon" title={ar ? "تعديل العميل" : "Edit customer"} onClick={() => openEdit(c)}><Icon name="edit" size={14} /></button>
                          <button className="btn btn-danger btn-sm btn-icon" title={ar ? "حذف العميل" : "Delete customer"} onClick={() => handleDelete(c)}>×</button>
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
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>{editingCustomer ? (ar ? "تعديل العميل" : "Edit Customer") : (ar ? "عميل جديد" : "New Customer")}</h2>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {CUSTOMER_TYPES.map(t => (
                    <button key={t.value} onClick={() => upd("customer_type", t.value)}
                      className={`btn btn-sm ${form.customer_type === t.value ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: 12 }}>
                      {ar ? t.ar : t.en}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {/* Content */}
            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>

              {/* ── البيانات الأساسية ── */}
              {true && (
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

                  {/* شركة: رقم ضريبي + سجل تجاري */}
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

                  {/* فرد: هوية وطنية */}
                  {isIndividual && (
                    <div className="form-group">
                      <label className="form-label">{ar ? "رقم الهوية الوطنية / الإقامة" : "National ID / Iqama"}</label>
                      <input className="form-input" value={form.national_id} onChange={e => upd("national_id", e.target.value)} placeholder="1XXXXXXXXX" maxLength={10} />
                    </div>
                  )}

                  {/* شركة: بيانات المالك */}
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
                          <label className="form-label">{ar ? "هوية المالك" : "Owner ID"}</label>
                          <input className="form-input" value={form.owner_national_id} onChange={e => upd("owner_national_id", e.target.value)} placeholder="1XXXXXXXXX" />
                        </div>
                      </div>
                      <div className="grid-2">
                        <div className="form-group">
                          <label className="form-label">{ar ? "رقم الترخيص" : "License Number"}</label>
                          <input className="form-input" value={form.license_number} onChange={e => upd("license_number", e.target.value)} />
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
              {true && (
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
                      <input className="form-input" list="cities-list" value={form.address_city} onChange={e => upd("address_city", e.target.value)} placeholder={ar ? "الرياض" : "Riyadh"} />
                      <datalist id="cities-list">{SAUDI_CITIES.map(c => <option key={c} value={c} />)}</datalist>
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
              {true && (
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
                    <div className="form-group">
                      <label className="form-label">{ar ? "الرصيد الافتتاحي (ر.س)" : "Opening Balance (SAR)"}</label>
                      <input type="number" className="form-input" value={form.opening_balance} onChange={e => upd("opening_balance", e.target.value)} step="0.01" />
                      <p className="form-hint">{ar ? "سيُسجل على حساب العميل الفرعي الجديد" : "Recorded on the new customer sub-account"}</p>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "الحساب الرئيسي للعملاء" : "Customer parent account"} {!editingCustomer && <span className="required">*</span>}</label>
                    <select className="form-input form-select" value={form.ar_account_id} onChange={e => upd("ar_account_id", e.target.value)} required={!editingCustomer}>
                      <option value="">{ar ? "اختر حساب العميل من شجرة الحسابات" : "Select the customer account from the chart"}</option>
                      {customerAccounts.map(account => {
                        const level = Math.max(1, Number(account.level || 1));
                        const indent = "　".repeat(Math.max(0, level - 1));
                        const marker = level > 1 ? "└ " : "";
                        const name = ar ? account.name_ar : (account.name_en || account.name_ar);
                        return (
                          <option key={account.id} value={account.id}>
                            {indent}{marker}{account.code} — {name}{account.is_posting ? " · حساب نهائي" : " · حساب رئيسي"}
                          </option>
                        );
                      })}
                    </select>
                    <p className="form-hint">
                      {customerAccounts.length
                        ? (ar ? "تظهر الشجرة كاملة بكل مستوياتها. اختر الحساب الرئيسي أو الفرع الذي تريد إنشاء حساب العميل تحته." : "The complete chart is shown by level. Choose the parent branch under which to create the customer account.")
                        : (ar ? "لم يتم العثور على حسابات في شجرة الشركة الحالية. تأكد من تحميل الحسابات ثم أعد فتح النموذج." : "No accounts were found in the current company chart. Load the chart and reopen the form.")}
                    </p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
                    <textarea className="form-input" rows={3} value={form.notes} onChange={e => upd("notes", e.target.value)} />
                  </div>
                </>
              )}

              {/* ── المستندات ── */}
              {false && (
                <>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                    {ar ? "ارفع صور أو ملفات PDF للمستندات الرسمية (حد أقصى 5MB لكل ملف)" : "Upload images or PDFs of official documents (max 5MB each)"}
                  </p>
                  {[
                    { key: "cr_document", ar: "صورة السجل التجاري", en: "CR Document", show: isCompany || isGov },
                    { key: "vat_document", ar: "شهادة التسجيل الضريبي", en: "VAT Certificate", show: isCompany || isGov },
                    { key: "national_id_document", ar: "صورة الهوية الوطنية", en: "National ID", show: true },
                    { key: "license_document", ar: "صورة الترخيص", en: "License Document", show: isCompany },
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
                          <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>✓ {ar ? "تم الاختيار" : "Selected"}</span>
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
                {tabs.map((tab, i) => (
                  <div key={tab.key} style={{ width: 8, height: 8, borderRadius: "50%", background: activeTab === tab.key ? "var(--primary)" : "var(--border)" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (editingCustomer ? (ar ? "حفظ التعديل" : "Save Changes") : (ar ? "حفظ العميل" : "Save Customer"))}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
