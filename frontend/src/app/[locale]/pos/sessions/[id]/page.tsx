"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSessionReport, closeSession, refundTransaction } from "@/lib/pos";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const ACTIVITY_CFG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  mobile_phones: { label: "جوالات وإلكترونيات", icon: "mobile",       color: "#485668", bg: "#EFF6FF" },
  spare_parts:   { label: "قطع غيار",            icon: "spareParts",   color: "#65707E", bg: "#F5F3FF" },
  pharmacy:      { label: "صيدلية",              icon: "pharmacy",     color: "#059669", bg: "#ECFDF5" },
  grocery:       { label: "بقالة",               icon: "grocery",      color: "#D97706", bg: "#FFFBEB" },
  spices:        { label: "عطارة وتوابل",         icon: "spices",       color: "#B45309", bg: "#FEF3C7" },
  clothing:      { label: "ملابس وأزياء",         icon: "clothing",     color: "#EC4899", bg: "#FDF2F8" },
  construction:  { label: "مواد بناء",            icon: "construction", color: "#64748B", bg: "#F1F5F9" },
  general:       { label: "عام",                 icon: "general",      color: "#0F172A", bg: "#F8FAFC" },
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي", mada: "مدى", credit_card: "بطاقة ائتمان", stc_pay: "STC Pay", split: "مقسّم",
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SessionDetailPage() {
  const params    = useParams();
  const router    = useRouter();
  const locale    = (params?.locale as string) || "ar";
  const sessionId = params?.id as string;
  const isAr      = locale === "ar";
  const sar       = isAr ? "ر.س" : "SAR";

  const [report,         setReport]         = useState<any>(null);
  const [loading,        setLoading]        = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingCash,    setClosingCash]    = useState("0");
  const [closeNotes,     setCloseNotes]     = useState("");
  const [closing,        setClosing]        = useState(false);
  const [closeError,     setCloseError]     = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const res = await getSessionReport(sessionId);
      setReport(res.data);
    } catch { setReport(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (sessionId) load(); }, [sessionId]);

  const handleClose = async () => {
    setClosing(true); setCloseError("");
    try {
      await closeSession(sessionId, {
        closing_cash: parseFloat(closingCash) || 0,
        notes: closeNotes || undefined,
      });
      setShowCloseModal(false);
      await load();
    } catch (e: any) {
      setCloseError(e?.response?.data?.detail || (isAr ? "حدث خطأ" : "Error"));
    } finally { setClosing(false); }
  };

  const handleRefund = async (txnId: string) => {
    if (!confirm(isAr ? "هل تريد استرداد هذه المعاملة؟" : "Refund this transaction?")) return;
    try { await refundTransaction(txnId); await load(); }
    catch (e: any) { alert(e?.response?.data?.detail || (isAr ? "حدث خطأ" : "Error")); }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(isAr ? "ar-SA" : "en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  // ── Loading ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "var(--primary)" }}>
        <Icon name="session" size={36} />
      </div>
      {isAr ? "جاري التحميل..." : "Loading..."}
    </div>
  );

  if (!report) return (
    <div className="empty-state" style={{ minHeight: "50vh" }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626", margin: "0 auto 12px" }}>
        <Icon name="warning" size={28} />
      </div>
      <div className="empty-state-title">{isAr ? "الجلسة غير موجودة" : "Session not found"}</div>
      <Link href={`/${locale}/pos/sessions`} className="btn btn-secondary" style={{ marginTop: 12 }}>
        <Icon name={isAr ? "arrowRight" : "arrowLeft"} size={15} />
        {isAr ? "رجوع للجلسات" : "Back to Sessions"}
      </Link>
    </div>
  );

  const session      = report.session;
  const transactions = report.transactions || [];
  const byMethod     = report.by_payment_method || {};
  const isOpen       = session.status === "open";
  const actCfg       = ACTIVITY_CFG[session.business_type] || ACTIVITY_CFG.general;

  const expectedCash = Number(session.opening_cash) + Number(session.total_cash);
  const actualCash   = session.closing_cash != null ? Number(session.closing_cash) : null;
  const difference   = actualCash != null ? actualCash - expectedCash : null;

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/pos`}>{isAr ? "نقطة البيع" : "POS"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/pos/sessions`}>{isAr ? "الجلسات" : "Sessions"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{isAr ? "تقرير الجلسة" : "Session Report"}</span>
          </div>
          <h1 className="page-title">{isAr ? "تقرير الجلسة" : "Session Report"}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span className={`badge ${isOpen ? "badge-success" : "badge-gray"}`}>
              {isOpen ? (isAr ? "مفتوحة" : "Open") : (isAr ? "مغلقة" : "Closed")}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {fmtDate(session.opened_at)}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <StructuredReportPrintButton locale={locale} title={isAr ? "تقرير جلسة نقطة البيع" : "POS Session Report"} subtitle={`${session.session_number || session.id}`} period={`${fmtDate(session.opened_at)} — ${session.closed_at ? fmtDate(session.closed_at) : (isAr ? "مفتوحة" : "Open")}`} orientation="landscape" reportCode={`PSS-${String(session.session_number || session.id).slice(-8)}`} metrics={[{ label: isAr ? "رصيد الافتتاح" : "Opening cash", value: `${fmt(Number(session.opening_cash || 0))} ${sar}`, tone: "neutral" }, { label: isAr ? "إجمالي المبيعات" : "Sales total", value: `${fmt(Number(session.total_sales || 0))} ${sar}`, tone: "green" }, { label: isAr ? "النقد المتوقع" : "Expected cash", value: `${fmt(expectedCash)} ${sar}`, tone: "blue" }, { label: isAr ? "فرق الإغلاق" : "Closing variance", value: difference == null ? "—" : `${fmt(difference)} ${sar}`, tone: difference === 0 ? "green" : "amber" }]} tables={[{ title: isAr ? "طرق الدفع" : "Payment methods", headers: [isAr ? "الطريقة" : "Method", isAr ? "المبلغ" : "Amount"], rows: Object.entries(byMethod).map(([method, amount]) => [PAYMENT_LABELS[method] || method, `${fmt(Number(amount || 0))} ${sar}`]) }, { title: isAr ? "المعاملات" : "Transactions", headers: [isAr ? "الوقت" : "Time", isAr ? "الرقم" : "Number", isAr ? "الدفع" : "Payment", isAr ? "الإجمالي" : "Total"], rows: transactions.map((txn: any) => [fmtDate(txn.created_at || txn.transaction_date), String(txn.transaction_number || txn.id || "—"), PAYMENT_LABELS[txn.payment_method] || txn.payment_method || "—", `${fmt(Number(txn.total || txn.total_amount || 0))} ${sar}`]) }]} />
          {isOpen && (
            <button className="btn btn-primary" onClick={() => { setClosingCash(String(expectedCash.toFixed(2))); setShowCloseModal(true); }}>
              <Icon name="lock" size={15} />
              {isAr ? "إغلاق الجلسة" : "Close Session"}
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: isAr ? "إجمالي المبيعات" : "Total Sales",    value: `${fmt(Number(session.total_sales))} ${sar}`,    icon: "revenue"  as const, color: "#059669", bg: "#ECFDF5" },
          { label: isAr ? "إجمالي النقد" : "Cash Sales",        value: `${fmt(Number(session.total_cash))} ${sar}`,     icon: "cash"     as const, color: "#485668", bg: "#EFF6FF" },
          { label: isAr ? "إجمالي البطاقة" : "Card Sales",      value: `${fmt(Number(session.total_card))} ${sar}`,     icon: "card"     as const, color: "#65707E", bg: "#F5F3FF" },
          { label: isAr ? "ضريبة القيمة المضافة" : "VAT",       value: `${fmt(Number(session.total_vat))} ${sar}`,      icon: "tax"      as const, color: "#D97706", bg: "#FFFBEB" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>
              <Icon name={s.icon} size={20} />
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Info + Reconciliation ───────────────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>

        {/* معلومات الجلسة */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-secondary)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {isAr ? "معلومات الجلسة" : "Session Info"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: isAr ? "الجهاز" : "Terminal",    value: session.terminal_id },
              { label: isAr ? "وقت الفتح" : "Opened",   value: fmtDate(session.opened_at) },
              { label: isAr ? "وقت الإغلاق" : "Closed", value: session.closed_at ? fmtDate(session.closed_at) : "—" },
              { label: isAr ? "عدد المعاملات" : "Transactions", value: String(session.transaction_count) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)" }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* طرق الدفع */}
          {Object.keys(byMethod).length > 0 && (
            <>
              <div style={{ borderTop: "1px solid var(--border)", margin: "14px 0" }} />
              <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {isAr ? "توزيع طرق الدفع" : "Payment Breakdown"}
              </div>
              {Object.entries(byMethod).map(([method, amount]) => (
                <div key={method} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name={method === "cash" ? "cash" : "card"} size={13} color="var(--text-muted)" />
                    <span style={{ color: "var(--text-secondary)" }}>{PAYMENT_LABELS[method] || method}</span>
                  </div>
                  <span style={{ fontWeight: 600 }}>{fmt(Number(amount))} {sar}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* مطابقة النقد */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-secondary)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {isAr ? "مطابقة النقد" : "Cash Reconciliation"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: isAr ? "رصيد الافتتاح" : "Opening Cash",  value: fmt(Number(session.opening_cash)),  color: "" },
              { label: isAr ? "مبيعات نقدية" : "Cash Sales",     value: `+ ${fmt(Number(session.total_cash))}`, color: "#059669" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)" }}>{label}</span>
                <span style={{ fontWeight: 600, color: color || "var(--text-primary)" }}>{value} {sar}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
              <span>{isAr ? "النقد المتوقع" : "Expected Cash"}</span>
              <span style={{ color: "#485668" }}>{fmt(expectedCash)} {sar}</span>
            </div>
            {actualCash != null && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--text-muted)" }}>{isAr ? "النقد الفعلي" : "Actual Cash"}</span>
                  <span style={{ fontWeight: 600 }}>{fmt(actualCash)} {sar}</span>
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700,
                  padding: "10px 12px", borderRadius: 8,
                  background: difference! >= 0 ? "#ECFDF5" : "#FEF2F2",
                  color: difference! >= 0 ? "#059669" : "#DC2626",
                }}>
                  <span>{isAr ? "الفرق" : "Difference"}</span>
                  <span>{difference! >= 0 ? "+" : ""}{fmt(difference!)} {sar}</span>
                </div>
              </>
            )}
            {isOpen && (
              <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 12, color: "#92400E" }}>
                <Icon name="info" size={13} />
                {" "}{isAr ? "الجلسة مفتوحة — أغلقها لإتمام المطابقة" : "Session is open — close it to complete reconciliation"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Transactions ───────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Icon name="receipt" size={16} />
            {isAr ? "المعاملات" : "Transactions"}
          </h3>
          <span className="badge badge-gray">{transactions.length}</span>
        </div>
        {transactions.length === 0 ? (
          <div className="empty-state">
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}>
              <Icon name="receipt" size={24} />
            </div>
            <div className="empty-state-title">{isAr ? "لا توجد معاملات" : "No transactions"}</div>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>{isAr ? "رقم المعاملة" : "Transaction #"}</th>
                  <th>{isAr ? "الأصناف" : "Items"}</th>
                  <th>{isAr ? "الإجمالي" : "Total"}</th>
                  <th>{isAr ? "ضريبة" : "VAT"}</th>
                  <th>{isAr ? "طريقة الدفع" : "Payment"}</th>
                  <th>{isAr ? "الحالة" : "Status"}</th>
                  <th>{isAr ? "الوقت" : "Time"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn: any) => (
                  <tr key={txn.id}>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--primary)" }}>
                        {txn.transaction_number}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-gray">{txn.lines_count}</span>
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--success)" }}>
                      {fmt(Number(txn.total))} {sar}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {fmt(Number(txn.vat_amount))} {sar}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                        <Icon name={txn.payment_method === "cash" ? "cash" : "card"} size={13} color="var(--text-muted)" />
                        {PAYMENT_LABELS[txn.payment_method] || txn.payment_method}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        txn.status === "completed" ? "badge-success" :
                        txn.status === "refunded"  ? "badge-warning" : "badge-gray"
                      }`}>
                        {txn.status === "completed" ? (isAr ? "مكتملة" : "Completed") :
                         txn.status === "refunded"  ? (isAr ? "مستردة" : "Refunded") :
                         (isAr ? "ملغاة" : "Cancelled")}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(txn.created_at).toLocaleTimeString(isAr ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>
                      {txn.status === "completed" && isOpen && (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleRefund(txn.id)}>
                          <Icon name="refund" size={13} />
                          {isAr ? "استرداد" : "Refund"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Close Session Modal ─────────────────────────────────────── */}
      {showCloseModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 440 }}>
            <div className="card-header">
              <h3 className="card-title">
                <Icon name="lock" size={16} />
                {isAr ? "إغلاق الجلسة" : "Close Session"}
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCloseModal(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="card-body">
              {closeError && (
                <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="warning" size={14} />{closeError}
                </div>
              )}

              {/* ملخص قبل الإغلاق */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { label: isAr ? "إجمالي المبيعات" : "Total Sales", value: `${fmt(Number(session.total_sales))} ${sar}`, color: "var(--success)" },
                  { label: isAr ? "عدد المعاملات" : "Transactions",  value: String(session.transaction_count),             color: "var(--primary)" },
                  { label: isAr ? "نقدي" : "Cash",                   value: `${fmt(Number(session.total_cash))} ${sar}`,   color: "" },
                  { label: isAr ? "النقد المتوقع" : "Expected Cash",  value: `${fmt(expectedCash)} ${sar}`,                color: "" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: "var(--bg)", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: color || "var(--text-primary)" }}>{value}</div>
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label className="form-label">{isAr ? "النقد الفعلي في الصندوق" : "Actual Cash in Drawer"} ({sar})</label>
                <input type="number" className="form-input" min={0} step={0.01} value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)} autoFocus />
                {closingCash && (
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    {isAr ? "الفرق: " : "Difference: "}
                    <strong style={{ color: (parseFloat(closingCash) - expectedCash) >= 0 ? "var(--success)" : "#DC2626" }}>
                      {(parseFloat(closingCash) - expectedCash) >= 0 ? "+" : ""}
                      {fmt(parseFloat(closingCash) - expectedCash)} {sar}
                    </strong>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">{isAr ? "ملاحظات" : "Notes"}</label>
                <textarea className="form-input" rows={2} value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder={isAr ? "اختياري..." : "Optional..."}
                  style={{ resize: "none" }} />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setShowCloseModal(false)} disabled={closing}>
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button className="btn btn-primary" onClick={handleClose} disabled={closing}>
                  <Icon name="lock" size={15} />
                  {closing ? (isAr ? "جاري الإغلاق..." : "Closing...") : (isAr ? "إغلاق الجلسة" : "Close Session")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
