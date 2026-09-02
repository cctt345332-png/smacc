"use client";
import { useEffect, useState, use } from "react";
import { getSupervisorSummary, getSupervisorInvoices, getSupervisorPayments, getSupervisorReps } from "@/lib/reps";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const STATUS: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  draft: { ar: "مسودة", en: "Draft", color: "#64748B", bg: "#F1F5F9" },
  submitted: { ar: "بانتظار المراجعة", en: "Submitted", color: "#B45309", bg: "#FEF3C7" },
  approved: { ar: "موافق عليها", en: "Approved", color: "#5A187E", bg: "#F3E8FF" },
  rejected: { ar: "مرفوضة", en: "Rejected", color: "#B91C1C", bg: "#FEE2E2" },
  confirmed: { ar: "مؤكدة", en: "Confirmed", color: "#166534", bg: "#DCFCE7" },
  sent: { ar: "مرسلة", en: "Sent", color: "#1D4ED8", bg: "#DBEAFE" },
  paid: { ar: "مدفوعة", en: "Paid", color: "#166534", bg: "#DCFCE7" },
  partial: { ar: "مدفوعة جزئيًا", en: "Partial", color: "#B45309", bg: "#FEF3C7" },
  overdue: { ar: "متأخرة", en: "Overdue", color: "#B91C1C", bg: "#FEE2E2" },
  cancelled: { ar: "ملغاة", en: "Cancelled", color: "#64748B", bg: "#F1F5F9" },
};

const statusPresentation = (status: string, ar: boolean) => {
  const item = STATUS[status] || { ar: status || "غير معروفة", en: status || "Unknown", color: "#64748B", bg: "#F1F5F9" };
  return { ...item, label: ar ? item.ar : item.en };
};

export default function SupervisorDashboard(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);
  const { locale } = params;
  const ar = locale === "ar";
  const base = `/${locale}`;
  const { user } = useAuthStore();
  const [summary, setSummary] = useState<any>(null);
  const [reps, setReps] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSupervisorSummary().catch(() => ({ data: null })),
      getSupervisorInvoices().catch(() => ({ data: [] })),
      getSupervisorPayments().catch(() => ({ data: [] })),
      getSupervisorReps().catch(() => ({ data: [] })),
    ]).then(([s, i, p, r]) => {
      setSummary(s.data);
      setInvoices(Array.isArray(i.data) ? i.data : []);
      setPayments(Array.isArray(p.data) ? p.data : []);
      setReps(Array.isArray(r.data) ? r.data : []);
    }).finally(() => setLoading(false));
  }, []);

  const firstName = ((user as any)?.fullName || "").split(" ")[0];
  const repSummaries = Array.isArray(summary?.rep_summaries) ? summary.rep_summaries : reps.map(rep => ({
    rep_id: rep.id, rep_code: rep.rep_code, full_name: rep.full_name, invoice_count: 0,
    invoice_status_counts: {}, total_sales: 0, total_collected: 0, opening_balance: 0, outstanding: 0,
  }));
  const statusCounts = summary?.invoice_status_counts || {};
  const visibleInvoices = invoices.slice(0, 30);
  const visiblePayments = payments.slice(0, 20);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{ar ? "جاري تحميل بيانات المناديب والفواتير والسندات..." : "Loading reps, invoices and receipts..."}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{ar ? "مرحباً،" : "Welcome,"}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{firstName || (ar ? "المشرف" : "Supervisor")}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {new Date().toLocaleDateString(ar ? "ar-SA" : "en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {[
          { label: ar ? "عدد المناديب" : "My Reps", value: String(summary?.rep_count || reps.length || 0), color: "#75617F" },
          { label: ar ? "الفواتير المالية" : "Financial invoices", value: String(summary?.invoice_count || 0), color: "#5A187E" },
          { label: ar ? "إجمالي الفواتير" : "All invoices", value: String(summary?.total_invoice_count || invoices.length || 0), color: "#2563EB" },
          { label: ar ? "إجمالي المبيعات" : "Total Sales", value: fmt(summary?.total_sales) + " SAR", color: "#5A187E" },
          { label: ar ? "المحصّل" : "Collected", value: fmt(summary?.total_collected) + " SAR", color: "#166534" },
          { label: ar ? "الرصيد الافتتاحي" : "Opening balance", value: fmt(summary?.opening_balance) + " SAR", color: "#B45309" },
          { label: ar ? "المستحق النهائي" : "Final outstanding", value: fmt(summary?.outstanding) + " SAR", color: Number(summary?.outstanding) > 0 ? "#DC2626" : "#166534" },
        ].map(card => (
          <div key={card.label} style={{ background: "var(--surface)", borderRadius: 16, padding: "14px 15px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      <section style={{ background: "var(--surface)", borderRadius: 16, padding: 16, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{ar ? "حالات فواتير المناديب" : "Rep invoice statuses"}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{ar ? "تشمل المسودات والفواتير المقدمة والموافق عليها والمؤكدة." : "Includes drafts, submitted, approved and financial invoices."}</div>
          </div>
          <Link href={`${base}/supervisor/invoices`} style={{ color: "#5A187E", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>{ar ? "كل الفواتير" : "All invoices"}</Link>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {Object.keys(STATUS).map(status => {
            const presentation = statusPresentation(status, ar);
            return <span key={status} style={{ padding: "5px 9px", borderRadius: 20, background: presentation.bg, color: presentation.color, fontSize: 11, fontWeight: 700 }}>{presentation.label}: {Number(statusCounts[status] || 0)}</span>;
          })}
        </div>
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-secondary)" }}>{ar ? "فواتير المناديب" : "Rep invoices"}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{ar ? `آخر ${visibleInvoices.length} فاتورة مع اسم المندوب والحالة` : `Latest ${visibleInvoices.length} invoices with rep and status`}</div>
          </div>
          <Link href={`${base}/supervisor/invoices`} style={{ color: "#5A187E", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>{ar ? "عرض الكل" : "View all"}</Link>
        </div>
        {visibleInvoices.length === 0 ? (
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 24, border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>{ar ? "لا توجد فواتير للمناديب المعيّنين." : "No invoices for assigned reps."}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleInvoices.map(invoice => {
              const presentation = statusPresentation(invoice.status, ar);
              const remaining = Math.max(0, Number(invoice.total || 0) - Number(invoice.paid_amount || 0));
              return (
                <div key={invoice.id} style={{ background: "var(--surface)", borderRadius: 14, padding: "12px 14px", border: "1px solid var(--border)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                  <div style={{ minWidth: 115 }}>
                    <Link href={`${base}/sales/invoices/${invoice.id}`} style={{ color: "#5A187E", fontFamily: "monospace", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>{invoice.invoice_number}</Link>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{fmtDate(invoice.issue_date)}</div>
                  </div>
                  <div style={{ flex: "1 1 160px", minWidth: 150 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{invoice.buyer_name_ar || "—"}</div>
                    <div style={{ fontSize: 11, color: "#5A187E", marginTop: 3 }}>{ar ? "المندوب:" : "Rep:"} {invoice.rep_name || invoice.rep_code || "—"}</div>
                  </div>
                  <span style={{ padding: "4px 9px", borderRadius: 20, background: presentation.bg, color: presentation.color, fontSize: 11, fontWeight: 800 }}>{presentation.label}</span>
                  <div style={{ minWidth: 110, textAlign: "end" }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{fmt(invoice.total)} SAR</div>
                    <div style={{ fontSize: 11, color: remaining > 0 ? "#DC2626" : "#166534", marginTop: 3 }}>{ar ? "المتبقي:" : "Due:"} {fmt(remaining)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-secondary)" }}>{ar ? "سندات القبض" : "Receipt vouchers"}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{ar ? "السندات المرتبطة بالفواتير والسندات المباشرة على أرصدة العملاء." : "Invoice receipts and direct customer-balance receipts."}</div>
          </div>
          <Link href={`${base}/supervisor/reports`} style={{ color: "#5A187E", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>{ar ? "التقارير" : "Reports"}</Link>
        </div>
        {visiblePayments.length === 0 ? (
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 24, border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>{ar ? "لا توجد سندات قبض للمناديب المعيّنين." : "No receipts for assigned reps."}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visiblePayments.map(payment => (
              <div key={payment.id} style={{ background: "var(--surface)", borderRadius: 14, padding: "12px 14px", border: "1px solid var(--border)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <div style={{ minWidth: 115 }}>
                  <div style={{ color: "#166534", fontFamily: "monospace", fontWeight: 800, fontSize: 13 }}>{payment.payment_number}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{fmtDate(payment.payment_date)}</div>
                </div>
                <div style={{ flex: "1 1 170px", minWidth: 155 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{payment.customer_name || "—"}</div>
                  <div style={{ fontSize: 11, color: "#5A187E", marginTop: 3 }}>{ar ? "المندوب:" : "Rep:"} {payment.rep_name || payment.rep_code || "—"}</div>
                </div>
                <div style={{ flex: "1 1 130px", minWidth: 120, fontSize: 11, color: "var(--text-muted)" }}>
                  <div>{ar ? "المصدر:" : "Source:"} {payment.invoice_number || (ar ? "رصيد العميل" : "Customer balance")}</div>
                  <div style={{ marginTop: 3 }}>{payment.payment_method || "—"}</div>
                </div>
                <div style={{ color: "#166534", fontWeight: 800, fontSize: 14 }}>{fmt(payment.amount)} SAR</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-secondary)", marginBottom: 10 }}>{ar ? "ملخص كل مندوب" : "Per-rep breakdown"}</div>
        {repSummaries.length === 0 ? (
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 24, border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 12, textAlign: "center" }}>{ar ? "لم يتم تعيين مناديب لهذا المشرف." : "No reps assigned to this supervisor."}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {repSummaries.map((rep: any) => {
              const counts = rep.invoice_status_counts || {};
              return (
                <div key={rep.rep_id} style={{ background: "var(--surface)", borderRadius: 14, padding: "13px 15px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{rep.full_name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{rep.rep_code} · {rep.invoice_count || 0} {ar ? "فاتورة" : "invoices"}</div>
                    </div>
                    <div style={{ color: Number(rep.outstanding) > 0 ? "#DC2626" : "#166534", fontWeight: 800, fontSize: 13 }}>{fmt(rep.outstanding)} SAR</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, fontSize: 10 }}>
                    <span style={{ color: "#5A187E" }}>{ar ? "مبيعات" : "Sales"}: {fmt(rep.total_sales)}</span>
                    <span style={{ color: "#166534" }}>{ar ? "محصل" : "Collected"}: {fmt(rep.total_collected)}</span>
                    <span style={{ color: "#B45309" }}>{ar ? "افتتاحي" : "Opening"}: {fmt(rep.opening_balance)}</span>
                    {Object.entries(counts).map(([status, count]) => <span key={status} style={{ padding: "2px 6px", borderRadius: 10, background: statusPresentation(status, ar).bg, color: statusPresentation(status, ar).color }}>{statusPresentation(status, ar).label}: {String(count)}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{ar ? "الإجراءات السريعة" : "Quick Actions"}</div>
        {[
          { label: ar ? "فواتير مناديبي" : "Invoices", desc: ar ? "عرض جميع الفواتير حسب الحالة" : "View every invoice by status", href: `${base}/supervisor/invoices`, color: "#5A187E" },
          { label: ar ? "التقارير" : "Reports", desc: ar ? "تقارير الأداء والسندات" : "Performance and receipt reports", href: `${base}/supervisor/reports`, color: "#75617F" },
          { label: ar ? "مناديبي" : "My Reps", desc: ar ? `${reps.length} مندوب` : `${reps.length} reps`, href: `${base}/supervisor/reps`, color: "#6F4A84" },
        ].map(action => (
          <Link key={action.href} href={action.href} style={{ textDecoration: "none" }}>
            <div style={{ background: "var(--surface)", borderRadius: 16, padding: "16px 18px", border: "1.5px solid var(--border)", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: action.color + "18", display: "flex", alignItems: "center", justifyContent: "center", color: action.color, fontSize: 22 }}>◆</div>
              <div><div style={{ fontWeight: 700, fontSize: 14 }}>{action.label}</div><div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{action.desc}</div></div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginInlineStart: "auto", color: "var(--text-muted)" }}><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
