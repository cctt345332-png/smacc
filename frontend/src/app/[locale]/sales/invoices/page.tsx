"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getInvoices, getSalesSummary, confirmInvoice, cancelInvoice } from "@/lib/sales";
import { Icon } from "@/components/ui/Icons";
import {
  FINANCIAL_INVOICE_STATUSES,
  INVOICE_STATUS_PRESENTATION,
} from "@/lib/invoiceStatus";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const INVOICE_TYPES: Record<string, { ar: string; badge: string }> = {
  standard:   { ar: "ضريبية كاملة", badge: "badge-info" },
  simplified: { ar: "مبسطة",        badge: "badge-gray" },
};

export default function InvoicesPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [invoices, setInvoices] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    try {
      const [invRes, sumRes] = await Promise.all([
        getInvoices(filterStatus ? { status: filterStatus } : undefined),
        getSalesSummary(),
      ]);
      setInvoices(invRes.data);
      setSummary(sumRes.data);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const handleConfirm = async (id: string) => {
    if (!confirm(ar ? "تأكيد الفاتورة؟" : "Confirm this invoice?")) return;
    setActing(id);
    try { await confirmInvoice(id); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(null); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm(ar ? "إلغاء الفاتورة؟" : "Cancel this invoice?")) return;
    setActing(id);
    try { await cancelInvoice(id); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(null); }
  };

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/sales`}>{ar ? "المبيعات" : "Sales"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الفواتير" : "Invoices"}</span>
          </div>
          <h1 className="page-title">{ar ? "فواتير المبيعات" : "Sales Invoices"}</h1>
          <p className="page-subtitle">{ar ? "فواتير ضريبية متوافقة مع زاتكا" : "ZATCA-compliant tax invoices"}</p>
        </div>
        <Link href={`/${locale}/sales/invoices/new`} className="btn btn-primary">
          <Icon name="plus" size={16} />
          {ar ? "+ فاتورة جديدة" : "+ New Invoice"}
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#EFF6FF" }}>
            <Icon name="invoice" size={22} color="#485668" />
          </div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "إجمالي الفواتير" : "Total Invoiced"}</div>
            <div className="stat-value">{fmt(summary?.total_invoiced)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>SAR</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#DCFCE7" }}>
            <Icon name="wallet" size={22} color="#059669" />
          </div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "المحصّل" : "Total Paid"}</div>
            <div className="stat-value">{fmt(summary?.total_paid)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>SAR</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#FEF9C3" }}>
            <Icon name="money" size={22} color="#D97706" />
          </div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "المستحق" : "Outstanding"}</div>
            <div className="stat-value">{fmt(summary?.total_outstanding)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>SAR</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#FEE2E2" }}>
            <Icon name="warning" size={22} color="#DC2626" />
          </div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "متأخرة السداد" : "Overdue"}</div>
            <div className="stat-value">{summary?.overdue_count ?? 0}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{ar ? "فاتورة" : "invoices"}</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select
            className="form-input form-select"
            style={{ width: 200 }}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">{ar ? "كل الحالات" : "All Statuses"}</option>
            {FINANCIAL_INVOICE_STATUSES.map((status) => (
              <option key={status} value={status}>{INVOICE_STATUS_PRESENTATION[status].ar}</option>
            ))}
          </select>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {invoices.length} {ar ? "فاتورة" : "invoices"}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : invoices.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}>
                <Icon name="invoice" size={24} />
              </div>
              <div className="empty-state-title">{ar ? "لا توجد فواتير" : "No invoices found"}</div>
              <div className="empty-state-desc">
                <Link href={`/${locale}/sales/invoices/new`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                  {ar ? "إنشاء فاتورة جديدة" : "Create New Invoice"}
                </Link>
              </div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم الفاتورة" : "Invoice #"}</th>
                  <th>{ar ? "العميل" : "Customer"}</th>
                  <th>{ar ? "النوع" : "Type"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المدفوع" : "Paid"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const status = INVOICE_STATUS_PRESENTATION[inv.status] || { ar: "حالة غير معروفة", badge: "badge-gray" };
                  const itype = INVOICE_TYPES[inv.invoice_type] || { ar: inv.invoice_type, badge: "badge-gray" };
                  const today = new Date(); today.setHours(0,0,0,0);
                  const dueDate = inv.due_date ? new Date(inv.due_date) : null;
                  const isOverdue = dueDate && dueDate < today && !["paid","cancelled"].includes(inv.status);
                  const overdueDays = isOverdue ? Math.floor((today.getTime() - dueDate!.getTime()) / 86400000) : 0;
                  return (
                    <tr key={inv.id} style={isOverdue ? { background: "#FFF5F5" } : {}}>
                      <td>
                        <Link href={`/${locale}/sales/invoices/${inv.id}`} style={{ fontWeight: 700, color: "var(--primary)", textDecoration: "none" }}>
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td>{inv.buyer_name_ar || inv.customer?.name_ar || "—"}</td>
                      <td><span className={`badge ${itype.badge}`}>{itype.ar}</span></td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                        <div>{inv.issue_date?.split("T")[0]}</div>
                        {dueDate && (
                          <div style={{ fontSize: 11, color: isOverdue ? "var(--danger)" : "var(--text-muted)", fontWeight: isOverdue ? 700 : 400 }}>
                            {ar ? "استحقاق:" : "Due:"} {dueDate.toISOString().split("T")[0]}
                            {isOverdue && <span style={{ marginInlineStart: 4, color: "var(--danger)" }}>({ar ? `متأخر ${overdueDays} يوم` : `${overdueDays}d overdue`})</span>}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>
                        {fmt(inv.total)} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>SAR</span>
                      </td>
                      <td style={{ textAlign: "end", color: "var(--success)" }}>
                        {fmt(inv.paid_amount)}
                      </td>
                      <td>
                        {isOverdue
                          ? <span className="badge badge-danger">{ar ? "متأخرة" : "Overdue"}</span>
                          : <span className={`badge ${status.badge}`}>{status.ar}</span>
                        }
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Link href={`/${locale}/sales/invoices/${inv.id}`} className="btn btn-ghost btn-sm" title={ar ? "عرض" : "View"}>
                            <Icon name="view" size={14} />
                          </Link>
                          {inv.status === "draft" && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: "var(--success)" }}
                              onClick={() => handleConfirm(inv.id)}
                              disabled={acting === inv.id}
                              title={ar ? "تأكيد" : "Confirm"}
                            >
                              <Icon name="check" size={14} />
                            </button>
                          )}
                          {(inv.status === "draft" || inv.status === "confirmed") && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: "var(--danger)" }}
                              onClick={() => handleCancel(inv.id)}
                              disabled={acting === inv.id}
                              title={ar ? "إلغاء" : "Cancel"}
                            >
                              <Icon name="cancel" size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
