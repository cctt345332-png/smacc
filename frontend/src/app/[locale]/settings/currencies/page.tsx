"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

const IcPlus  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcClose = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcStar  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;

const COMMON_CURRENCIES = [
  { code: "SAR", name_ar: "ريال سعودي",    name_en: "Saudi Riyal",       symbol: "ر.س" },
  { code: "USD", name_ar: "دولار أمريكي",  name_en: "US Dollar",         symbol: "$" },
  { code: "EUR", name_ar: "يورو",           name_en: "Euro",              symbol: "€" },
  { code: "AED", name_ar: "درهم إماراتي",  name_en: "UAE Dirham",        symbol: "د.إ" },
  { code: "GBP", name_ar: "جنيه إسترليني", name_en: "British Pound",     symbol: "£" },
  { code: "KWD", name_ar: "دينار كويتي",   name_en: "Kuwaiti Dinar",     symbol: "د.ك" },
  { code: "QAR", name_ar: "ريال قطري",     name_en: "Qatari Riyal",      symbol: "ر.ق" },
  { code: "BHD", name_ar: "دينار بحريني",  name_en: "Bahraini Dinar",    symbol: "د.ب" },
  { code: "OMR", name_ar: "ريال عماني",    name_en: "Omani Riyal",       symbol: "ر.ع" },
  { code: "EGP", name_ar: "جنيه مصري",     name_en: "Egyptian Pound",    symbol: "ج.م" },
  { code: "JOD", name_ar: "دينار أردني",   name_en: "Jordanian Dinar",   symbol: "د.أ" },
  { code: "TRY", name_ar: "ليرة تركية",    name_en: "Turkish Lira",      symbol: "₺" },
];

export default function CurrenciesPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [form, setForm] = useState({ code: "USD", name_ar: "", name_en: "", symbol: "", exchange_rate: "1.00" });

  const load = async () => {
    try {
      const { data } = await api.get("/accounting/currencies");
      setCurrencies(data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const selectCommon = (c: typeof COMMON_CURRENCIES[0]) => {
    setForm({ code: c.code, name_ar: c.name_ar, name_en: c.name_en, symbol: c.symbol, exchange_rate: "1.00" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/accounting/currencies", {
        code: form.code.toUpperCase(),
        name_ar: form.name_ar,
        name_en: form.name_en,
        symbol: form.symbol,
        exchange_rate: parseFloat(form.exchange_rate),
      });
      setShowModal(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || (ar ? "حدث خطأ" : "An error occurred"));
    } finally { setSaving(false); }
  };

  if (loading) return <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/settings`}>{ar ? "الإعدادات" : "Settings"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "العملات" : "Currencies"}</span>
          </div>
          <h1 className="page-title">{ar ? "إدارة العملات" : "Currency Management"}</h1>
          <p className="page-subtitle">{ar ? "العملات المستخدمة في الفواتير والتقارير" : "Currencies used in invoices and reports"}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ code: "USD", name_ar: "", name_en: "", symbol: "", exchange_rate: "1.00" }); setError(""); setShowModal(true); }}>
          <IcPlus />{ar ? "إضافة عملة" : "Add Currency"}
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{ar ? "الرمز" : "Code"}</th>
                <th>{ar ? "الاسم" : "Name"}</th>
                <th>{ar ? "الرمز المختصر" : "Symbol"}</th>
                <th>{ar ? "سعر الصرف" : "Exchange Rate"}</th>
                <th>{ar ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {currencies.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  {ar ? "لا توجد عملات مضافة" : "No currencies added"}
                </td></tr>
              ) : currencies.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: "var(--primary)" }}>{c.code}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{ar ? c.name_ar : c.name_en}</div>
                    {ar && c.name_en && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.name_en}</div>}
                  </td>
                  <td style={{ fontWeight: 700, fontSize: 15 }}>{c.symbol}</td>
                  <td>
                    <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{Number(c.exchange_rate).toFixed(4)}</span>
                    {c.is_base && <span className="badge badge-info" style={{ marginInlineStart: 8, fontSize: 10 }}>{ar ? "أساسية" : "Base"}</span>}
                  </td>
                  <td>
                    <span className={c.is_active ? "badge badge-success" : "badge badge-gray"}>
                      {c.is_active ? (ar ? "نشطة" : "Active") : (ar ? "موقوفة" : "Inactive")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 520, borderRadius: 16 }}>
            <div className="card-header">
              <span className="card-title">{ar ? "إضافة عملة" : "Add Currency"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><IcClose /></button>
            </div>
            <div className="card-body">
              {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>{error}</div>}

              {/* اختيار سريع */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>{ar ? "اختيار سريع:" : "Quick select:"}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {COMMON_CURRENCIES.map(c => (
                    <button key={c.code} type="button" onClick={() => selectCommon(c)}
                      style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${form.code === c.code ? "var(--primary)" : "var(--border)"}`, background: form.code === c.code ? "var(--primary-light)" : "white", color: form.code === c.code ? "var(--primary)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      {form.code === c.code && <IcStar />}{c.code}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">{ar ? "رمز العملة" : "Currency Code"} <span className="required">*</span></label>
                    <input className="form-input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required maxLength={3} placeholder="USD" style={{ fontFamily: "monospace", fontWeight: 700 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "الرمز المختصر" : "Symbol"} <span className="required">*</span></label>
                    <input className="form-input" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} required placeholder="$" />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">{ar ? "الاسم بالعربي" : "Arabic Name"} <span className="required">*</span></label>
                    <input className="form-input" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} required placeholder="دولار أمريكي" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "الاسم بالإنجليزي" : "English Name"}</label>
                    <input className="form-input" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} placeholder="US Dollar" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "سعر الصرف مقابل الريال السعودي" : "Exchange Rate vs SAR"} <span className="required">*</span></label>
                  <input type="number" className="form-input" value={form.exchange_rate} onChange={e => setForm(f => ({ ...f, exchange_rate: e.target.value }))} required min="0.0001" step="0.0001" placeholder="3.7500" />
                  <p className="form-hint">{ar ? "مثال: 1 دولار = 3.75 ريال → أدخل 3.75" : "Example: 1 USD = 3.75 SAR → enter 3.75"}</p>
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "إضافة" : "Add")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
