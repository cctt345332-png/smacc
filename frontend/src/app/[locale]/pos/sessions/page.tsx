"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSessions, openSession, getTerminals } from "@/lib/pos";
import { Icon } from "@/components/ui/Icons";

const ACTIVITY_CFG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  mobile_phones: { label: "جوالات",    icon: "mobile",       color: "#587795", bg: "#EFF6FF" },
  spare_parts:   { label: "قطع غيار",  icon: "spareParts",   color: "#5D7E9F", bg: "#F5F3FF" },
  pharmacy:      { label: "صيدلية",    icon: "pharmacy",     color: "#059669", bg: "#ECFDF5" },
  grocery:       { label: "بقالة",     icon: "grocery",      color: "#D97706", bg: "#FFFBEB" },
  spices:        { label: "عطارة",     icon: "spices",       color: "#B45309", bg: "#FEF3C7" },
  clothing:      { label: "ملابس",     icon: "clothing",     color: "#EC4899", bg: "#FDF2F8" },
  construction:  { label: "مواد بناء", icon: "construction", color: "#64748B", bg: "#F1F5F9" },
  general:       { label: "عام",       icon: "general",      color: "#0F172A", bg: "#F8FAFC" },
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function POSSessionsPage() {
  const params   = useParams();
  const router   = useRouter();
  const locale   = (params?.locale as string) || "ar";
  const isAr     = locale === "ar";
  const dir      = isAr ? "rtl" : "ltr";

  const [sessions,   setSessions]   = useState<any[]>([]);
  const [terminals,  setTerminals]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [form,       setForm]       = useState({ terminal_id: "", opening_cash: "0" });
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [filter,     setFilter]     = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const res = await getSessions({ limit: 100 });
      setSessions(res.data || []);
    } catch { setSessions([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    getTerminals().then((r) => setTerminals(r.data || [])).catch(() => {});
  }, []);

  const filtered = filter ? sessions.filter((s) => s.status === filter) : sessions;

  const handleOpen = async () => {
    if (!form.terminal_id) { setError(isAr ? "اختر الجهاز" : "Select a terminal"); return; }
    setSaving(true); setError("");
    try {
      await openSession({ terminal_id: form.terminal_id, opening_cash: parseFloat(form.opening_cash) || 0 });
      setShowModal(false);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || (isAr ? "حدث خطأ" : "Error"));
    } finally { setSaving(false); }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(isAr ? "ar-SA" : "en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const sar = isAr ? "ر.س" : "SAR";

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/pos`}>{isAr ? "نقطة البيع" : "POS"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{isAr ? "الجلسات" : "Sessions"}</span>
          </div>
          <h1 className="page-title">{isAr ? "جلسات الكاشير" : "POS Sessions"}</h1>
          <p className="page-subtitle">
            {isAr ? "إدارة جلسات الكاشير من فتح الصندوق حتى إغلاقه" : "Manage cashier sessions from open to close"}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setForm({ terminal_id: "", opening_cash: "0" }); setError(""); setShowModal(true); }}
        >
          <Icon name="session" size={16} />
          {isAr ? "فتح جلسة" : "Open Session"}
        </button>
      </div>

      {/* ── Filter tabs ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { val: "",       label: isAr ? "الكل" : "All" },
          { val: "open",   label: isAr ? "مفتوح" : "Open" },
          { val: "closed", label: isAr ? "مغلق" : "Closed" },
        ].map(({ val, label }) => (
          <button
            key={val}
            className={`btn btn-sm ${filter === val ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilter(val)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            {isAr ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: "#EFF6FF", display: "flex", alignItems: "center",
              justifyContent: "center", color: "#587795", margin: "0 auto 12px",
            }}>
              <Icon name="session" size={28} />
            </div>
            <div className="empty-state-title">{isAr ? "لا توجد جلسات" : "No sessions yet"}</div>
            <div className="empty-state-desc">{isAr ? "افتح جلستك الأولى" : "Open your first session"}</div>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>{isAr ? "الجهاز" : "Terminal"}</th>
                  <th>{isAr ? "النشاط" : "Activity"}</th>
                  <th>{isAr ? "وقت الفتح" : "Opened At"}</th>
                  <th>{isAr ? "إجمالي المبيعات" : "Total Sales"}</th>
                  <th>{isAr ? "المعاملات" : "Txns"}</th>
                  <th>{isAr ? "الحالة" : "Status"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const term = terminals.find((t) => t.id === s.terminal_id);
                  const cfg  = ACTIVITY_CFG[term?.business_type || "general"] || ACTIVITY_CFG.general;
                  return (
                    <tr
                      key={s.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => router.push(`/${locale}/pos/sessions/${s.id}`)}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.terminal?.name || term?.name || "—"}</div>
                        {(s.terminal?.branch_name || term?.branch_name) && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {s.terminal?.branch_name || term?.branch_name}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: cfg.color, background: cfg.bg,
                          padding: "2px 8px", borderRadius: 20,
                          display: "inline-flex", alignItems: "center", gap: 4,
                        }}>
                          <Icon name={cfg.icon} size={11} />
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmtDate(s.opened_at)}</td>
                      <td style={{ fontWeight: 600, color: "var(--success)" }}>
                        {fmt(Number(s.total_sales))} {sar}
                      </td>
                      <td>{s.transaction_count}</td>
                      <td>
                        <span className={`badge ${s.status === "open" ? "badge-success" : "badge-gray"}`}>
                          {s.status === "open" ? (isAr ? "مفتوح" : "Open") : (isAr ? "مغلق" : "Closed")}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => router.push(`/${locale}/pos/sessions/${s.id}`)}
                        >
                          <Icon name="view" size={13} />
                          {isAr ? "التقرير" : "Report"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Open Session Modal ──────────────────────────────────────── */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: 16,
        }}>
          <div className="card animate-slide" style={{ width: "100%", maxWidth: 420 }}>
            <div className="card-header">
              <h3 className="card-title">
                <Icon name="session" size={16} />
                {isAr ? "فتح جلسة كاشير" : "Open Cashier Session"}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="card-body">
              {error && (
                <div style={{
                  background: "#FEE2E2", color: "#991B1B",
                  padding: "10px 14px", borderRadius: 8,
                  marginBottom: 16, fontSize: 13,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Icon name="warning" size={14} />
                  {error}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">
                  {isAr ? "الجهاز" : "Terminal"} <span className="required">*</span>
                </label>
                <select
                  className="form-input form-select"
                  value={form.terminal_id}
                  onChange={(e) => setForm({ ...form, terminal_id: e.target.value })}
                >
                  <option value="">{isAr ? "-- اختر الجهاز --" : "-- Select Terminal --"}</option>
                  {terminals.map((t) => {
                    const cfg = ACTIVITY_CFG[t.business_type] || ACTIVITY_CFG.general;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.branch_name ? ` — ${t.branch_name}` : ""} ({cfg.label})
                      </option>
                    );
                  })}
                </select>
                {/* Preview selected terminal activity */}
                {form.terminal_id && (() => {
                  const t = terminals.find((x) => x.id === form.terminal_id);
                  const cfg = ACTIVITY_CFG[t?.business_type || "general"] || ACTIVITY_CFG.general;
                  return (
                    <div style={{
                      marginTop: 8, padding: "6px 10px", borderRadius: 8,
                      background: cfg.bg, display: "inline-flex",
                      alignItems: "center", gap: 6, fontSize: 12,
                      fontWeight: 600, color: cfg.color,
                    }}>
                      <Icon name={cfg.icon} size={13} />
                      {cfg.label}
                    </div>
                  );
                })()}
              </div>
              <div className="form-group">
                <label className="form-label">
                  {isAr ? "رصيد الافتتاح (ريال)" : "Opening Cash (SAR)"}
                </label>
                <input
                  type="number" className="form-input"
                  min={0} step={0.01}
                  value={form.opening_cash}
                  onChange={(e) => setForm({ ...form, opening_cash: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button className="btn btn-primary" onClick={handleOpen} disabled={saving}>
                  {saving ? (isAr ? "جاري الفتح..." : "Opening...") : (isAr ? "فتح الجلسة" : "Open Session")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
