"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getVATSettings, saveVATSettings, getAccounts, getZATCAStatus, prepareZATCA, requestComplianceCSID } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";

export default function TaxSettingsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [zatcaStatus, setZatcaStatus] = useState<any>(null);
  const [zatcaBusy, setZatcaBusy] = useState(false);
  const [zatcaMessage, setZatcaMessage] = useState("");
  const [otp, setOtp] = useState("");
  const [form, setForm] = useState({
    vat_number: "", cr_number: "", vat_rate: "15", zatca_branch_name: "الفرع الرئيسي",
    zatca_activity: "", zatca_invoice_type_map: "both", vat_account_id: "", zatca_env: "sandbox", is_zatca_enabled: false,
  });

  useEffect(() => {
    getAccounts().then(({ data }) => setAccounts(data));
    getVATSettings().then(({ data }) => {
      setForm({
        vat_number: data.vat_number || "",
        cr_number: data.cr_number || "",
        vat_rate: String(data.vat_rate),
        zatca_branch_name: data.zatca_branch_name || "الفرع الرئيسي",
        zatca_activity: data.zatca_activity || "",
        zatca_invoice_type_map: data.zatca_invoice_type_map || "both",
        vat_account_id: data.vat_account_id || "",
        zatca_env: data.zatca_env || "sandbox",
        is_zatca_enabled: data.is_zatca_enabled,
      });
    }).catch(() => {});
    getZATCAStatus().then(({ data }) => setZatcaStatus(data)).catch(() => {});
  }, []);

  const prepareZatca = async () => {
    setZatcaBusy(true); setZatcaMessage("");
    try {
      const { data } = await prepareZATCA({
        vat_number: form.vat_number,
        branch_name: form.zatca_branch_name,
        activity: form.zatca_activity,
        environment: form.zatca_env,
        invoice_type_map: form.zatca_invoice_type_map,
      });
      setZatcaMessage(ar ? "تم تجهيز CSR بنجاح. انسخه إلى بوابة فاتورة عند طلبه، والمفتاح الخاص محفوظ داخل السيرفر." : "CSR prepared. The private key is kept on the server.");
      setZatcaStatus((await getZATCAStatus()).data);
      void data;
    } catch (e: any) { setZatcaMessage(e?.response?.data?.detail || (ar ? "تعذر تجهيز الربط" : "Unable to prepare integration")); }
    finally { setZatcaBusy(false); }
  };

  const requestCsid = async () => {
    setZatcaBusy(true); setZatcaMessage("");
    try {
      await requestComplianceCSID(otp);
      setOtp("");
      setZatcaMessage(ar ? "تم إصدار Compliance CSID بنجاح." : "Compliance CSID issued successfully.");
      setZatcaStatus((await getZATCAStatus()).data);
    } catch (e: any) { setZatcaMessage(e?.response?.data?.detail || (ar ? "رفضت زاتكا طلب Compliance CSID" : "ZATCA rejected the Compliance CSID request")); }
    finally { setZatcaBusy(false); }
  };

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
        <div style={{ background: "#F0E7F4", border: "1px solid #C8AED4", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#3E0865", fontSize: 13, fontWeight: 600 }}>
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
            <div style={{ borderTop: "1px solid #E5E7EB", marginTop: 18, paddingTop: 18 }}>
              <div className="form-group">
                <label className="form-label">{ar ? "اسم الفرع في زاتكا" : "ZATCA branch name"}</label>
                <input className="form-input" value={form.zatca_branch_name} onChange={e => setForm(f => ({ ...f, zatca_branch_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "تصنيف النشاط" : "Business activity"}</label>
                <input className="form-input" value={form.zatca_activity} onChange={e => setForm(f => ({ ...f, zatca_activity: e.target.value }))} placeholder={ar ? "اسم المنشأة أو النشاط" : "Company or activity name"} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "نوع المستندات" : "Document type"}</label>
                <select className="form-input form-select" value={form.zatca_invoice_type_map} onChange={e => setForm(f => ({ ...f, zatca_invoice_type_map: e.target.value }))}>
                  <option value="both">{ar ? "قياسية ومبسطة" : "Standard and simplified"}</option>
                  <option value="standard">{ar ? "قياسية فقط" : "Standard only"}</option>
                  <option value="simplified">{ar ? "مبسطة فقط" : "Simplified only"}</option>
                </select>
              </div>
              <button className="btn btn-secondary" type="button" onClick={prepareZatca} disabled={zatcaBusy || !form.vat_number}>
                {zatcaBusy ? (ar ? "جاري التنفيذ..." : "Working...") : (ar ? "تجهيز CSR والربط" : "Prepare CSR")}
              </button>
              {zatcaStatus?.has_csr && !zatcaStatus?.has_compliance_credentials && (
                <div style={{ marginTop: 14 }}>
                  <label className="form-label">{ar ? "رمز OTP من بوابة فاتورة" : "Fatoora OTP"}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="form-input" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} inputMode="numeric" placeholder="0000" />
                    <button className="btn btn-primary" type="button" onClick={requestCsid} disabled={zatcaBusy || otp.length < 4}>{ar ? "طلب CSID" : "Request CSID"}</button>
                  </div>
                </div>
              )}
              {zatcaStatus && <p className="form-hint">{ar ? "الحالة الحالية: " : "Current status: "}{zatcaStatus.status}</p>}
              {zatcaMessage && <p className="form-hint" style={{ color: zatcaMessage.includes("تعذر") || zatcaMessage.includes("رفض") ? "#B91C1C" : "#166534" }}>{zatcaMessage}</p>}
            </div>
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
              { label: ar ? "ضريبة المبيعات (مخرجات)" : "Output VAT", value: "0.00", color: "#6F4A84", icon: "vatOut" as const },
              { label: ar ? "ضريبة المشتريات (مدخلات)" : "Input VAT", value: "0.00", color: "#5A187E", icon: "vatIn" as const },
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
