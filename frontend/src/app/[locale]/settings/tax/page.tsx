"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getVATSettings, saveVATSettings, getAccounts } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";

export default function TaxSettingsPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    vat_number: "", cr_number: "", vat_rate: "15",
    vat_account_id: "", zatca_env: "sandbox", is_zatca_enabled: false,
  });

  useEffect(() => {
    getAccounts().then(({ data }) => setAccounts(data));
    getVATSettings().then(({ data }) => {
      setForm({
        vat_number: data.vat_number || "",
        cr_number: data.cr_number || "",
        vat_rate: String(data.vat_rate),
        vat_account_id: data.vat_account_id || "",
        zatca_env: data.zatca_env || "sandbox",
        is_zatca_enabled: data.is_zatca_enabled,
      });
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveVATSettings({ ...form, vat_rate: parseFloat(form.vat_rate) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/settings`}>{ar ? "الإعدادات" : "Settings"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الضريبة وزاتكا" : "Tax & ZATCA"}</span>
          </div>
          <h1 className="page-title">{ar ? "إعدادات الضريبة وزاتكا" : "Tax & ZATCA Settings"}</h1>
          <p className="page-subtitle">{ar ? "متطلبات هيئة الزكاة والضريبة والجمارك" : "ZATCA compliance settings"}</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ الإعدادات" : "Save Settings")}
        </button>
      </div>

      {saved && (
        <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#166534", fontSize: 13, fontWeight: 600 }}>
          {ar ? "تم حفظ الإعدادات بنجاح" : "Settings saved successfully"}
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* VAT Info */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{ar ? "بيانات الشركة الضريبية" : "Company Tax Info"}</span>
          </div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">
                {ar ? "الرقم الضريبي" : "VAT Number"} <span className="required">*</span>
              </label>
              <input className="form-input" value={form.vat_number}
                onChange={e => setForm(f => ({ ...f, vat_number: e.target.value }))}
                placeholder="300XXXXXXXXX1003" maxLength={15} />
              <p className="form-hint">{ar ? "15 رقم — يبدأ بـ 3 وينتهي بـ 3" : "15 digits — starts and ends with 3"}</p>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "رقم السجل التجاري" : "CR Number"}</label>
              <input className="form-input" value={form.cr_number}
                onChange={e => setForm(f => ({ ...f, cr_number: e.target.value }))}
                placeholder="1010XXXXXX" />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "نسبة ضريبة القيمة المضافة" : "VAT Rate"}</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="number" className="form-input" style={{ width: 90 }} value={form.vat_rate}
                  onChange={e => setForm(f => ({ ...f, vat_rate: e.target.value }))} min="0" max="100" step="0.01" />
                <span style={{ fontWeight: 700, fontSize: 20, color: "var(--primary)" }}>%</span>
                <span className="badge badge-info">
                  {ar ? "السعودية: 15%" : "Saudi: 15%"}
                </span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "حساب ضريبة القيمة المضافة" : "VAT GL Account"}</label>
              <select className="form-input form-select" value={form.vat_account_id}
                onChange={e => setForm(f => ({ ...f, vat_account_id: e.target.value }))}>
                <option value="">{ar ? "اختر حساب..." : "Select account..."}</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ZATCA */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{ar ? "ربط زاتكا" : "ZATCA Integration"}</span>
            <span className={`badge ${form.is_zatca_enabled ? "badge-success" : "badge-gray"}`}>
              {form.is_zatca_enabled ? (ar ? "مفعّل" : "Enabled") : (ar ? "غير مفعّل" : "Disabled")}
            </span>
          </div>
          <div className="card-body">
            {/* Phase 2 info */}
            <div style={{ background: "linear-gradient(135deg,#EFF6FF,#DBEAFE)", border: "1px solid #BFDBFE", borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#1E40AF", marginBottom: 8 }}>
                {ar ? "المرحلة الثانية — الفوترة الإلكترونية" : "Phase 2 — e-Invoicing"}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 12, color: "#3B82F6", lineHeight: 2 }}>
                <li>• {ar ? "ربط النظام بمنصة فاتورة" : "Connect to Fatoora platform"}</li>
                <li>• {ar ? "إرسال الفواتير للهيئة فورياً" : "Real-time invoice submission"}</li>
                <li>• {ar ? "توليد QR Code معتمد" : "Certified QR Code generation"}</li>
                <li>• {ar ? "أرشفة الفواتير الإلكترونية" : "Electronic invoice archiving"}</li>
              </ul>
            </div>

            <div className="form-group">
              <label className="form-label">{ar ? "بيئة التشغيل" : "Environment"}</label>
              <select className="form-input form-select" value={form.zatca_env}
                onChange={e => setForm(f => ({ ...f, zatca_env: e.target.value }))}>
                <option value="sandbox">{ar ? "اختبار (Sandbox)" : "Sandbox"}</option>
                <option value="simulation">{ar ? "محاكاة (Simulation)" : "Simulation"}</option>
                <option value="production">{ar ? "إنتاج (Production)" : "Production"}</option>
              </select>
            </div>

            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                <input type="checkbox" checked={form.is_zatca_enabled}
                  onChange={e => setForm(f => ({ ...f, is_zatca_enabled: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
                {ar ? "تفعيل ربط زاتكا" : "Enable ZATCA Integration"}
              </label>
              <p className="form-hint">{ar ? "يتطلب شهادة رقمية من هيئة الزكاة" : "Requires digital certificate from ZATCA"}</p>
            </div>

            {form.is_zatca_enabled && (
              <div style={{ background: "#FEF9C3", border: "1px solid #FDE047", borderRadius: 8, padding: 12, fontSize: 12, color: "#854D0E" }}>
                {ar ? "يجب رفع الشهادة الرقمية والمفتاح الخاص من بوابة زاتكا لإتمام الربط" : "Upload the digital certificate and private key from ZATCA portal to complete integration"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VAT summary */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "ملخص الإقرار الضريبي — الربع الحالي" : "VAT Return Summary — Current Quarter"}</span>
          <Link href={`/${locale}/reports/accounting/vat`} style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>
            {ar ? "عرض التقرير الكامل ←" : "View Full Report →"}
          </Link>
        </div>
        <div className="card-body">
          <div className="grid-3">
            {[
              { label: ar ? "ضريبة المبيعات (مخرجات)" : "Output VAT", value: "0.00", color: "#059669", icon: "vatOut" as const },
              { label: ar ? "ضريبة المشتريات (مدخلات)" : "Input VAT", value: "0.00", color: "#2563EB", icon: "vatIn" as const },
              { label: ar ? "صافي الضريبة المستحقة" : "Net VAT Payable", value: "0.00", color: "#D97706", icon: "money" as const },
            ].map(item => (
              <div key={item.label} className="stat-card">
                <div className="stat-icon" style={{ background: item.color + "18", color: item.color }}><Icon name={item.icon} size={20} /></div>
                <div className="stat-content">
                  <div className="stat-label">{item.label}</div>
                  <div className="stat-value">{item.value} {ar ? "ر.س" : "SAR"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
