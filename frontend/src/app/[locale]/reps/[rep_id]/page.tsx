"use client";
import { getMapboxTileUrl } from "@/lib/mapConfig";
import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { getRep, getRepSummary, getRepStock, getRepInvoices, getRepTransfers, getRepLocationHistory, updateRep, importRepCustomersFromTree } from "@/lib/reps";
import api from "@/lib/api";

const fmt  = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtD = (d: any) => d ? new Date(d).toLocaleDateString("en-US") : "—";

const STATUS: Record<string, { ar: string; color: string; bg: string }> = {
  draft:     { ar: "مسودة",            color: "#6B7280", bg: "#F3F4F6" },
  submitted: { ar: "بانتظار المراجعة", color: "#D97706", bg: "#FFFBEB" },
  approved:  { ar: "موافق عليها",      color: "#5A187E", bg: "#EFF6FF" },
  rejected:  { ar: "مرفوضة",           color: "#DC2626", bg: "#FEF2F2" },
  confirmed: { ar: "مؤكدة",            color: "#6F4A84", bg: "#F7F2F8" },
  paid:      { ar: "مدفوعة",           color: "#6F4A84", bg: "#F7F2F8" },
  partial:   { ar: "جزئي",             color: "#D97706", bg: "#FFFBEB" },
  unpaid:    { ar: "غير مدفوعة",       color: "#DC2626", bg: "#FEF2F2" },
  cancelled: { ar: "ملغاة",            color: "#6B7280", bg: "#F3F4F6" },
};

const PAY_METHOD: Record<string, string> = {
  cash: "نقد", credit: "آجل", cheque: "شيك", transfer: "تحويل",
};

/* ══════════════════════════════════════════════════════════════════
   الصفحة الرئيسية: تفاصيل المندوب
   ══════════════════════════════════════════════════════════════════ */
export default function RepDetailPage(props: { params: Promise<{ locale: string; rep_id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    rep_id
  } = params;

  const ar = locale === "ar";

  // ── State ────────────────────────────────────────────────────────
  const [rep, setRep]           = useState<any>(null);
  const [summary, setSummary]   = useState<any>(null);
  const [stock, setStock]       = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [tab, setTab]           = useState<"info"|"invoices"|"review"|"stock"|"transfers"|"tracking">("info");
  const [loading, setLoading]   = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal]     = useState<any>(null);
  const [rejectNote, setRejectNote]       = useState("");
  const [msg, setMsg]           = useState<{ type: "ok"|"err"; text: string } | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // ── تتبع الموقع (props للـ TrackingTab) ─────────────────────────
  const mapRef      = useRef<HTMLDivElement>(null);
  const trackingMap = useRef<any>(null);
  const mapInitToken = useRef(0);
  const [trackDate,    setTrackDate]    = useState(() => new Date().toISOString().split("T")[0]);
  const [trackPoints,  setTrackPoints]  = useState<any[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);

  // ── جلب البيانات ─────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const [repRes, sumRes, stockRes, invRes, trRes] = await Promise.all([
        getRep(rep_id), getRepSummary(rep_id), getRepStock(rep_id),
        getRepInvoices(rep_id), getRepTransfers(rep_id),
      ]);
      setRep(repRes.data);
      setSummary(sumRes.data);
      setStock(Array.isArray(stockRes.data) ? stockRes.data : []);
      setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
      setTransfers(Array.isArray(trRes.data) ? trRes.data : []);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [rep_id]);

  // ── إجراءات الفواتير ──────────────────────────────────────────────
  const doApprove = async (invId: string) => {
    setActionLoading(invId);
    try {
      await api.post(`/sales/invoices/${invId}/approve`);
      setMsg({ type: "ok", text: "تمت الموافقة على الفاتورة" });
      load();
    } catch (e: any) { setMsg({ type: "err", text: e.response?.data?.detail || "خطأ" }); }
    finally { setActionLoading(null); }
  };

  const doReject = async () => {
    if (!rejectModal || !rejectNote.trim()) return;
    setActionLoading(rejectModal.id);
    try {
      await api.post(`/sales/invoices/${rejectModal.id}/reject`, { rejection_note: rejectNote });
      setMsg({ type: "ok", text: "تم رفض الفاتورة" });
      setRejectModal(null);
      setRejectNote("");
      load();
    } catch (e: any) { setMsg({ type: "err", text: e.response?.data?.detail || "خطأ" }); }
    finally { setActionLoading(null); }
  };

  const doConfirm = async (invId: string) => {
    setActionLoading(invId);
    try {
      await api.post(`/sales/invoices/${invId}/confirm`);
      setMsg({ type: "ok", text: "تم تأكيد الفاتورة وخصم المخزون" });
      load();
    } catch (e: any) { setMsg({ type: "err", text: e.response?.data?.detail || "خطأ" }); }
    finally { setActionLoading(null); }
  };

  const doImportRepCustomers = async () => {
    if (!rep?.customer_account_id) {
      setMsg({ type: "err", text: ar ? "لا يوجد حساب محاسبي مرتبط بهذا المندوب" : "No accounting account is linked to this rep" });
      return;
    }
    const confirmed = window.confirm(ar
      ? "سيتم استيراد العملاء الموجودين تحت حساب هذا المندوب فقط. هل تريد المتابعة؟"
      : "Only customers under this rep's linked account will be imported. Continue?");
    if (!confirmed) return;

    setActionLoading("import-customers");
    try {
      const response = await importRepCustomersFromTree(rep_id);
      const result = response.data;
      setMsg({
        type: "ok",
        text: ar
          ? `تمت مزامنة العملاء: أضيف ${result.created || 0}، موجود مسبقاً ${result.skipped || 0}`
          : `Customer sync complete: ${result.created || 0} created, ${result.skipped || 0} already linked`,
      });
    } catch (e: any) {
      setMsg({ type: "err", text: e.response?.data?.detail || (ar ? "تعذر مزامنة العملاء" : "Customer sync failed") });
    } finally { setActionLoading(null); }
  };

  // ── Render guards ─────────────────────────────────────────────────
  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>;
  }
  if (!rep) {
    return <div style={{ padding: 40, textAlign: "center", color: "#DC2626" }}>{ar ? "المندوب غير موجود" : "Rep not found"}</div>;
  }

  const submittedInvoices = invoices.filter(i => i.status === "submitted");
  const pct = rep.target_monthly > 0
    ? Math.min(100, Math.round((Number(summary?.total_sales || 0) / Number(rep.target_monthly)) * 100))
    : null;

  const TABS = [
    { key: "info",      label: ar ? "الملف الشخصي" : "Profile" },
    { key: "invoices",  label: ar ? "الفواتير" : "Invoices",     count: invoices.length },
    { key: "review",    label: ar ? "للمراجعة" : "Review",       count: submittedInvoices.length, alert: submittedInvoices.length > 0 },
    { key: "stock",     label: ar ? "المخزون" : "Stock",         count: stock.length },
    { key: "transfers", label: ar ? "المناقلات" : "Transfers",   count: transfers.length },
    { key: "tracking",  label: ar ? "التتبع" : "Tracking" },
  ] as const;

  return (
    <>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reps/manage`}>{ar ? "المناديب" : "Sales Reps"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{rep.full_name}</span>
          </div>
          <h1 className="page-title">{rep.full_name}</h1>
          <p className="page-subtitle">
            {rep.rep_code}
            {rep.zone ? ` · ${rep.zone}` : ""}
            {rep.vehicle_plate ? ` · ${rep.vehicle_plate}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {submittedInvoices.length > 0 && (
            <span style={{ background: "#FEF3C7", color: "#D97706", border: "1px solid #FCD34D", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
              {submittedInvoices.length} {ar ? "فاتورة تنتظر المراجعة" : "pending review"}
            </span>
          )}
          <span className={`badge ${rep.is_active ? "badge-success" : "badge-danger"}`} style={{ fontSize: 13, padding: "6px 14px" }}>
            {rep.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
          </span>
        </div>
      </div>

      {/* ── رسائل ── */}
      {msg && (
        <div style={{ background: msg.type === "ok" ? "#F7F2F8" : "#FEF2F2", border: `1px solid ${msg.type === "ok" ? "#E9DDF0" : "#FECACA"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: msg.type === "ok" ? "#6F4A84" : "#DC2626", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 16 }}>x</button>
        </div>
      )}

      {/* ── بطاقات الإحصائيات ── */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: ar ? "إجمالي المبيعات" : "Total Sales", value: fmt(summary.total_sales) + " SAR", color: "#5A187E" },
            { label: ar ? "عدد الفواتير" : "Invoices",       value: summary.invoice_count,             color: "#75617F" },
            { label: ar ? "المحصّل" : "Collected",            value: fmt(summary.total_collected) + " SAR", color: "#6F4A84" },
            { label: ar ? "المستحق" : "Outstanding",          value: fmt(summary.outstanding) + " SAR",     color: Number(summary.outstanding) > 0 ? "#DC2626" : "#6F4A84" },
            { label: ar ? "المخزون" : "Stock Qty",            value: Number(summary.stock_qty || 0).toLocaleString("en-US"), color: "#D97706" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── شريط التبويبات ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ padding: "8px 16px", border: "none", borderBottom: tab === t.key ? "2px solid var(--primary)" : "2px solid transparent", background: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 700 : 400, color: tab === t.key ? "var(--primary)" : "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
            {t.label}
            {"count" in t && (t as any).count > 0 && (
              <span style={{ background: "alert" in t && (t as any).alert ? "#FEF3C7" : "var(--secondary)", color: "alert" in t && (t as any).alert ? "#D97706" : "var(--text-secondary)", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>
                {(t as any).count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══ تبويب: الملف الشخصي ══ */}
      {tab === "info" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>{ar ? "البيانات الأساسية" : "Basic Info"}</div>
            {[
              { label: ar ? "البريد الإلكتروني" : "Email",        value: rep.email },
              { label: ar ? "الجوال" : "Phone",                   value: rep.phone || "—" },
              { label: ar ? "المنطقة / المسار" : "Zone / Route",  value: rep.zone || "—" },
              { label: ar ? "المستودع" : "Warehouse",             value: rep.warehouse_name || "—" },
              { label: ar ? "تاريخ الإنشاء" : "Created",          value: fmtD(rep.created_at) },
            ].map(f => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{f.value}</span>
                <span style={{ color: "var(--text-secondary)" }}>{f.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>{ar ? "الهوية" : "Identity"}</div>
              {[
                { label: ar ? "رقم الهوية" : "ID Number",         value: rep.id_number || "—" },
                { label: ar ? "انتهاء الهوية" : "ID Expiry",      value: fmtD(rep.id_expiry) },
                { label: ar ? "انتهاء الرخصة" : "License Expiry", value: fmtD(rep.license_expiry) },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{f.value}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{f.label}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>{ar ? "السيارة" : "Vehicle"}</div>
              {[
                { label: ar ? "لوحة السيارة" : "Plate", value: rep.vehicle_plate || "—", mono: true },
                { label: ar ? "النوع" : "Type",          value: rep.vehicle_type  || "—" },
                { label: ar ? "اللون" : "Color",         value: rep.vehicle_color || "—" },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span style={{ fontWeight: 600, fontFamily: f.mono ? "monospace" : undefined }}>{f.value}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 20, gridColumn: "1 / -1" }}>
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>{ar ? "الأهداف والعمولة" : "Targets & Commission"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{ar ? "الهدف الشهري" : "Monthly Target"}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#5A187E" }}>{rep.target_monthly > 0 ? fmt(rep.target_monthly) + " SAR" : "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{ar ? "نسبة التحقق" : "Achievement"}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: pct !== null ? (pct >= 100 ? "#6F4A84" : pct >= 70 ? "#D97706" : "#5A187E") : "var(--text-muted)" }}>
                  {pct !== null ? `${pct}%` : "—"}
                </div>
                {pct !== null && (
                  <div style={{ marginTop: 6, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? "#6F4A84" : pct >= 70 ? "#D97706" : "#5A187E", borderRadius: 3, transition: "width 0.3s" }} />
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{ar ? "نسبة العمولة" : "Commission %"}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#75617F" }}>{rep.commission_pct > 0 ? `${rep.commission_pct}%` : "—"}</div>
                {rep.commission_pct > 0 && summary && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                    {ar ? "المستحق:" : "Due:"} {fmt(Number(summary.total_sales || 0) * Number(rep.commission_pct) / 100)} SAR
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20, gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>{ar ? "عملاء المندوب من الشجرة المحاسبية" : "Rep Customers from Accounting Tree"}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.7 }}>
                  {rep.customer_account_id
                    ? (ar ? "تتم المزامنة من الحساب المرتبط بهذا المندوب فقط، دون استيراد فروع المناديب الآخرين." : "Syncs only the customers under this rep's linked account, without importing other reps' branches.")
                    : (ar ? "لم يتم ربط حساب محاسبي بهذا المندوب." : "No accounting account is linked to this rep.")}
                </div>
                {rep.customer_account_id && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--primary)", fontFamily: "monospace" }}>
                    {rep.customer_account_id}
                  </div>
                )}
              </div>
              <button
                onClick={doImportRepCustomers}
                disabled={actionLoading === "import-customers" || !rep.customer_account_id}
                className="btn-primary"
                style={{ whiteSpace: "nowrap", opacity: !rep.customer_account_id ? 0.55 : 1 }}
              >
                {actionLoading === "import-customers"
                  ? (ar ? "جاري المزامنة..." : "Syncing...")
                  : (ar ? "مزامنة العملاء من الشجرة" : "Sync Customers from Tree")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ تبويب: للمراجعة ══ */}
      {tab === "review" && (
        <div>
          {submittedInvoices.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</div>
              <div className="empty-state-title">{ar ? "لا توجد فواتير بانتظار المراجعة" : "No invoices pending review"}</div>
            </div>
          ) : (
            <div className="card">
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "رقم الفاتورة" : "Invoice"}</th>
                      <th>{ar ? "العميل" : "Customer"}</th>
                      <th>{ar ? "طريقة الدفع" : "Payment"}</th>
                      <th>{ar ? "تاريخ التقديم" : "Submitted"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                      <th>{ar ? "الإجراء" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submittedInvoices.map((inv: any) => (
                      <tr key={inv.id}>
                        <td>
                          <Link href={`/${locale}/sales/invoices/${inv.id}`}
                            style={{ fontWeight: 600, color: "var(--primary)", fontFamily: "monospace", textDecoration: "underline" }}>
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td>{inv.buyer_name_ar}</td>
                        <td>
                          <span style={{ background: "#F3F4F6", padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>
                            {PAY_METHOD[inv.invoice_payment_method] || "—"}
                          </span>
                          {inv.invoice_payment_method === "credit" && inv.credit_days && (
                            <span style={{ fontSize: 11, color: "var(--text-muted)", marginInlineStart: 4 }}>{inv.credit_days} {ar ? "يوم" : "days"}</span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtD(inv.submitted_at)}</td>
                        <td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(inv.total)} SAR</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <Link href={`/${locale}/sales/invoices/${inv.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                              {ar ? "عرض" : "View"}
                            </Link>
                            <button className="btn btn-primary btn-sm" disabled={actionLoading === inv.id} onClick={() => doApprove(inv.id)}>
                              {actionLoading === inv.id ? "..." : (ar ? "موافقة" : "Approve")}
                            </button>
                            <button className="btn btn-secondary btn-sm" style={{ color: "#DC2626" }} disabled={actionLoading === inv.id}
                              onClick={() => { setRejectModal(inv); setRejectNote(""); }}>
                              {ar ? "رفض" : "Reject"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ تبويب: الفواتير ══ */}
      {tab === "invoices" && (
        <div className="card">
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            {invoices.length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد فواتير" : "No invoices"}</div></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{ar ? "رقم الفاتورة" : "Invoice"}</th>
                    <th>{ar ? "العميل" : "Customer"}</th>
                    <th>{ar ? "الحالة" : "Status"}</th>
                    <th>{ar ? "طريقة الدفع" : "Payment"}</th>
                    <th>{ar ? "التاريخ" : "Date"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "المتبقي" : "Remaining"}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => {
                    const st = STATUS[inv.status] || STATUS.draft;
                    const remaining = Number(inv.total || 0) - Number(inv.paid_amount || 0);
                    return (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 600, fontFamily: "monospace" }}>
                          <Link href={`/${locale}/sales/invoices/${inv.id}`} style={{ color: "var(--primary)", textDecoration: "underline" }}>
                            {inv.invoice_number}
                          </Link>
                        </td>
                        <td>{inv.buyer_name_ar}</td>
                        <td>
                          <span style={{ background: st.bg, color: st.color, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{st.ar}</span>
                          {inv.status === "rejected" && inv.rejection_note && (
                            <div style={{ fontSize: 11, color: "#DC2626", marginTop: 2 }}>{inv.rejection_note.substring(0, 40)}{inv.rejection_note.length > 40 ? "..." : ""}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 12 }}>{PAY_METHOD[inv.invoice_payment_method] || "—"}</td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtD(inv.issue_date)}</td>
                        <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(inv.total)} SAR</td>
                        <td style={{ textAlign: "end", color: remaining > 0 ? "#DC2626" : "#6F4A84", fontWeight: 600 }}>
                          {remaining > 0.01 ? fmt(remaining) : "0.00"} SAR
                        </td>
                        <td>
                          <Link href={`/${locale}/sales/invoices/${inv.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>
                            {ar ? "عرض الفاتورة" : "View Invoice"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══ تبويب: المخزون ══ */}
      {tab === "stock" && (
        <div className="card">
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            {stock.length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">{ar ? "لا يوجد مخزون" : "No stock"}</div></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{ar ? "الصنف" : "Item"}</th>
                    <th>SKU</th>
                    <th>{ar ? "النوع" : "Type"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "المتاح" : "Available"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "سعر البيع" : "Sale Price"}</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((s: any) => (
                    <tr key={s.stock_id || s.item_id} style={s.is_low_stock ? { background: "#FFFBEB" } : {}}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.item_name}</div>
                        {s.category_name && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.category_name}</div>}
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{s.item_sku || "—"}</td>
                      <td><span style={{ background: "#F3F4F6", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>{s.item_tracking}</span></td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>{s.quantity}</td>
                      <td style={{ textAlign: "end", fontWeight: 700, color: s.available_qty <= 0 ? "#DC2626" : s.is_low_stock ? "#D97706" : "#6F4A84" }}>
                        {s.available_qty}
                        {s.is_low_stock && <span style={{ fontSize: 10, marginInlineStart: 4, color: "#D97706" }}>منخفض</span>}
                      </td>
                      <td style={{ textAlign: "end" }}>{fmt(s.sale_price)} SAR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══ تبويب: المناقلات ══ */}
      {tab === "transfers" && (
        <div className="card">
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            {transfers.length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد مناقلات" : "No transfers"}</div></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{ar ? "التاريخ" : "Date"}</th>
                    <th>{ar ? "الاتجاه" : "Direction"}</th>
                    <th>{ar ? "المنتج" : "Product"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                    <th>{ar ? "المستودع" : "Warehouse"}</th>
                    <th>{ar ? "ملاحظات" : "Notes"}</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.date}</td>
                      <td>
                        <span style={{ background: t.direction === "in" ? "#F7F2F8" : "#FEF2F2", color: t.direction === "in" ? "#6F4A84" : "#DC2626", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          {t.direction === "in" ? (ar ? "وارد" : "In") : (ar ? "صادر" : "Out")}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{t.product_name}</td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>{t.quantity}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.direction === "in" ? t.from_warehouse : t.to_warehouse}</td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══ تبويب: التتبع ══ */}
      {tab === "tracking" && (
        <TrackingTab
          locale={locale}
          repId={rep_id}
          trackDate={trackDate}
          setTrackDate={setTrackDate}
          trackPoints={trackPoints}
          setTrackPoints={setTrackPoints}
          trackLoading={trackLoading}
          setTrackLoading={setTrackLoading}
          mapRef={mapRef}
          trackingMap={trackingMap}
          mapInitToken={mapInitToken}
        />
      )}

      {/* ══ Modal: رفض الفاتورة ══ */}
      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 460, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{ar ? "رفض الفاتورة" : "Reject Invoice"}</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              {ar ? "الفاتورة" : "Invoice"} <strong>{rejectModal.invoice_number}</strong> — {rejectModal.buyer_name_ar}
            </p>
            <div className="form-group">
              <label className="form-label">{ar ? "سبب الرفض" : "Rejection Reason"} <span className="required">*</span></label>
              <textarea className="form-input" rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                placeholder={ar ? "أدخل سبب الرفض بوضوح..." : "Enter rejection reason clearly..."} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setRejectModal(null)}>{ar ? "إلغاء" : "Cancel"}</button>
              <button onClick={doReject} disabled={!rejectNote.trim() || actionLoading === rejectModal.id}
                style={{ padding: "8px 16px", borderRadius: 8, background: "#DC2626", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}>
                {actionLoading === rejectModal.id ? "..." : (ar ? "تأكيد الرفض" : "Confirm Reject")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: تفاصيل الفاتورة ══ */}
      {selectedInvoice && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSelectedInvoice(null)}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 780, maxHeight: "92vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>

            {/* رأس الـ modal */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 17, fontFamily: "monospace" }}>{selectedInvoice.invoice_number}</span>
                {(() => {
                  const st = STATUS[selectedInvoice.status] || STATUS.draft;
                  return <span style={{ background: st.bg, color: st.color, padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{st.ar}</span>;
                })()}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href={`/${locale}/sales/invoices/${selectedInvoice.id}`} target="_blank" className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}>
                  🔗 {ar ? "صفحة كاملة" : "Full page"}
                </Link>
                <button className="btn btn-ghost btn-icon" onClick={() => setSelectedInvoice(null)}>✕</button>
              </div>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {/* معلومات */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20, background: "#F8FAFC", borderRadius: 10, padding: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 3 }}>{ar ? "العميل" : "Customer"}</div>
                  <div style={{ fontWeight: 700 }}>{selectedInvoice.buyer_name_ar || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 3 }}>{ar ? "التاريخ" : "Date"}</div>
                  <div style={{ fontWeight: 600 }}>{fmtD(selectedInvoice.issue_date)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 3 }}>{ar ? "طريقة الدفع" : "Payment"}</div>
                  <div style={{ fontWeight: 600 }}>{PAY_METHOD[selectedInvoice.invoice_payment_method] || "—"}{selectedInvoice.credit_days ? ` (${selectedInvoice.credit_days}d)` : ""}</div>
                </div>
                {selectedInvoice.status === "rejected" && selectedInvoice.rejection_note && (
                  <div style={{ gridColumn: "1/-1", background: "#FEF2F2", borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 700 }}>{ar ? "سبب الرفض:" : "Rejection:"}</div>
                    <div style={{ fontSize: 13, color: "#DC2626" }}>{selectedInvoice.rejection_note}</div>
                  </div>
                )}
                {selectedInvoice.notes && (
                  <div style={{ gridColumn: "1/-1" }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{ar ? "ملاحظات" : "Notes"}</div>
                    <div style={{ fontSize: 13 }}>{selectedInvoice.notes}</div>
                  </div>
                )}
              </div>

              {/* أسطر الفاتورة */}
              {(selectedInvoice.lines || []).length > 0 && (
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC" }}>
                        {["#", ar?"الوصف":"Desc", ar?"الكمية":"Qty", ar?"السعر":"Price", ar?"الضريبة":"VAT", ar?"الإجمالي":"Total"].map((h, i) => (
                          <th key={i} style={{ padding: "8px 12px", textAlign: i > 1 ? "end" : "start", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedInvoice.lines || []).map((line: any, i: number) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)" }}>{i + 1}</td>
                          <td style={{ padding: "8px 12px" }}>{line.description_ar}</td>
                          <td style={{ padding: "8px 12px", textAlign: "end" }}>{fmt(line.quantity)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "end" }}>{fmt(line.unit_price)} SAR</td>
                          <td style={{ padding: "8px 12px", textAlign: "end", color: "#D97706" }}>{fmt(line.vat_amount)} SAR</td>
                          <td style={{ padding: "8px 12px", textAlign: "end", fontWeight: 700 }}>{fmt(line.total)} SAR</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* الإجماليات */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ minWidth: 260, display: "flex", flexDirection: "column", gap: 6, background: "#F8FAFC", borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{ar ? "قبل الضريبة" : "Subtotal"}</span>
                    <span>{fmt(selectedInvoice.subtotal)} SAR</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#D97706" }}>
                    <span>{ar ? "الضريبة" : "VAT"}</span>
                    <span>{fmt(selectedInvoice.vat_amount)} SAR</span>
                  </div>
                  <div style={{ height: 1, background: "var(--border)" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 800 }}>
                    <span>{ar ? "الإجمالي" : "Total"}</span>
                    <span style={{ color: "var(--primary)" }}>{fmt(selectedInvoice.total)} SAR</span>
                  </div>
                  {Number(selectedInvoice.paid_amount) > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6F4A84" }}>
                        <span>{ar ? "المدفوع" : "Paid"}</span>
                        <span>{fmt(selectedInvoice.paid_amount)} SAR</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: (Number(selectedInvoice.total) - Number(selectedInvoice.paid_amount)) > 0.01 ? "#DC2626" : "#6F4A84" }}>
                        <span>{ar ? "المتبقي" : "Remaining"}</span>
                        <span>{fmt(Math.max(0, Number(selectedInvoice.total) - Number(selectedInvoice.paid_amount)))} SAR</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* أزرار الموافقة/الرفض */}
              {selectedInvoice.status === "submitted" && (
                <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center" }}>
                  <button className="btn btn-primary" disabled={actionLoading === selectedInvoice.id}
                    onClick={() => { doApprove(selectedInvoice.id); setSelectedInvoice(null); }}>
                    {actionLoading === selectedInvoice.id ? "..." : (ar ? "✅ موافقة" : "✅ Approve")}
                  </button>
                  <button className="btn btn-secondary" style={{ color: "#DC2626" }} disabled={actionLoading === selectedInvoice.id}
                    onClick={() => { setRejectModal(selectedInvoice); setRejectNote(""); setSelectedInvoice(null); }}>
                    {ar ? "❌ رفض" : "❌ Reject"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   مكوّن تبويب التتبع (منفصل لتجنب إعادة تهيئة الخريطة)
   ══════════════════════════════════════════════════════════════════ */
function TrackingTab({
  locale, repId, trackDate, setTrackDate,
  trackPoints, setTrackPoints, trackLoading, setTrackLoading,
  mapRef, trackingMap, mapInitToken,
}: {
  locale: string;
  repId: string;
  trackDate: string;
  setTrackDate: (d: string) => void;
  trackPoints: any[];
  setTrackPoints: (p: any[]) => void;
  trackLoading: boolean;
  setTrackLoading: (b: boolean) => void;
  mapRef: React.RefObject<HTMLDivElement>;
  trackingMap: React.MutableRefObject<any>;
  mapInitToken: React.MutableRefObject<number>;
}) {
  const ar = locale === "ar";

  /* Leaflet CSS */
  useEffect(() => {
    const id = "leaflet-css";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  /* تهيئة الخريطة: الحارس يمنع سباق الاستيراد أثناء Fast Refresh أو تبديل التبويبات. */
  useEffect(() => {
    const container = mapRef.current;
    if (!container || trackingMap.current) return;
    const token = ++mapInitToken.current;
    let disposed = false;

    const initialize = async () => {
      const L = await import("leaflet");
      if (disposed || token !== mapInitToken.current || trackingMap.current || !mapRef.current) return;

      // Leaflet يحتفظ بمعرف على العنصر حتى بعد تحديث التطوير؛ نزيله دفاعيًا قبل الإنشاء.
      const mapContainer = mapRef.current as HTMLDivElement & { _leaflet_id?: number };
      if (mapContainer._leaflet_id) delete mapContainer._leaflet_id;
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      const map = L.map(mapContainer, { center: [24.7136, 46.6753], zoom: 11 });
      L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ar", {
        attribution: "Google Maps", maxZoom: 19,
      }).addTo(map);
      trackingMap.current = { map, L };
      requestAnimationFrame(() => map.invalidateSize());
    };

    void initialize();
    return () => {
      disposed = true;
      mapInitToken.current += 1;
      const current = trackingMap.current;
      if (current?.map) {
        current.map.off();
        current.map.remove();
        trackingMap.current = null;
      }
      if (mapRef.current) delete (mapRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
    };
  }, [mapInitToken, mapRef, trackingMap]);

  /* رسم المسار */
  useEffect(() => {
    if (!trackingMap.current || trackPoints.length === 0) return;
    const { map, L } = trackingMap.current;

    map.eachLayer((l: any) => { if (l._isTrackLayer) map.removeLayer(l); });

    const coords: [number, number][] = trackPoints.map(p => [p.latitude, p.longitude]);
    const polyline = L.polyline(coords, { color: "#5A187E", weight: 3, opacity: 0.8 });
    polyline._isTrackLayer = true;
    polyline.addTo(map);

    if (coords.length > 0) {
      const start = L.circleMarker(coords[0], { radius: 8, color: "#6F4A84", fillColor: "#6F4A84", fillOpacity: 1, weight: 2 });
      start._isTrackLayer = true;
      start.bindTooltip(ar ? "نقطة البداية" : "Start", { permanent: false }).addTo(map);
    }

    if (coords.length > 1) {
      const end = L.circleMarker(coords[coords.length - 1], { radius: 8, color: "#DC2626", fillColor: "#DC2626", fillOpacity: 1, weight: 2 });
      end._isTrackLayer = true;
      end.bindTooltip(ar ? "آخر موقع" : "Last", { permanent: false }).addTo(map);
    }

    trackPoints.forEach((p, i) => {
      if (i === 0 || i === trackPoints.length - 1 || i % 5 !== 0) return;
      const time = new Date(p.recorded_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      const dot = L.circleMarker([p.latitude, p.longitude], { radius: 5, color: "#75617F", fillColor: "#75617F", fillOpacity: 0.7, weight: 1 });
      dot._isTrackLayer = true;
      dot.bindTooltip(time, { permanent: false }).addTo(map);
    });

    map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
  }, [trackPoints, ar]);

  /* جلب بيانات المسار */
  const fetchTrack = async (date: string) => {
    setTrackLoading(true);
    try {
      const res = await getRepLocationHistory(repId, date);
      setTrackPoints(Array.isArray(res.data) ? res.data : []);
    } catch { setTrackPoints([]); }
    finally { setTrackLoading(false); }
  };

  useEffect(() => { fetchTrack(trackDate); }, [repId]);

  return (
    <div>
      {/* شريط التحكم */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <input type="date" className="form-input" style={{ width: 160 }} value={trackDate}
          onChange={e => { setTrackDate(e.target.value); fetchTrack(e.target.value); }} />
        <button className="btn btn-secondary" onClick={() => fetchTrack(trackDate)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          {ar ? "تحديث" : "Refresh"}
        </button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {trackLoading ? (ar ? "جاري التحميل..." : "Loading...") : `${trackPoints.length} ${ar ? "نقطة" : "points"}`}
        </span>
      </div>

      {/* الخريطة */}
      <div style={{ height: "clamp(280px, 46vh, 380px)", minHeight: 280, borderRadius: 2, overflow: "hidden", border: "1px solid var(--border)", position: "relative", background: "#FAF8FB" }}>
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
        {trackPoints.length === 0 && !trackLoading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.85)", flexDirection: "column", gap: 8 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>{ar ? "لا توجد بيانات لهذا اليوم" : "No data for this day"}</div>
          </div>
        )}
      </div>

      {/* جدول النقاط */}
      {trackPoints.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ padding: "14px 16px", fontWeight: 700, fontSize: 13, borderBottom: "1px solid var(--border)" }}>
            {ar ? "سجل النقاط" : "Points Log"}
          </div>
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0, maxHeight: 300, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الوقت" : "Time"}</th>
                  <th>{ar ? "الإحداثيات" : "Coordinates"}</th>
                  <th>{ar ? "السرعة" : "Speed"}</th>
                  <th>{ar ? "البطارية" : "Battery"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {trackPoints.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12, fontFamily: "monospace" }}>{new Date(p.recorded_at).toLocaleTimeString("en-US")}</td>
                    <td style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)" }}>
                      {Number(p.latitude).toFixed(5)}, {Number(p.longitude).toFixed(5)}
                    </td>
                    <td style={{ fontSize: 12 }}>{p.speed != null ? `${p.speed} km/h` : "—"}</td>
                    <td style={{ fontSize: 12 }}>{p.battery_level != null ? `${p.battery_level}%` : "—"}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: p.is_moving ? "#E9DDED" : "#F3F4F6", color: p.is_moving ? "#6F4A84" : "#6B7280" }}>
                        {p.is_moving ? (ar ? "متحرك" : "Moving") : (ar ? "ثابت" : "Still")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
