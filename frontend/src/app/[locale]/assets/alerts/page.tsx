"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getAlertSettings, updateAlertSettings, runAssetAlerts, getNotifications, markRead, markAllRead } from "@/lib/notifications";
import { Icon } from "@/components/ui/Icons";

const SEVERITY_COLORS: Record<string, string> = {
  info: "badge-info", warning: "badge-warning", critical: "badge-danger",
};
const SEVERITY_AR: Record<string, string> = {
  info: "معلومة", warning: "تحذير", critical: "حرج",
};
const TYPE_AR: Record<string, string> = {
  asset_warranty_expiry: "انتهاء الضمان",
  asset_fully_depreciated: "استهلاك كامل",
  asset_depreciation_due: "استهلاك متأخر",
  asset_high_depreciation: "استهلاك مرتفع",
  general: "عام",
};

export default function AssetAlertsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [settings, setSettings] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"settings" | "history">("settings");

  const load = async () => {
    try {
      const [s, n] = await Promise.all([getAlertSettings(), getNotifications()]);
      setSettings(s.data);
      setNotifications(n.data.filter((n: any) => n.reference_type === "asset"));
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAlertSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const { data } = await runAssetAlerts();
      setRunResult(data);
      load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setRunning(false); }
  };

  const handleMarkRead = async (id: string) => {
    await markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAll = async () => {
    await markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const upd = (k: string, v: any) => setSettings((s: any) => ({ ...s, [k]: v }));

  if (!settings) return <div className="empty-state"><div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border)", margin: "0 auto 12px" }} /></div>;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/assets`}>{ar ? "الأصول الثابتة" : "Fixed Assets"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "إعدادات التنبيهات" : "Alert Settings"}</span>
          </div>
          <h1 className="page-title">{ar ? "إعدادات التنبيهات" : "Alert Settings"}</h1>
          <p className="page-subtitle">{ar ? "تخصيص تنبيهات الأصول الثابتة" : "Customize fixed asset alerts"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleRun} disabled={running}>
            {running ? (ar ? "جاري الفحص..." : "Checking...") : (ar ? "فحص الآن" : "Check Now")}
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ الإعدادات" : "Save Settings")}
          </button>
        </div>
      </div>

      {saved && (
        <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#166534", fontSize: 13, fontWeight: 600 }}>
          {ar ? "تم حفظ الإعدادات بنجاح" : "Settings saved successfully"}
        </div>
      )}

      {runResult && (
        <div style={{ background: "#DBEAFE", border: "1px solid #93C5FD", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#1E40AF", fontSize: 13 }}>
          {ar
            ? `تم فحص ${runResult.checked} أصل — تم إنشاء ${runResult.alerts_created} تنبيه جديد`
            : `Checked ${runResult.checked} assets — Created ${runResult.alerts_created} new alerts`}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid var(--border)" }}>
        {[
          { key: "settings", ar: "إعدادات التنبيهات", en: "Alert Settings" },
          { key: "history", ar: `سجل التنبيهات ${unreadCount > 0 ? `(${unreadCount})` : ""}`, en: `Alert History ${unreadCount > 0 ? `(${unreadCount})` : ""}` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: "10px 20px", border: "none", background: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              color: activeTab === tab.key ? "var(--primary)" : "var(--text-secondary)",
              borderBottom: activeTab === tab.key ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: -1,
            }}>
            {ar ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      {activeTab === "settings" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* تنبيه انتهاء الضمان */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "تنبيه انتهاء الضمان" : "Warranty Expiry Alert"}</span>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={settings.warranty_alert_enabled}
                  onChange={e => upd("warranty_alert_enabled", e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: settings.warranty_alert_enabled ? "#059669" : "var(--text-muted)" }}>
                  {settings.warranty_alert_enabled ? (ar ? "مفعّل" : "Enabled") : (ar ? "معطّل" : "Disabled")}
                </span>
              </label>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                {ar ? "يُنبّهك قبل انتهاء ضمان الأصل بعدد الأيام المحددة" : "Alerts you before asset warranty expires"}
              </p>
              <div className="form-group">
                <label className="form-label">{ar ? "التنبيه قبل (يوم)" : "Alert before (days)"}</label>
                <input type="number" className="form-input" style={{ width: 120 }}
                  value={settings.warranty_alert_days}
                  onChange={e => upd("warranty_alert_days", parseInt(e.target.value))}
                  min="1" max="365" disabled={!settings.warranty_alert_enabled} />
              </div>
            </div>
          </div>

          {/* تنبيه الاستهلاك الكامل */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "تنبيه الاستهلاك الكامل" : "Full Depreciation Alert"}</span>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={settings.full_depreciation_alert}
                  onChange={e => upd("full_depreciation_alert", e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: settings.full_depreciation_alert ? "#059669" : "var(--text-muted)" }}>
                  {settings.full_depreciation_alert ? (ar ? "مفعّل" : "Enabled") : (ar ? "معطّل" : "Disabled")}
                </span>
              </label>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {ar ? "يُنبّهك عندما يُستهلك الأصل بالكامل ويصل لقيمته التخريدية" : "Alerts when an asset is fully depreciated to its salvage value"}
              </p>
            </div>
          </div>

          {/* تنبيه الاستهلاك المتأخر */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "تنبيه الاستهلاك المتأخر" : "Overdue Depreciation Alert"}</span>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={settings.depreciation_due_alert}
                  onChange={e => upd("depreciation_due_alert", e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: settings.depreciation_due_alert ? "#059669" : "var(--text-muted)" }}>
                  {settings.depreciation_due_alert ? (ar ? "مفعّل" : "Enabled") : (ar ? "معطّل" : "Disabled")}
                </span>
              </label>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                {ar ? "يُنبّهك إذا لم يُحتسب استهلاك الأصل منذ فترة طويلة" : "Alerts if asset depreciation hasn't been run for a while"}
              </p>
              <div className="form-group">
                <label className="form-label">{ar ? "التنبيه بعد (يوم)" : "Alert after (days)"}</label>
                <input type="number" className="form-input" style={{ width: 120 }}
                  value={settings.depreciation_due_days}
                  onChange={e => upd("depreciation_due_days", parseInt(e.target.value))}
                  min="1" max="365" disabled={!settings.depreciation_due_alert} />
              </div>
            </div>
          </div>

          {/* تنبيه الاستهلاك المرتفع */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "تنبيه الاستهلاك المرتفع" : "High Depreciation Alert"}</span>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={settings.high_depreciation_alert}
                  onChange={e => upd("high_depreciation_alert", e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: settings.high_depreciation_alert ? "#059669" : "var(--text-muted)" }}>
                  {settings.high_depreciation_alert ? (ar ? "مفعّل" : "Enabled") : (ar ? "معطّل" : "Disabled")}
                </span>
              </label>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                {ar ? "يُنبّهك عندما يتجاوز الاستهلاك نسبة معينة من قيمة الأصل" : "Alerts when depreciation exceeds a threshold percentage"}
              </p>
              <div className="form-group">
                <label className="form-label">{ar ? "نسبة التنبيه %" : "Alert threshold %"}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="number" className="form-input" style={{ width: 100 }}
                    value={settings.high_depreciation_threshold}
                    onChange={e => upd("high_depreciation_threshold", parseInt(e.target.value))}
                    min="50" max="100" disabled={!settings.high_depreciation_alert} />
                  <span style={{ fontWeight: 700, color: "var(--primary)" }}>%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {ar ? "سجل التنبيهات" : "Alert History"}
              {unreadCount > 0 && <span className="badge badge-danger" style={{ marginInlineStart: 8 }}>{unreadCount}</span>}
            </span>
            {unreadCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={handleMarkAll}>
                {ar ? "تحديد الكل كمقروء" : "Mark all as read"}
              </button>
            )}
          </div>
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            {notifications.length === 0 ? (
              <div className="empty-state">
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}>
                  <Icon name="info" size={24} />
                </div>
                <div className="empty-state-title">{ar ? "لا توجد تنبيهات" : "No alerts"}</div>
                <div className="empty-state-desc">{ar ? "اضغط «فحص الآن» لفحص الأصول" : "Click «Check Now» to scan assets"}</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{ar ? "النوع" : "Type"}</th>
                    <th>{ar ? "العنوان" : "Title"}</th>
                    <th>{ar ? "الرسالة" : "Message"}</th>
                    <th>{ar ? "الأهمية" : "Severity"}</th>
                    <th>{ar ? "التاريخ" : "Date"}</th>
                    <th>{ar ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map(n => (
                    <tr key={n.id} style={{ background: n.is_read ? "transparent" : "#FAFBFF" }}>
                      <td style={{ fontSize: 12 }}>{TYPE_AR[n.type] || n.type}</td>
                      <td style={{ fontWeight: n.is_read ? 400 : 600 }}>{ar ? n.title_ar : n.title_en}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 280 }}>{ar ? n.message_ar : n.message_en}</td>
                      <td><span className={`badge ${SEVERITY_COLORS[n.severity]}`}>{ar ? SEVERITY_AR[n.severity] : n.severity}</span></td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(n.created_at).toLocaleDateString("en-SA")}</td>
                      <td>
                        {!n.is_read ? (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleMarkRead(n.id)} style={{ fontSize: 11 }}>
                            {ar ? "تحديد كمقروء" : "Mark read"}
                          </button>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{ar ? "مقروء" : "Read"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
