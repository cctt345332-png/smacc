"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getBills, getPurchasesSummary, confirmBill, cancelBill } from "@/lib/purchases";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const STATUS_MAP: Record<string, { ar: string; badge: string }> = {
  draft:     { ar: "مسودة",   badge: "badge-warning" },
  confirmed: { ar: "مؤكدة",   badge: "badge-info" },
  paid:      { ar: "مدفوعة",  badge: "badge-success" },
  partial:   { ar: "جزئية",   badge: "badge-warning" },
  cancelled: { ar: "ملغاة",   badge: "badge-danger" },
};

export default function BillsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [bills, setBills] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    try {
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      if (filterVendor) params.vendor_id = filterVendor;
      const [billsRes, sumRes] = await Promise.all([
        getBills(Object.keys(params).length ? params : undefined),
        getPurchasesSummary(),
      ]);
      setBills(billsRes.data);
      setSummary(sumRes.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    import("@/lib/purchases").then(m => m.getVendors()).then(({ data }) => setVendors(data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [filterStatus, filterVendor]);

  const handleConfirm = async (id: string) => {
    if (!confirm(ar ? "تأكيد الفاتورة الواردة؟" : "Confirm this bill?")) return;
    setActing(id);
    try { await confirmBill(id); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(null); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm(ar ? "إلغاء الفاتورة الواردة؟" : "Cancel this bill?")) return;
    setActing(id);
    try { await cancelBill(id); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(null); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/purchases`}>{ar ? "المشتريات" : "Purchases"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الفواتير الواردة" : "Bills"}</span>
          </div>
          <h1 className="page-title">{ar ? "الفواتير الواردة" : "Purchase Bills"}</h1>
          <p className="page-subtitle">{ar ? "فواتير الموردين والمدفوعات" : "Vendor bills and payments"}</p>
        </div>
        <Link href={`/${locale}/purchases/bills/new`} className="btn btn-primary">
          <Icon name="plus" size={16} /> {ar ? "+ فاتورة واردة جديدة" : "+ New Bill"}
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#EFF6FF" }}>
            <Icon name="invoice" size={22} color="#5A187E" />
          </div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "إجمالي الفواتير" : "Total Billed"}</div>
            <div className="stat-value">{fmt(summary?.total_billed)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>SAR</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#DCFCE7" }}>
            <Icon name="wallet" size={22} color="#059669" />
          </div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "المدفوع" : "Total Paid"}</div>
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
            <div className="stat-label">{ar ? "مسودات" : "Drafts"}</div>
            <div className="stat-value">{summary?.draft_count ?? 0}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{ar ? "فاتورة" : "bills"}</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select className="form-input form-select" style={{ width: 180 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">{ar ? "كل الحالات" : "All Statuses"}</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.ar}</option>)}
          </select>
          <select className="form-input form-select" style={{ width: 220 }} value={filterVendor} onChange={e => setFilterVendor(e.target.value)}>
            <option value="">{ar ? "كل الموردين" : "All Vendors"}</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name_ar}</option>)}
          </select>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {bills.length} {ar ? "فاتورة" : "bills"}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : bills.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}>
                <Icon name="invoice" size={24} />
              </div>
              <div className="empty-state-title">{ar ? "لا توجد فواتير واردة" : "No bills found"}</div>
              <Link href={`/${locale}/purchases/bills/new`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                {ar ? "إنشاء فاتورة واردة" : "Create New Bill"}
              </Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم الفاتورة" : "Bill #"}</th>
                  <th>{ar ? "المورد" : "Vendor"}</th>
                  <th>{ar ? "رقم فاتورة المورد" : "Vendor Invoice #"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "الاستحقاق" : "Due"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المدفوع" : "Paid"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(bill => {
                  const status = STATUS_MAP[bill.status] || { ar: bill.status, badge: "badge-gray" };
                  const today = new Date(); today.setHours(0,0,0,0);
                  const dueDate = bill.due_date ? new Date(bill.due_date) : null;
                  const isOverdue = dueDate && dueDate < today && !["paid","cancelled"].includes(bill.status);
                  const overdueDays = isOverdue ? Math.floor((today.getTime() - dueDate!.getTime()) / 86400000) : 0;
                  return (
                    <tr key={bill.id} style={isOverdue ? { background: "#FFF5F5" } : {}}>
                      <td>
                        <Link href={`/${locale}/purchases/bills/${bill.id}`} style={{ fontWeight: 700, color: "var(--primary)", textDecoration: "none" }}>
                          {bill.bill_number}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/${locale}/purchases/vendors/${bill.vendor_id}`} style={{ color: "var(--text-primary)", textDecoration: "none", fontWeight: 500 }}>
                          {bill.vendor_name_ar || "—"}
                        </Link>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{bill.vendor_invoice_number || "—"}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{bill.bill_date ? new Date(bill.bill_date).toLocaleDateString("en-SA") : "—"}</td>
                      <td style={{ fontSize: 12 }}>
                        {dueDate ? (
                          <span style={{ color: isOverdue ? "var(--danger)" : "var(--text-secondary)", fontWeight: isOverdue ? 700 : 400 }}>
                            {dueDate.toISOString().split("T")[0]}
                            {isOverdue && <span style={{ display: "block", fontSize: 10 }}>{ar ? `متأخر ${overdueDays} يوم` : `${overdueDays}d overdue`}</span>}
                          </span>
                        ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>
                        {fmt(bill.total)} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>SAR</span>
                      </td>
                      <td style={{ textAlign: "end", color: "var(--success)" }}>{fmt(bill.paid_amount)}</td>
                      <td>
                        {isOverdue
                          ? <span className="badge badge-danger">{ar ? "متأخرة" : "Overdue"}</span>
                          : <span className={`badge ${status.badge}`}>{status.ar}</span>
                        }
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Link href={`/${locale}/purchases/bills/${bill.id}`} className="btn btn-ghost btn-sm" title={ar ? "عرض" : "View"}>
                            <Icon name="view" size={14} />
                          </Link>
                          {bill.status === "draft" && (
                            <button className="btn btn-ghost btn-sm" style={{ color: "var(--success)" }}
                              onClick={() => handleConfirm(bill.id)} disabled={acting === bill.id} title={ar ? "تأكيد" : "Confirm"}>
                              <Icon name="check" size={14} />
                            </button>
                          )}
                          {["draft", "confirmed"].includes(bill.status) && (
                            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                              onClick={() => handleCancel(bill.id)} disabled={acting === bill.id} title={ar ? "إلغاء" : "Cancel"}>
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
