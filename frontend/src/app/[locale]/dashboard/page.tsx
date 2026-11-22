"use client";

import { Fragment, useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import AppLayout from "@/components/layout/AppLayout";
import { Icon } from "@/components/ui/Icons";
import { getCompany } from "@/lib/settings";
import { getExpiryAlerts } from "@/lib/inventory";
import { getExpenses, approveExpense, rejectExpense } from "@/lib/expenses";
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

const expenseCategoryLabel = (category?: string, ar = true) => {
  const labels: Record<string, { ar: string; en: string }> = {
    fuel: { ar: "وقود", en: "Fuel" },
    vehicle_maintenance: { ar: "صيانة سيارة", en: "Vehicle maintenance" },
    shipping: { ar: "شحن وتوصيل", en: "Shipping" },
    hospitality: { ar: "ضيافة", en: "Hospitality" },
    communications: { ar: "اتصالات", en: "Communications" },
    parking: { ar: "مواقف", en: "Parking" },
    travel: { ar: "سفر", en: "Travel" },
    other: { ar: "مصروفات أخرى", en: "Other" },
  };
  return labels[category || ""]?.[ar ? "ar" : "en"] || category || "—";
};

const expenseAttachmentUrl = (attachment: { content_type?: string; file_data: string }) =>
  attachment.file_data.startsWith("data:")
    ? attachment.file_data
    : `data:${attachment.content_type || "application/octet-stream"};base64,${attachment.file_data}`;

type PendingInvoice = {
  id: string;
  invoice_number: string;
  buyer_name_ar: string;
  total: number;
  currency_code?: string;
  submitted_at?: string;
  status?: string;
  invoice_payment_method?: string;
  rep_id?: string;
  rep_name?: string;
  rep_code?: string;
  rep_zone?: string;
};

type PendingExpense = {
  id: string;
  expense_number: string;
  rep_name?: string;
  supervisor_name?: string;
  owner_type?: "rep" | "supervisor";
  amount: number;
  category?: string;
  expense_date?: string;
  description?: string;
  attachments?: Array<{ id: string; file_name: string; content_type?: string; file_data: string }>;
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
  const [pendingExpenses, setPendingExpenses] = useState<PendingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [rejectingInvoiceId, setRejectingInvoiceId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [rejectingExpenseId, setRejectingExpenseId] = useState<string | null>(null);
  const [expenseRejectionReason, setExpenseRejectionReason] = useState("");
  const [previewExpense, setPreviewExpense] = useState<PendingExpense | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const [companyRes, systemRes, journalRes, pendingRes, pendingExpensesRes] = await Promise.all([
      getCompany().catch(() => ({ data: null })),
      api.get("/sales/invoices/system-summary").catch(() => ({ data: null })),
      api.get("/accounting/journal-entries?status=posted").catch(() => ({ data: [] })),
      api.get("/sales/invoices-pending").catch(() => ({ data: [] })),
      getExpenses({ status: "pending" }).catch(() => ({ data: [] })),
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
    // لا يظهر في هذا الطابور إلا ما قدّمه المندوب للمراجعة. أي فاتورة
    // اعتمدها المحاسب تتحول إلى confirmed فتختفي فوراً من هذا القسم.
    setPendingInvoices(
      Array.isArray(pendingRes.data)
        ? pendingRes.data.filter((invoice: PendingInvoice) => invoice.status === "submitted")
        : []
    );
    setPendingExpenses(Array.isArray(pendingExpensesRes.data) ? pendingExpensesRes.data : []);
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

  const approvePendingExpense = async (expense: PendingExpense) => {
    setActionError("");
    try {
      await approveExpense(expense.id);
      setPendingExpenses((current) => current.filter((item) => item.id !== expense.id));
      loadDashboard();
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || "تعذر اعتماد المصروف. حاول مرة أخرى.");
    }
  };

  const rejectPendingExpense = async (expense: PendingExpense) => {
    const reason = expenseRejectionReason.trim();
    if (!reason) { setActionError("اكتب سبب رفض المصروف."); return; }
    try {
      await rejectExpense(expense.id, reason);
      setPendingExpenses((current) => current.filter((item) => item.id !== expense.id));
      setRejectingExpenseId(null);
      setExpenseRejectionReason("");
      loadDashboard();
    } catch (error: any) {
      setActionError(error?.response?.data?.detail || "تعذر رفض المصروف. حاول مرة أخرى.");
    }
  };

  const salesThisMonth = systemSummary?.sales_total ?? 0;
  const grossProfit = systemSummary?.estimated_gross_profit ?? 0;
  const grossMargin = systemSummary?.gross_margin_pct ?? 0;
  const newCustomers = systemSummary?.new_customers ?? 0;
  const totalCustomers = systemSummary?.total_customers ?? 0;
  const outstanding = systemSummary?.outstanding_total ?? 0;
  const openingReceivables = systemSummary?.opening_balance ?? 0;
  const operationalReceivables = systemSummary?.operational_outstanding ?? 0;
  const collectedReceivables = systemSummary?.total_collected ?? 0;
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
          <Metric label={ar ? "ذمم العملاء" : "Customer receivables"} value={`${formatAmount(outstanding)} ${tc("currency")}`} hint={ar ? `افتتاحي ${formatAmount(openingReceivables)} + تشغيلي ${formatAmount(operationalReceivables)} — محصّل ${formatAmount(collectedReceivables)}` : `Opening ${formatAmount(openingReceivables)} + operational ${formatAmount(operationalReceivables)} — collected ${formatAmount(collectedReceivables)}`} tone={outstanding > 0 ? "alert" : "neutral"} />
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
                    <td><div className="ops-row-actions"><Link href={`${base}/sales/invoices/${invoice.id}`} className="ops-view-link">{ar ? "مراجعة" : "Review"}</Link><button type="button" className="ops-approve-button" disabled={busyInvoiceId === invoice.id} onClick={() => approveInvoice(invoice)}>{busyInvoiceId === invoice.id ? (ar ? "جارٍ الحفظ" : "Saving") : (ar ? "اعتماد" : "Approve")}</button><button type="button" className="ops-reject-button" disabled={busyInvoiceId === invoice.id} onClick={() => { setRejectingInvoiceId(rejectingInvoiceId === invoice.id ? null : invoice.id); setActionError(""); }}>{ar ? "إعادة" : "Return"}</button></div></td>
                  </tr>
                  {rejectingInvoiceId === invoice.id && <tr key={`${invoice.id}-reject`} className="ops-rejection-row"><td colSpan={7}><div className="ops-rejection-form"><label htmlFor={`reason-${invoice.id}`}>{ar ? "سبب إعادة الفاتورة إلى المندوب" : "Reason for returning the invoice"}</label><input id={`reason-${invoice.id}`} value={rejectionNote} onChange={(event) => setRejectionNote(event.target.value)} placeholder={ar ? "مثال: راجع الصنف أو طريقة الدفع أو بيانات العميل" : "Example: review item, payment method, or customer data"} /><button type="button" className="ops-reject-confirm" disabled={busyInvoiceId === invoice.id} onClick={() => rejectInvoice(invoice)}>{ar ? "تأكيد الإعادة" : "Confirm return"}</button><button type="button" className="ops-cancel-button" onClick={() => { setRejectingInvoiceId(null); setRejectionNote(""); }}>{ar ? "إلغاء" : "Cancel"}</button></div></td></tr>}
                </Fragment>)}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ops-panel ops-approval-panel" aria-label={ar ? "طلبات اعتماد مصروفات المناديب" : "Rep expense approval queue"}>
          <div className="ops-panel-head">
            <div className="ops-panel-title"><span className="ops-panel-icon ops-panel-icon-alert"><Icon name="journal" size={16} /></span><div><h2>{ar ? "طلبات اعتماد مصروفات المناديب" : "Rep expense approvals"}</h2><p>{ar ? "مراجعة المصروف قبل اعتماده وترحيله محاسبياً." : "Review expenses before approval and accounting posting."}</p></div></div>
            <Link href={`${base}/treasury/rep-expenses`} className="ops-text-link">{ar ? "إدارة المصروفات" : "Manage expenses"}</Link>
          </div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>{ar ? "رقم المصروف" : "Expense"}</th><th>{ar ? "صاحب المصروف" : "Expense owner"}</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "الوصف" : "Description"}</th><th>{ar ? "المبلغ" : "Amount"}</th><th>{ar ? "القرار" : "Decision"}</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="ops-empty-row">{ar ? "جارٍ تحميل طلبات المصروفات…" : "Loading expense requests…"}</td></tr> : pendingExpenses.length === 0 ? <tr><td colSpan={6} className="ops-empty-row"><div className="ops-empty-copy"><Icon name="journal" size={20} /><strong>{ar ? "لا توجد مصروفات بانتظار الاعتماد" : "No expenses await approval"}</strong><span>{ar ? "ستظهر هنا مصروفات المندوبين الجديدة." : "New representative expenses will appear here."}</span></div></td></tr> : pendingExpenses.map((expense) => <Fragment key={expense.id}>
                  <tr><td><span className="ops-doc-number">{expense.expense_number}</span></td><td><strong>{expense.owner_type === "supervisor" ? (expense.supervisor_name || (ar ? "مشرف" : "Supervisor")) : (expense.rep_name || (ar ? "مندوب" : "Representative"))}</strong><small>{expense.owner_type === "supervisor" ? (ar ? "مشرف" : "Supervisor") : (ar ? "مندوب" : "Representative")}</small></td><td className="ops-date">{formatDate(expense.expense_date)}</td><td>{expense.description || expenseCategoryLabel(expense.category, ar)}</td><td className="ops-amount">{formatAmount(expense.amount)} {tc("currency")}</td><td><div className="ops-row-actions"><button type="button" className="ops-view-link" onClick={() => setPreviewExpense(expense)}>{ar ? "معاينة" : "Preview"}</button><button type="button" className="ops-approve-button" onClick={() => approvePendingExpense(expense)}>{ar ? "اعتماد" : "Approve"}</button><button type="button" className="ops-reject-button" onClick={() => { setRejectingExpenseId(rejectingExpenseId === expense.id ? null : expense.id); setActionError(""); }}>{ar ? "رفض" : "Reject"}</button></div></td></tr>
                  {rejectingExpenseId === expense.id && <tr className="ops-rejection-row"><td colSpan={6}><div className="ops-rejection-form"><label htmlFor={`expense-reason-${expense.id}`}>{ar ? "سبب رفض المصروف" : "Expense rejection reason"}</label><input id={`expense-reason-${expense.id}`} value={expenseRejectionReason} onChange={(event) => setExpenseRejectionReason(event.target.value)} placeholder={ar ? "اكتب سبب الرفض ليصل للمندوب" : "Reason sent to the representative"} /><button type="button" className="ops-reject-confirm" onClick={() => rejectPendingExpense(expense)}>{ar ? "تأكيد الرفض" : "Confirm rejection"}</button><button type="button" className="ops-cancel-button" onClick={() => { setRejectingExpenseId(null); setExpenseRejectionReason(""); }}>{ar ? "إلغاء" : "Cancel"}</button></div></td></tr>}
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
            <article className="ops-panel"><div className="ops-panel-head"><div className="ops-panel-title"><span className="ops-panel-icon"><Icon name="layout" size={16} /></span><div><h2>{ar ? "متابعة اليوم" : "Today follow-up"}</h2><p>{ar ? "تنبيهات محددة تحتاج انتباهًا." : "Focused items requiring attention."}</p></div></div></div><div className="ops-followup-list"><Link href={`${base}/sales/invoices`} className="ops-followup"><span><Icon name="invoice" size={15} /></span><div><strong>{ar ? "ذمم العملاء" : "Customer receivables"}</strong><small>{ar ? `الافتتاحي ${formatAmount(openingReceivables)} + التشغيلي ${formatAmount(operationalReceivables)} بعد خصم المحصّل ${formatAmount(collectedReceivables)}` : `Opening ${formatAmount(openingReceivables)} + operational ${formatAmount(operationalReceivables)} after collected ${formatAmount(collectedReceivables)}`}</small></div><b>{formatAmount(outstanding)}</b></Link><Link href={`${base}/inventory/items`} className="ops-followup"><span><Icon name="box" size={15} /></span><div><strong>{ar ? "المخزون" : "Inventory"}</strong><small>{businessType === "pharmacy" && expiryCount > 0 ? (ar ? `${expiryCount} تشغيلة بحاجة للفحص` : `${expiryCount} batches need review`) : (ar ? "مراجعة الأرصدة المتاحة" : "Review available balances")}</small></div><b>{businessType === "pharmacy" && expiryCount ? expiryCount : "فتح"}</b></Link><Link href={`${base}/settings/tax`} className="ops-followup"><span><Icon name="tax" size={15} /></span><div><strong>{ar ? "الفوترة الإلكترونية" : "E-invoicing"}</strong><small>{ar ? "التحقق من حالة إعدادات زاتكا" : "Verify ZATCA configuration status"}</small></div><b>{ar ? "فحص" : "Check"}</b></Link></div></article>
            <article className="ops-panel ops-system-panel"><div className="ops-panel-head"><div className="ops-panel-title"><span className="ops-panel-icon"><Icon name="settings" size={16} /></span><div><h2>{ar ? "تهيئة النظام" : "System setup"}</h2><p>{ar ? "الوصول إلى الإعدادات التي تحفظ جاهزية التشغيل." : "Access the settings that keep operations ready."}</p></div></div></div><div className="ops-system-links"><Link href={`${base}/settings/company`}><Icon name="building" size={14} /><span>{ar ? "بيانات الشركة" : "Company profile"}</span></Link><Link href={`${base}/accounting/fiscal-years`}><Icon name="calendar" size={14} /><span>{ar ? "السنة المالية" : "Fiscal year"}</span></Link><Link href={`${base}/settings/users`}><Icon name="users" size={14} /><span>{ar ? "المستخدمون والصلاحيات" : "Users & roles"}</span></Link><Link href={`${base}/settings/tax`}><Icon name="tax" size={14} /><span>{ar ? "الفوترة الإلكترونية" : "E-invoicing"}</span></Link></div></article>
          </aside>
        </section>
        {previewExpense && <div role="dialog" aria-modal="true" aria-label={ar ? "معاينة المصروف" : "Expense preview"} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(20, 10, 28, .58)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }} onClick={() => setPreviewExpense(null)}>
          <div className="card" style={{ width: "min(920px, 100%)", maxHeight: "92vh", overflow: "auto", padding: 18 }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #D5C8DD", paddingBottom: 10, marginBottom: 14 }}><div><h2 style={{ margin: 0, color: "#3E0865", fontSize: 18 }}>{ar ? "معاينة المصروف" : "Expense preview"}</h2><div style={{ color: "#75617F", fontSize: 12, marginTop: 3 }}>{previewExpense.expense_number} — {previewExpense.owner_type === "supervisor" ? (previewExpense.supervisor_name || (ar ? "مشرف" : "Supervisor")) : (previewExpense.rep_name || (ar ? "مندوب" : "Representative"))}</div></div><button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreviewExpense(null)}>{ar ? "إغلاق" : "Close"}</button></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}><div><small>{ar ? "التاريخ" : "Date"}</small><strong style={{ display: "block", marginTop: 3 }}>{formatDate(previewExpense.expense_date)}</strong></div><div><small>{ar ? "التصنيف" : "Category"}</small><strong style={{ display: "block", marginTop: 3 }}>{expenseCategoryLabel(previewExpense.category, ar)}</strong></div><div><small>{ar ? "المبلغ" : "Amount"}</small><strong style={{ display: "block", marginTop: 3 }}>{formatAmount(previewExpense.amount)} {tc("currency")}</strong></div></div>
            <div style={{ padding: 10, background: "#F8F5FA", border: "1px solid #E5DCEA", marginBottom: 14 }}><strong>{ar ? "الوصف" : "Description"}</strong><div style={{ marginTop: 5 }}>{previewExpense.description || expenseCategoryLabel(previewExpense.category, ar)}</div></div>
            <h3 style={{ margin: "0 0 10px", color: "#3E0865", fontSize: 14 }}>{ar ? "المرفقات" : "Attachments"}</h3>
            {!previewExpense.attachments?.length ? <div style={{ color: "#75617F" }}>{ar ? "لا توجد مرفقات" : "No attachments"}</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 12 }}>{previewExpense.attachments.map((attachment) => { const url = expenseAttachmentUrl(attachment); const isImage = (attachment.content_type || "").startsWith("image/"); const isPdf = attachment.content_type === "application/pdf" || attachment.file_name.toLowerCase().endsWith(".pdf"); return <div key={attachment.id} style={{ border: "1px solid #D5C8DD", background: "#fff", padding: 8 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#4C126D", marginBottom: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={attachment.file_name}>{attachment.file_name}</div>{isImage ? <img src={url} alt={attachment.file_name} style={{ width: "100%", height: 260, objectFit: "contain", background: "#F8F5FA" }} /> : isPdf ? <iframe title={attachment.file_name} src={url} style={{ width: "100%", height: 300, border: 0, background: "#F8F5FA" }} /> : <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#75617F" }}>{ar ? "هذا النوع لا يدعم المعاينة المباشرة" : "This file type cannot be previewed"}</div>}</div>; })}</div>}
          </div>
        </div>}
      </div>
    </AppLayout>
  );
}
