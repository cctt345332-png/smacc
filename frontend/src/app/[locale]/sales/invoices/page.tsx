"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { getInvoices, getInvoice, confirmInvoice, cancelInvoice, deleteInvoiceDraft } from "@/lib/sales";
import { getReps } from "@/lib/reps";
import SearchableSelect from "@/components/ui/SearchableSelect";
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
  const [reps, setReps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRep, setFilterRep] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [serialExporting, setSerialExporting] = useState<string | null>(null);

  const load = async () => {
    try {
      const invRes = await getInvoices({ ...(filterStatus ? { status: filterStatus } : {}), ...(filterRep ? { rep_id: filterRep } : {}) });
      setInvoices(invRes.data);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => {
    getReps().then(({ data }) => setReps(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [filterStatus, filterRep]);

  const filteredInvoices = invoices.filter((invoice) => {
    const q = search.trim().toLowerCase();
    const haystack = [invoice.invoice_number, invoice.buyer_name_ar, invoice.customer?.name_ar, invoice.rep_name, invoice.rep_code]
      .filter(Boolean).join(" ").toLowerCase();
    const issueDate = String(invoice.issue_date || "").slice(0, 10);
    return (!q || haystack.includes(q)) && (!fromDate || issueDate >= fromDate) && (!toDate || issueDate <= toDate);
  });
  const displaySummary = {
    total_invoiced: filteredInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
    total_paid: filteredInvoices.reduce((sum, invoice) => sum + Number(invoice.paid_amount || 0), 0),
    total_outstanding: filteredInvoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.total || 0) - Number(invoice.paid_amount || 0)), 0),
    overdue_count: filteredInvoices.filter((invoice) => {
      const due = invoice.due_date ? new Date(invoice.due_date) : null;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return due && due < today && !["paid", "cancelled"].includes(invoice.status);
    }).length,
  };

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

  const handleDelete = async (id: string) => {
    if (!confirm(ar ? "حذف الفاتورة؟ لا يمكن التراجع." : "Delete this invoice? This cannot be undone.")) return;
    setActing(id);
    try { await deleteInvoiceDraft(id); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(null); }
  };

  const exportInvoiceSerials = async (invoice: any) => {
    setSerialExporting(invoice.id);
    try {
      const { data } = await getInvoice(invoice.id);
      const lines = Array.isArray(data?.lines) ? data.lines : [];
      const rows = lines.flatMap((line: any) =>
        (Array.isArray(line.serial_details) ? line.serial_details : []).map((serial: any) => ({
          [ar ? "رقم الفاتورة" : "Invoice Number"]: invoice.invoice_number || data.invoice_number || "",
          [ar ? "العميل" : "Customer"]: invoice.buyer_name_ar || data.buyer_name_ar || "",
          [ar ? "المندوب" : "Sales Rep"]: invoice.rep_name || data.rep_name || "",
          [ar ? "تاريخ الفاتورة" : "Invoice Date"]: invoice.issue_date ? String(invoice.issue_date).split("T")[0] : "",
          [ar ? "الصنف" : "Item"]: line.description_ar || "",
          [ar ? "رقم السيريال" : "Serial Number"]: serial.serial_number || "",
          [ar ? "الحالة" : "Status"]: serial.status || "",
          [ar ? "الحالة/النوع" : "Condition"]: serial.condition || "",
          [ar ? "التكلفة" : "Cost"]: Number(serial.cost_price || 0),
        }))
      );
      if (!rows.length) {
        alert(ar ? "لا توجد سيريالات مسجلة في هذه الفاتورة" : "No serials are registered on this invoice");
        return;
      }
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet["!cols"] = [
        { wch: 18 }, { wch: 30 }, { wch: 28 }, { wch: 16 }, { wch: 34 },
        { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(workbook, sheet, ar ? "السيريالات" : "Serials");
      const safeNumber = String(invoice.invoice_number || invoice.id).replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g, "-");
      XLSX.writeFile(workbook, `${safeNumber}-serials.xlsx`);
    } catch (e: any) {
      alert(e?.response?.data?.detail || (ar ? "تعذر تحميل سيريالات الفاتورة" : "Unable to load invoice serials"));
    } finally {
      setSerialExporting(null);
    }
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
            <Icon name="invoice" size={22} color="#5A187E" />
          </div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "إجمالي الفواتير" : "Total Invoiced"}</div>
            <div className="stat-value">{fmt(displaySummary.total_invoiced)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>SAR</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#F0E7F4" }}>
            <Icon name="wallet" size={22} color="#6F4A84" />
          </div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "المحصّل" : "Total Paid"}</div>
            <div className="stat-value">{fmt(displaySummary.total_paid)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>SAR</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#FEF9C3" }}>
            <Icon name="money" size={22} color="#D97706" />
          </div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "المستحق" : "Outstanding"}</div>
            <div className="stat-value">{fmt(displaySummary.total_outstanding)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>SAR</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#FEE2E2" }}>
            <Icon name="warning" size={22} color="#DC2626" />
          </div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "متأخرة السداد" : "Overdue"}</div>
            <div className="stat-value">{displaySummary.overdue_count}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{ar ? "فاتورة" : "invoices"}</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input className="form-input" style={{ width: 250 }} value={search} onChange={e => setSearch(e.target.value)} placeholder={ar ? "بحث برقم الفاتورة أو العميل" : "Search invoice or customer"} />
          <SearchableSelect locale={locale} value={filterRep} onChange={setFilterRep} placeholder={ar ? "اختر المندوب" : "Choose sales rep"} options={[{ value: "", label: ar ? "كل المناديب" : "All reps" }, ...reps.map(rep => ({ value: rep.id, label: `${rep.full_name || rep.name_ar || "—"}${rep.rep_code ? ` · ${rep.rep_code}` : ""}`, searchText: `${rep.full_name || ""} ${rep.name_ar || ""} ${rep.rep_code || ""}` }))]} style={{ width: 230 }} />
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
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>{ar ? "من" : "From"}<input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} /></label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>{ar ? "إلى" : "To"}<input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} /></label>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {filteredInvoices.length} {ar ? "فاتورة" : "invoices"}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : filteredInvoices.length === 0 ? (
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
                  <th>{ar ? "المندوب" : "Sales Rep"}</th>
                  <th>{ar ? "النوع" : "Type"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المدفوع" : "Paid"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => {
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
                      <td>
                        {inv.rep_name || inv.rep_code ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>{inv.rep_name || "—"}</div>
                            {inv.rep_code && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{inv.rep_code}</div>}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{ar ? "مبيعات مباشرة" : "Direct sale"}</span>
                        )}
                      </td>
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
                          <button className="btn btn-ghost btn-sm" style={{ color: "var(--primary)" }}
                            onClick={() => exportInvoiceSerials(inv)} disabled={serialExporting === inv.id}
                            title={ar ? "تحميل سيريالات الفاتورة Excel" : "Download invoice serials as Excel"}>
                            <Icon name="download" size={14} />
                          </button>
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
                          {(inv.status === "draft" || inv.status === "rejected" || inv.status === "confirmed") && Number(inv.paid_amount || 0) === 0 && (
                            <Link href={`/${locale}/sales/invoices/${inv.id}/edit`} className="btn btn-ghost btn-sm" title={ar ? "تعديل" : "Edit"}>
                              <Icon name="edit" size={14} />
                            </Link>
                          )}
                          {(inv.status === "draft" || inv.status === "rejected" || inv.status === "cancelled") && (
                            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => handleDelete(inv.id)} disabled={acting === inv.id} title={ar ? "حذف" : "Delete"}>
                              <Icon name="trash" size={14} />
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
