"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getCustomers, createCustomer } from "@/lib/sales";

const emptyForm = {
  customer_type: "individual",
  name_ar: "", name_en: "",
  phone: "", email: "",
  address_city: "",
  vat_number: "", cr_number: "", national_id: "",
  payment_terms_days: "30", credit_limit: "0",
  notes: "",
};

export default function RepCustomersPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const searchParams = useSearchParams();

  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState("");

  const load = (q?: string) => {
    setLoading(true);
    getCustomers(q)
      .then(res => setCustomers(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  /* فتح modal إذا جاء ?action=new */
  useEffect(() => {
    if (searchParams?.get("action") === "new") {
      setForm({ ...emptyForm });
      setError("");
      setShowModal(true);
    }
  }, [searchParams]);

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name_ar.trim()) { setError(ar ? "الاسم بالعربي مطلوب" : "Arabic name is required"); return; }
    setSaving(true); setError("");
    try {
      await createCustomer({
        ...form,
        payment_terms_days: parseInt(form.payment_terms_days) || 30,
        credit_limit: parseFloat(form.credit_limit) || 0,
        vat_number: form.vat_number || null,
        cr_number: form.cr_number || null,
        national_id: form.national_id || null,
        name_en: form.name_en || null,
        notes: form.notes || null,
      } as any);
      setShowModal(false);
      setForm({ ...emptyForm });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Error");
    } finally { setSaving(false); }
  };

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name_ar.toLowerCase().includes(q) || (c.customer_number || "").toLowerCase().includes(q) || (c.phone || "").includes(q);
  });

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{ar ? "العملاء" : "Customers"}</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            {filtered.length} {ar ? "عميل" : "customers"}
          </p>
        </div>
        <button onClick={() => { setForm({ ...emptyForm }); setError(""); setShowModal(true); }}
          style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#2563EB", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {ar ? "عميل جديد" : "New Customer"}
        </button>
      </div>

      {/* بحث */}
      <div style={{ marginBottom: 14 }}>
        <input className="form-input" style={{ width: "100%", maxWidth: 360 }}
          placeholder={ar ? "بحث باسم العميل أو الجوال..." : "Search name or phone..."}
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* الجدول */}
      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {ar ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
              {ar ? "لا يوجد عملاء" : "No customers found"}
            </div>
            <button onClick={() => { setForm({ ...emptyForm }); setError(""); setShowModal(true); }}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#2563EB", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              + {ar ? "أضف عميلاً" : "Add Customer"}
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "10px 16px", textAlign: "start", fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "رقم العميل" : "#"}</th>
                  <th style={{ padding: "10px 8px", fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "الاسم" : "Name"}</th>
                  <th style={{ padding: "10px 8px", fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "الجوال" : "Phone"}</th>
                  <th style={{ padding: "10px 8px", fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "المدينة" : "City"}</th>
                  <th style={{ padding: "10px 8px", fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "الحالة" : "Status"}</th>
                  <th style={{ padding: "10px 16px" }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)" }}>{c.customer_number}</td>
                    <td style={{ padding: "12px 8px", fontWeight: 700 }}>{c.name_ar}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{c.phone || "—"}</td>
                    <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{c.address_city || "—"}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                        background: c.is_active ? "#D1FAE5" : "#FEE2E2",
                        color: c.is_active ? "#059669" : "#DC2626" }}>
                        {c.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/${locale}/reps/me/invoices/new?customer=${c.id}`}
                        style={{ fontSize: 12, color: "#2563EB", fontWeight: 600, textDecoration: "none", padding: "4px 10px", border: "1px solid #BFDBFE", borderRadius: 6, background: "#EFF6FF" }}>
                        {ar ? "فاتورة" : "Invoice"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal إضافة عميل */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}>
          <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", padding: "24px 20px 32px" }}>
            {/* Handle */}
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 20px" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{ar ? "عميل جديد" : "New Customer"}</h2>
              <button onClick={() => setShowModal(false)}
                style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 18, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            {error && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 14, color: "#DC2626", fontSize: 13 }}>{error}</div>
            )}

            {/* نوع العميل */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>{ar ? "نوع العميل" : "Customer Type"}</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ v: "individual", ar: "فرد", en: "Individual" }, { v: "company", ar: "شركة", en: "Company" }].map(t => (
                  <button key={t.v} type="button" onClick={() => upd("customer_type", t.v)}
                    style={{ flex: 1, padding: "8px", borderRadius: 8, border: "2px solid", borderColor: form.customer_type === t.v ? "#2563EB" : "var(--border)", background: form.customer_type === t.v ? "#EFF6FF" : "var(--surface)", color: form.customer_type === t.v ? "#2563EB" : "var(--text-primary)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    {ar ? t.ar : t.en}
                  </button>
                ))}
              </div>
            </div>

            {/* الاسم */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{ar ? "الاسم بالعربي *" : "Arabic Name *"}</label>
                <input className="form-input" value={form.name_ar} onChange={e => upd("name_ar", e.target.value)} placeholder={ar ? "الاسم..." : "Name..."} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{ar ? "الاسم بالإنجليزي" : "English Name"}</label>
                <input className="form-input" value={form.name_en} onChange={e => upd("name_en", e.target.value)} placeholder="Name..." dir="ltr" />
              </div>
            </div>

            {/* الجوال والبريد */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{ar ? "الجوال" : "Phone"}</label>
                <input className="form-input" value={form.phone} onChange={e => upd("phone", e.target.value)} placeholder="05xxxxxxxx" dir="ltr" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{ar ? "المدينة" : "City"}</label>
                <input className="form-input" value={form.address_city} onChange={e => upd("address_city", e.target.value)} placeholder={ar ? "الرياض" : "Riyadh"} />
              </div>
            </div>

            {/* الرقم الضريبي / الهوية */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  {form.customer_type === "company" ? (ar ? "الرقم الضريبي" : "VAT Number") : (ar ? "رقم الهوية" : "ID Number")}
                </label>
                <input className="form-input" dir="ltr"
                  value={form.customer_type === "company" ? form.vat_number : form.national_id}
                  onChange={e => upd(form.customer_type === "company" ? "vat_number" : "national_id", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{ar ? "مدة السداد (يوم)" : "Payment Terms (days)"}</label>
                <select className="form-input form-select" value={form.payment_terms_days} onChange={e => upd("payment_terms_days", e.target.value)}>
                  {[0, 15, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d === 0 ? (ar ? "نقدي فوري" : "Cash") : `${d} ${ar ? "يوم" : "days"}`}</option>)}
                </select>
              </div>
            </div>

            {/* ملاحظات */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{ar ? "ملاحظات" : "Notes"}</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => upd("notes", e.target.value)} placeholder={ar ? "ملاحظات اختيارية..." : "Optional..."} />
            </div>

            {/* أزرار */}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)" }}>
                {ar ? "إلغاء" : "Cancel"}
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: "#2563EB", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ العميل" : "Save Customer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
