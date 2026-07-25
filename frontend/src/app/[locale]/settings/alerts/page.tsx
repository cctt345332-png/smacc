"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getAlertSettings, updateAlertSettings, runAllAlerts } from "@/lib/notifications";

const IcBell    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcSave    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IcPlay    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const IcCheck   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{ width: 44, height: 24, borderRadius: 12, background: checked ? "var(--primary)" : "#CBD5E1", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header" style={{ background: color + "10", borderBottom: `1px solid ${color}20` }}>
        <span className="card-title" style={{ color }}>{title}</span>
      </div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

function AlertRow({ label, desc, enabled, onToggle, children }: {
  label: string; desc?: string; enabled: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
          {desc && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{desc}</div>}
        </div>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      {enabled && children && (
        <div style={{ marginTop: 10, paddingInlineStart: 0 }}>{children}</div>
      )}
    </div>
  );
}

export default function AlertSettingsPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [running, setRunning]   = useState(false);
  const [runResult, setRunResult] = useState<any>(null);

  useEffect(() => {
    getAlertSettings().then(({ data }) => { setSettings(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const upd = (k: string, v: any) => setSettings((s: any) => ({ ...s, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAlertSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    finally { setSaving(false); }
  };

  const handleRunNow = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const { data } = await runAllAlerts();
      setRunResult(data);
    } catch {}
    finally { setRunning(false); }
  };

  if (loading || !settings) return <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/settings`}>{ar ? "الإعدادات" : "Settings"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "إعدادات التنبيهات" : "Alert Settings"}</span>
          </div>
          <h1 className="page-title">{ar ? "إعدادات التنبيهات" : "Alert Settings"}</h1>
          <p className="page-subtitle">{ar ? "تحكم في التنبيهات لكل أقسام النظام" : "Control alerts for all system modules"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleRunNow} disabled={running}>
            <IcPlay />{running ? (ar ? "جاري الفحص..." : "Checking...") : (ar ? "فحص الآن" : "Check Now")}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saved ? <IcCheck /> : <IcSave />}
            {saved ? (ar ? "تم الحفظ" : "Saved!") : saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
          </button>
        </div>
      </div>

      {runResult && (
        <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "#166534", display: "flex", alignItems: "center", gap: 8 }}>
          <IcCheck />
          {ar ? `تم الفحص — أُنشئ ${runResult.alerts_created} تنبيه جديد` : `Check complete — ${runResult.alerts_created} new alerts created`}
        </div>
      )}

      {/* الأصول الثابتة */}
      <Section title={ar ? "الأصول الثابتة" : "Fixed Assets"} color="#2563EB">
        <AlertRow label={ar ? "انتهاء الضمان" : "Warranty Expiry"} desc={ar ? "تنبيه قبل انتهاء ضمان الأصل" : "Alert before asset warranty expires"} enabled={settings.asset_warranty_alert} onToggle={v => upd("asset_warranty_alert", v)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "التنبيه قبل:" : "Alert before:"}</span>
            <input type="number" className="form-input" style={{ width: 80 }} value={settings.asset_warranty_days} onChange={e => upd("asset_warranty_days", parseInt(e.target.value))} min="1" max="365" />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "يوم" : "days"}</span>
          </div>
        </AlertRow>
        <AlertRow label={ar ? "الاستهلاك الكامل" : "Full Depreciation"} desc={ar ? "تنبيه عند اكتمال استهلاك الأصل" : "Alert when asset is fully depreciated"} enabled={settings.asset_full_depreciation_alert} onToggle={v => upd("asset_full_depreciation_alert", v)} />
        <AlertRow label={ar ? "الاستهلاك المتأخر" : "Overdue Depreciation"} desc={ar ? "تنبيه إذا لم يُحتسب الاستهلاك في الوقت المحدد" : "Alert if depreciation is not calculated on time"} enabled={settings.asset_depreciation_due_alert} onToggle={v => upd("asset_depreciation_due_alert", v)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "بعد:" : "After:"}</span>
            <input type="number" className="form-input" style={{ width: 80 }} value={settings.asset_depreciation_due_days} onChange={e => upd("asset_depreciation_due_days", parseInt(e.target.value))} min="1" />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "يوم من آخر استهلاك" : "days since last depreciation"}</span>
          </div>
        </AlertRow>
        <AlertRow label={ar ? "الاستهلاك المرتفع" : "High Depreciation"} desc={ar ? "تنبيه عند وصول الاستهلاك لنسبة معينة" : "Alert when depreciation reaches a threshold"} enabled={settings.asset_high_depreciation_alert} onToggle={v => upd("asset_high_depreciation_alert", v)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "عند وصول الاستهلاك لـ:" : "When depreciation reaches:"}</span>
            <input type="number" className="form-input" style={{ width: 80 }} value={settings.asset_high_depreciation_threshold} onChange={e => upd("asset_high_depreciation_threshold", parseInt(e.target.value))} min="1" max="100" />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>%</span>
          </div>
        </AlertRow>
      </Section>

      {/* المخزون */}
      <Section title={ar ? "المخزون" : "Inventory"} color="#D97706">
        <AlertRow label={ar ? "مخزون منخفض" : "Low Stock"} desc={ar ? "تنبيه عند وصول الصنف لنقطة إعادة الطلب" : "Alert when item reaches reorder point"} enabled={settings.inventory_low_stock_alert} onToggle={v => upd("inventory_low_stock_alert", v)} />
        <AlertRow label={ar ? "انتهاء الصلاحية" : "Expiry Alert"} desc={ar ? "تنبيه قبل انتهاء صلاحية التشغيلات (للصيدلية)" : "Alert before batch expiry (pharmacy)"} enabled={settings.inventory_expiry_alert} onToggle={v => upd("inventory_expiry_alert", v)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "التنبيه قبل:" : "Alert before:"}</span>
            <input type="number" className="form-input" style={{ width: 80 }} value={settings.inventory_expiry_days} onChange={e => upd("inventory_expiry_days", parseInt(e.target.value))} min="1" />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "يوم" : "days"}</span>
          </div>
        </AlertRow>
      </Section>

      {/* المبيعات */}
      <Section title={ar ? "المبيعات" : "Sales"} color="#059669">
        <AlertRow label={ar ? "فواتير متأخرة" : "Overdue Invoices"} desc={ar ? "تنبيه عند تأخر دفع الفواتير" : "Alert when invoices are overdue"} enabled={settings.sales_overdue_alert} onToggle={v => upd("sales_overdue_alert", v)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "بعد:" : "After:"}</span>
            <input type="number" className="form-input" style={{ width: 80 }} value={settings.sales_overdue_days} onChange={e => upd("sales_overdue_days", parseInt(e.target.value))} min="1" />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "يوم من تاريخ الاستحقاق" : "days past due date"}</span>
          </div>
        </AlertRow>
        <AlertRow label={ar ? "تجاوز حد الائتمان" : "Credit Limit Exceeded"} desc={ar ? "تنبيه عند تجاوز العميل لحد الائتمان" : "Alert when customer exceeds credit limit"} enabled={settings.sales_credit_limit_alert} onToggle={v => upd("sales_credit_limit_alert", v)} />
      </Section>

      {/* المشتريات */}
      <Section title={ar ? "المشتريات" : "Purchases"} color="#7C3AED">
        <AlertRow label={ar ? "فواتير موردين متأخرة" : "Overdue Bills"} desc={ar ? "تنبيه عند تأخر دفع فواتير الموردين" : "Alert when supplier bills are overdue"} enabled={settings.purchases_overdue_alert} onToggle={v => upd("purchases_overdue_alert", v)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "بعد:" : "After:"}</span>
            <input type="number" className="form-input" style={{ width: 80 }} value={settings.purchases_overdue_days} onChange={e => upd("purchases_overdue_days", parseInt(e.target.value))} min="1" />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "يوم" : "days"}</span>
          </div>
        </AlertRow>
      </Section>

      {/* الموارد البشرية */}
      <Section title={ar ? "الموارد البشرية" : "Human Resources"} color="#EC4899">
        <AlertRow label={ar ? "طلبات الإجازة المعلقة" : "Pending Leave Requests"} desc={ar ? "تنبيه عند وجود طلبات إجازة تحتاج موافقة" : "Alert when leave requests need approval"} enabled={settings.hr_leave_request_alert} onToggle={v => upd("hr_leave_request_alert", v)} />
        <AlertRow label={ar ? "انتهاء عقود الموظفين" : "Contract Expiry"} desc={ar ? "تنبيه قبل انتهاء عقد الموظف" : "Alert before employee contract expires"} enabled={settings.hr_contract_expiry_alert} onToggle={v => upd("hr_contract_expiry_alert", v)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "التنبيه قبل:" : "Alert before:"}</span>
            <input type="number" className="form-input" style={{ width: 80 }} value={settings.hr_contract_expiry_days} onChange={e => upd("hr_contract_expiry_days", parseInt(e.target.value))} min="1" />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "يوم" : "days"}</span>
          </div>
        </AlertRow>
      </Section>

      {/* المحاسبة */}
      <Section title={ar ? "المحاسبة والضريبة" : "Accounting & Tax"} color="#0891B2">
        <AlertRow label={ar ? "موعد الإقرار الضريبي" : "VAT Return Due"} desc={ar ? "تنبيه قبل موعد تقديم الإقرار الضريبي الفصلي" : "Alert before quarterly VAT return deadline"} enabled={settings.vat_due_alert} onToggle={v => upd("vat_due_alert", v)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "التنبيه قبل:" : "Alert before:"}</span>
            <input type="number" className="form-input" style={{ width: 80 }} value={settings.vat_due_days} onChange={e => upd("vat_due_days", parseInt(e.target.value))} min="1" />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "يوم من الموعد" : "days before deadline"}</span>
          </div>
        </AlertRow>
      </Section>
    </div>
  );
}
