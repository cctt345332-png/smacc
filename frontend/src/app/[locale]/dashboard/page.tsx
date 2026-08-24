"use client";

import { Fragment, useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import AppLayout from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icons";
import { getCompany } from "@/lib/settings";
import { getExpiryAlerts } from "@/lib/inventory";
import api from "@/lib/api";

const formatAmount = (value: unknown) => Number(value || 0).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatDate = (value?: string) => value
  ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
  : "—";

const paymentLabel = (method?: string) => {
  const labels: Record<string, string> = {
    cash: "نقدي",
    credit: "آجل",
    cheque: "شيك",
    transfer: "تحويل بنكي",
  };
  return labels[method || ""] || "غير محددة";
};

type PendingInvoice = {
  id: string;
  invoice_number: string;
  buyer_name_ar: string;
  total: number;
  currency_code?: string;
  submitted_at?: string;
  invoice_payment_method?: string;
  rep_id?: string;
  rep_name?: string;
  rep_code?: string;
  rep_zone?: string;
};

function Metric({ label, value, hint, tone = "default" }: { label: string; value: string; hint: string; tone?: "default" | "alert" | "success" | "neutral" }) {
  return (
    <div className={`ops-metric ops-metric-${tone}`}>
      <span className="ops-metric-label">{label}</span>
      <strong className="ops-metric-value">{value}</strong>
      <span className="ops-metric-hint">{hint}</span>
    </div>
  );
}

export default function DashboardPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const tc = useTranslations("common");
  const ar = locale === "ar";
  const base = `/${locale}`;

  const [businessType, setBusinessType] = useState("general");
  const [expiryAlerts, setExpiryAlerts] = useState<any>(null);
  const [systemSummary, setSystemSummary] = useState<any>(null);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [rejectingInvoiceId, setRejectingInvoiceId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [actionError, setActionError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const [companyRes, systemRes, journalRes, pendingRes] = await Promise.all([
      getCompany().catch(() => ({ data: null })),
      api.get("/sales/invoices/system-summary").catch(() => ({ data: null })),
      api.get("/accounting/journal-entries?status=posted").catch(() => ({ data: [] })),
      api.get("/sales/invoices-pending").catch(() => ({ data: [] })),
    ]);

    const type = companyRes.data?.business_type || "general";
    setBusinessType(type);
    if (type === "pharmacy") {
      getExpiryAlerts(30).then(({ data }) => setExpiryAlerts(data)).catch(() => setExpiryAlerts(null));
    } else {
      setExpiryAlerts(null);
    }
    setSystemSummary(systemRes.data);
    setRecentTx(Array.isArray(journalRes.data) ? journalRes.data.slice(0, 6) : []);
    setPendingInvoices(Array.isArray(pendingRes.data) ? pendingRes.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const approveInvoice = async (invoice: PendingInvoice) => {
    setBusyInvoiceId(invoice.id);
    setActionError("");
    try {
      await api.post(`/sales/invoices/${invoice.id}/approve`);
      setPendingInvoices((current) => current.filter((item) => item.id !== invoice.id));
      loadDashboard();
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || "تعذر اعتماد الفاتورة. حاول مرة أخرى.");
    } finally {
      setBusyInvoiceId(null);
    }
  };

  const rejectInvoice = async (invoice: PendingInvoice) => {
    const note = rejectionNote.trim();
    if (!note) {
      setActionError("اكتب سبب إعادة الفاتورة للمندوب قبل الرفض.");
      return;
    }
    setBusyInvoiceId(invoice.id);
    setActionError("");
    try {
      await api.post(`/sales/invoices/${invoice.id}/reject`, { rejection_note: note });
      setPendingInvoices((current) => current.filter((item) => item.id !== invoice.id));
      setRejectingInvoiceId(null);
      setRejectionNote("");
      loadDashboard();
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || "تعذر رفض الفاتورة. حاول مرة أخرى.");
    } finally {
      setBusyInvoiceId(null);
    }
  };

  const salesThisMonth = systemSummary?.sales_total ?? 0;
  const grossProfit = systemSummary?.estimated_gross_profit ?? 0;
  const grossMargin = systemSummary?.gross_margin_pct ?? 0;
  const newCustomers = systemSummary?.new_customers ?? 0;
  const totalCustomers = systemSummary?.total_customers ?? 0;
  const outstanding = systemSummary?.outstanding_total ?? 0;
  const monthlyInvoiceCount = systemSummary?.invoice_count ?? 0;
  const expiryCount = (expiryAlerts?.expired_count ?? 0) + (expiryAlerts?.near_expiry_count ?? 0);

  return (
    <AppLayout locale={locale}>
      <div className="ops-dashboard" dir={ar ? "rtl" : "ltr"}>
        <header className="ops-header">
          <div>
            <div className="ops-kicker">{ar ? "مساحة المدير / المتابعة اليومية" : "Manager workspace / daily follow-up"}</div>
            <h1>{ar ? "لوحة العمليات" : "Operations dashboard"}</h1>
            <p>{ar ? "ملخص أداء النظام أولاً، ثم مهام المراجعة الخاصة بالمناديب والتنبيهات التشغيلية." : "Core system performance first, then rep review tasks and operational alerts."}</p>
          </div>
          <div className="ops-header-actions">
            <span className="ops-connection"><i />{ar ? "متصل بالخادم" : "Server connected"}</span>
          </div>
        </header>

        <section className="ops-metrics" aria-label={ar ? "مؤشرات اليوم" : "Today metrics"}>
          <Metric label={ar ? "مبيعات الشهر" : "Monthly sales"} value={`${formatAmount(salesThisMonth)} ${tc("currency")}`} hint={ar ? `${monthlyInvoiceCount} فاتورة مؤكدة خلال الشهر الجاري` : `${monthlyInvoiceCount} confirmed invoices this month`} tone="success" />
          <Metric label={ar ? "الربح الإجمالي التقديري" : "Estimated gross profit"} value={`${formatAmount(grossProfit)} ${tc("currency")}`} hint={ar ? `هامش إجمالي ${formatAmount(grossMargin)}% قبل المصروفات التشغيلية` : `${formatAmount(grossMargin)}% gross margin before operating expenses`} tone={grossProfit >= 0 ? "success" : "alert"} />
          <Metric label={ar ? "عملاء جدد" : "New customers"} value={loading ? "—" : String(newCustomers)} hint={ar ? `إجمالي قاعدة العملاء: ${totalCustomers}` : `Customer base: ${totalCustomers}`} tone="default" />
          <Metric label={ar ? "ذمم العملاء" : "Customer receivables"} value={`${formatAmount(outstanding)} ${tc("currency")}`} hint={ar ? "فواتير مؤكدة تحتاج متابعة التحصيل" : "Confirmed invoices requiring collection follow-up"} tone={outstanding > 0 ? "alert" : "neutral"} />
        </section>

        <section className="ops-panel ops-approval-panel" aria-label={ar ? "طلبات اعتماد فواتير المندوبين" : "Rep invoice approval queue"}>
          <div className="ops-panel-head">
            <div className="ops-panel-title"><span className="ops-panel-icon ops-panel-icon-alert"><Icon name="warning" size={16} /></span><div><h2>{ar ? "طلبات اعتماد فواتير المندوبين" : "Rep invoice approvals"}</h2><p>{ar ? "هذه الفواتير لا تؤثر في المبيعات أو المخزون إلا بعد الاعتماد." : "These invoices do not affect sales or inventory until approved."}</p></div></div>
            <Link href={`${base}/reps/manage`} className="ops-text-link">{ar ? "إدارة المناديب" : "Manage reps"}</Link>
          </div>

          {actionError && <div className="ops-action-error">{actionError}</div>}

          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>{ar ? "الفاتورة" : "Invoice"}</th><th>{ar ? "المندوب" : "Rep"}</th><th>{ar ? "العميل" : "Customer"}</th><th>{ar ? "طريقة الدفع" : "Payment"}</th><th>{ar ? "المبلغ" : "Amount"}</th><th>{ar ? "وقت التقديم" : "Submitted"}</th><th>{ar ? "القرار" : "Decision"}</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="ops-empty-row">{ar ? "جارٍ تحميل طلبات الاعتماد…" : "Loading approval requests…"}</td></tr> : pendingInvoices.length === 0 ? <tr><td colSpan={7} className="ops-empty-row"><div className="ops-empty-copy"><Icon name="invoice" size={20} /><strong>{ar ? "لا توجد فواتير بانتظار اعتمادك" : "No invoices await your approval"}</strong><span>{ar ? "ستظهر هنا فور تقديم المندوب للفاتورة." : "Submitted rep invoices will appear here."}</span></div></td></tr> : pendingInvoices.map((invoice) => <Fragment key={invoice.id}>
                  <tr key={invoice.id}>
                    <td><span className="ops-doc-number">{invoice.invoice_number}</span></td>
                    <td><strong>{invoice.rep_name || (invoice.rep_code ? `مندوب ${invoice.rep_code}` : "مندوب ميداني")}</strong><small>{invoice.rep_zone || "من دون منطقة مسجلة"}</small></td>
                    <td>{invoice.buyer_name_ar}</td>
                    <td><span className="ops-payment-tag">{paymentLabel(invoice.invoice_payment_method)}</span></td>
                    <td className="ops-amount">{formatAmount(invoice.total)} {invoice.currency_code || tc("currency")}</td>
                    <td className="ops-date">{formatDate(invoice.submitted_at)}</td>
                    <td><div className="ops-row-actions"><Link href={`${base}/sales/invoices`} className="ops-view-link">{ar ? "مراجعة" : "Review"}</Link><button type="button" className="ops-approve-button" disabled={busyInvoiceId === invoice.id} onClick={() => approveInvoice(invoice)}>{busyInvoiceId === invoice.id ? (ar ? "جارٍ الحفظ" : "Saving") : (ar ? "اعتماد" : "Approve")}</button><button type="button" className="ops-reject-button" disabled={busyInvoiceId === invoice.id} onClick={() => { setRejectingInvoiceId(rejectingInvoiceId === invoice.id ? null : invoice.id); setActionError(""); }}>{ar ? "إعادة" : "Return"}</button></div></td>
                  </tr>
                  {rejectingInvoiceId === invoice.id && <tr key={`${invoice.id}-reject`} className="ops-rejection-row"><td colSpan={7}><div className="ops-rejection-form"><label htmlFor={`reason-${invoice.id}`}>{ar ? "سبب إعادة الفاتورة إلى المندوب" : "Reason for returning the invoice"}</label><input id={`reason-${invoice.id}`} value={rejectionNote} onChange={(event) => setRejectionNote(event.target.value)} placeholder={ar ? "مثال: راجع الصنف أو طريقة الدفع أو بيانات العميل" : "Example: review item, payment method, or customer data"} /><button type="button" className="ops-reject-confirm" disabled={busyInvoiceId === invoice.id} onClick={() => rejectInvoice(invoice)}>{ar ? "تأكيد الإعادة" : "Confirm return"}</button><button type="button" className="ops-cancel-button" onClick={() => { setRejectingInvoiceId(null); setRejectionNote(""); }}>{ar ? "إلغاء" : "Cancel"}</button></div></td></tr>}
                </Fragment>)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ops-lower-grid">
          <article className="ops-panel">
            <div className="ops-panel-head"><div className="ops-panel-title"><span className="ops-panel-icon"><Icon name="journal" size={16} /></span><div><h2>{ar ? "آخر القيود المرحلة" : "Recent posted entries"}</h2><p>{ar ? "ملخص للسجل المالي دون تكرار دفتر الأستاذ." : "A concise financial log without duplicating the ledger."}</p></div></div><Link href={`${base}/accounting/journal`} className="ops-text-link">{ar ? "فتح الدفتر" : "Open ledger"}</Link></div>
            <div className="ops-table-wrap"><table className="ops-table ops-journal-table"><thead><tr><th>{ar ? "رقم القيد" : "Entry"}</th><th>{tc("date")}</th><th>{tc("description")}</th><th>{ar ? "القيمة" : "Value"}</th></tr></thead><tbody>{loading ? <tr><td colSpan={4} className="ops-empty-row">{ar ? "جارٍ تحميل القيود…" : "Loading entries…"}</td></tr> : recentTx.length === 0 ? <tr><td colSpan={4} className="ops-empty-row">{ar ? "لا توجد قيود مرحلة حتى الآن." : "No posted entries yet."}</td></tr> : recentTx.map((tx) => <tr key={tx.id}><td><span className="ops-doc-number">{tx.entry_number}</span></td><td className="ops-date">{formatDate(tx.entry_date)}</td><td>{ar ? tx.description_ar : (tx.description_en || tx.description_ar)}</td><td className="ops-amount">{formatAmount(tx.total_debit)} {tc("currency")}</td></tr>)}</tbody></table></div>
          </article>

          <aside className="ops-side-stack">
            <article className="ops-panel"><div className="ops-panel-head"><div className="ops-panel-title"><span className="ops-panel-icon"><Icon name="layout" size={16} /></span><div><h2>{ar ? "متابعة اليوم" : "Today follow-up"}</h2><p>{ar ? "تنبيهات محددة تحتاج انتباهًا." : "Focused items requiring attention."}</p></div></div></div><div className="ops-followup-list"><Link href={`${base}/sales/invoices`} className="ops-followup"><span><Icon name="invoice" size={15} /></span><div><strong>{ar ? "ذمم العملاء" : "Customer receivables"}</strong><small>{ar ? "فواتير مؤكدة تحتاج متابعة التحصيل" : "Confirmed invoices requiring collection follow-up"}</small></div><b>{formatAmount(outstanding)}</b></Link><Link href={`${base}/inventory/items`} className="ops-followup"><span><Icon name="box" size={15} /></span><div><strong>{ar ? "المخزون" : "Inventory"}</strong><small>{businessType === "pharmacy" && expiryCount > 0 ? (ar ? `${expiryCount} تشغيلة بحاجة للفحص` : `${expiryCount} batches need review`) : (ar ? "مراجعة الأرصدة المتاحة" : "Review available balances")}</small></div><b>{businessType === "pharmacy" && expiryCount ? expiryCount : "فتح"}</b></Link><Link href={`${base}/settings/tax`} className="ops-followup"><span><Icon name="tax" size={15} /></span><div><strong>{ar ? "الفوترة الإلكترونية" : "E-invoicing"}</strong><small>{ar ? "التحقق من حالة إعدادات زاتكا" : "Verify ZATCA configuration status"}</small></div><b>{ar ? "فحص" : "Check"}</b></Link></div></article>
            <article className="ops-panel ops-system-panel"><div className="ops-panel-head"><div className="ops-panel-title"><span className="ops-panel-icon"><Icon name="settings" size={16} /></span><div><h2>{ar ? "تهيئة النظام" : "System setup"}</h2><p>{ar ? "الوصول إلى الإعدادات التي تحفظ جاهزية التشغيل." : "Access the settings that keep operations ready."}</p></div></div></div><div className="ops-system-links"><Link href={`${base}/settings/company`}><Icon name="building" size={14} /><span>{ar ? "بيانات الشركة" : "Company profile"}</span></Link><Link href={`${base}/accounting/fiscal-years`}><Icon name="calendar" size={14} /><span>{ar ? "السنة المالية" : "Fiscal year"}</span></Link><Link href={`${base}/settings/users`}><Icon name="users" size={14} /><span>{ar ? "المستخدمون والصلاحيات" : "Users & roles"}</span></Link><Link href={`${base}/settings/tax`}><Icon name="tax" size={14} /><span>{ar ? "الفوترة الإلكترونية" : "E-invoicing"}</span></Link></div></article>
          </aside>
        </section>
      </div>
    </AppLayout>
  );
}
