"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getVATSettings, saveVATSettings, getZATCAStatus, prepareZATCA, requestComplianceCSID, requestProductionCSID } from "@/lib/accounting";

export default function TaxSettingsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [zatcaStatus, setZatcaStatus] = useState<any>(null);
  const [zatcaBusy, setZatcaBusy] = useState(false);
  const [zatcaMessage, setZatcaMessage] = useState("");
  const [otp, setOtp] = useState("");
  const [phase2Setup, setPhase2Setup] = useState(false);
  const [form, setForm] = useState({
    vat_number: "", cr_number: "", vat_rate: "15", zatca_branch_name: "الفرع الرئيسي",
    zatca_activity: "", zatca_invoice_type_map: "both", vat_account_id: "", zatca_env: "sandbox", is_zatca_enabled: true,
  });

  useEffect(() => {
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
        is_zatca_enabled: true,
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

  const requestProduction = async () => {
    if (!confirm(ar ? "هل أكملت اختبارات الامتثال في بيئة المحاكاة؟ سيتم طلب شهادة الإنتاج." : "Have compliance tests passed in the sandbox? This will request the production certificate.")) return;
    setZatcaBusy(true); setZatcaMessage("");
    try {
      await requestProductionCSID();
      setZatcaMessage(ar ? "تم إصدار Production CSID وحفظه مشفرًا." : "Production CSID issued and encrypted.");
      setZatcaStatus((await getZATCAStatus()).data);
    } catch (e: any) { setZatcaMessage(e?.response?.data?.detail || (ar ? "تعذر إصدار شهادة الإنتاج" : "Unable to issue production certificate")); }
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
        <span />
      </div>

      {saved && (
        <div style={{ background: "#F0E7F4", border: "1px solid #C8AED4", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#3E0865", fontSize: 13, fontWeight: 600 }}>
          {ar ? "تم حفظ الإعدادات بنجاح" : "Settings saved successfully"}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">{ar ? "ربط زاتكا" : "ZATCA Integration"}</span>
            <span className={`badge ${form.is_zatca_enabled ? "badge-success" : "badge-gray"}`}>
              {form.is_zatca_enabled ? (ar ? "مفعّل" : "Enabled") : (ar ? "غير مفعّل" : "Disabled")}
            </span>
          </div>
          <div className="card-body">
            <div className="form-group" style={{ marginBottom: 18 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                <input type="checkbox" checked={form.is_zatca_enabled}
                  onChange={e => setForm(f => ({ ...f, is_zatca_enabled: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: "#5546D9" }} />
                {ar ? "تفعيل الفاتورة الإلكترونية السعودية (هيئة الزكاة والضريبة والجمارك)." : "Enable Saudi e-invoicing (ZATCA)."}
              </label>
            </div>
            <div style={{ display: "grid", gap: 12, fontSize: 13 }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="radio" name="zatca-phase" checked={!phase2Setup} onChange={() => setPhase2Setup(false)} />
                <span><strong>{ar ? "المرحلة الأولى" : "Phase 1"}</strong> <span style={{ color: "#64748B" }}>({ar ? "مرحلة الإصدار والحفظ" : "Issue and save"})</span></span>
              </label>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="radio" name="zatca-phase" checked={phase2Setup} onChange={() => setPhase2Setup(true)} />
                <span><strong>{ar ? "المرحلة الثانية" : "Phase 2"}</strong> <span style={{ color: "#64748B" }}>({ar ? "مرحلة الربط والتكامل" : "Integration"})</span></span>
              </label>
            </div>
            {!zatcaStatus?.has_csr && phase2Setup && (
              <button className="btn btn-primary" type="button" style={{ marginTop: 14, background: "#5546D9" }} onClick={() => setPhase2Setup(true)}>
                {ar ? "ابدأ التهيئة" : "Start setup"}
              </button>
            )}
            {phase2Setup && <div style={{ marginTop: 16 }}>
              <div style={{ background: "#DBEAFE", borderRadius: 8, padding: "12px 14px", color: "#1D4ED8", fontSize: 12, marginBottom: 18 }}>
                <strong>{ar ? "فيديو توضيحي" : "Guidance video"}</strong>
                <div style={{ marginTop: 4, textDecoration: "underline" }}>{ar ? "مشاهدة شرح تهيئة المرحلة الثانية" : "Watch Phase 2 setup guide"}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 18 }}>
                {[
                  { value: "production", title: ar ? "منصة فاتورة" : "Fatoora platform", text: ar ? "التهيئة لإصدار الفواتير الإلكترونية وإرسالها بشكل فعلي إلى الهيئة." : "Issue and submit e-invoices to ZATCA." },
                  { value: "simulation", title: ar ? "منصة محاكاة فاتورة" : "Fatoora simulation", text: ar ? "التهيئة لتجربة الفواتير الإلكترونية وإرسالها بشكل تجريبي إلى منصة المحاكاة." : "Test e-invoices through the simulation platform." },
                ].map(option => <button key={option.value} type="button" onClick={() => setForm(f => ({ ...f, zatca_env: option.value }))} style={{ textAlign: ar ? "right" : "left", border: form.zatca_env === option.value ? "2px solid #5546D9" : "1px solid #CBD5E1", borderRadius: 10, background: "white", padding: 14, cursor: "pointer" }}>
                  <strong style={{ display: "block", color: form.zatca_env === option.value ? "#5546D9" : "#C26B2D", marginBottom: 6 }}>{option.title}</strong>
                  <span style={{ color: "#64748B", fontSize: 11, lineHeight: 1.7 }}>{option.text}</span>
                </button>)}
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الرقم الضريبي" : "VAT Number"} <span className="required">*</span></label>
                <input className="form-input" value={form.vat_number} onChange={e => setForm(f => ({ ...f, vat_number: e.target.value }))} placeholder="300XXXXXXXXX1003" maxLength={15} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "رقم السجل التجاري" : "CR Number"}</label>
                <input className="form-input" value={form.cr_number} onChange={e => setForm(f => ({ ...f, cr_number: e.target.value }))} placeholder="1010XXXXXX" />
              </div>
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
              <button className="btn btn-primary" type="button" style={{ background: "#5546D9" }} onClick={prepareZatca} disabled={zatcaBusy || !form.vat_number}>
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
              {zatcaStatus?.has_compliance_credentials && !zatcaStatus?.has_production_credentials && (
                <button className="btn btn-primary" type="button" onClick={requestProduction} disabled={zatcaBusy} style={{ marginTop: 12 }}>
                  {ar ? "طلب Production CSID بعد نجاح الاختبارات" : "Request Production CSID after tests"}
                </button>
              )}
              {zatcaStatus && <p className="form-hint">{ar ? "الحالة الحالية: " : "Current status: "}{zatcaStatus.status}</p>}
              {zatcaMessage && <p className="form-hint" style={{ color: zatcaMessage.includes("تعذر") || zatcaMessage.includes("رفض") ? "#B91C1C" : "#166534" }}>{zatcaMessage}</p>}
            </div>
            }
          </div>
          <div className="card-footer" style={{ display: "flex", justifyContent: "flex-start" }}>
            <button className="btn btn-success" type="button" onClick={handleSave} disabled={saving}>
              {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
            </button>
          </div>
        </div>
      </div>

    </>
  );
}
