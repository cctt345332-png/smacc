"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getCustomer, getInvoices, getCustomerStatement } from "@/lib/sales";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const STATUS_MAP: Record<string, { ar: string; badge: string }> = {
  draft: { ar: "مسودة", badge: "badge-warning" },
  confirmed: { ar: "مؤكدة", badge: "badge-info" },
  paid: { ar: "مدفوعة", badge: "badge-success" },
  cancelled: { ar: "ملغاة", badge: "badge-danger" },
  partial: { ar: "جزئية", badge: "badge-warning" },
};

const TYPE_MAP: Record<string, { ar: string; badge: string }> = {
  company: { ar: "شركة", badge: "badge-info" },
  individual: { ar: "فرد", badge: "badge-gray" },
  government: { ar: "حكومي", badge: "badge-warning" },
};

export default function CustomerDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const ar = locale === "ar";
  const [customer, setCustomer] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [statement, setStatement] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    Promise.all([
      getCustomer(id),
      getInvoices({ customer_id: id }),
      getCustomerStatement(id, "2000-01-01T00:00:00", today.toISOString()),
    ])
      .then(([c, inv, statementResponse]) => {
        setCustomer(c.data);
        setInvoices(inv.data);
        setStatement(statementResponse.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;
  if (!customer) return <div className="empty-state"><div className="empty-state-title">{ar ? "العميل غير موجود" : "Customer not found"}</div></div>;

  const totalInvoiced = statement?.summary ? Number(statement.summary.total_invoiced || 0) : invoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const totalPaid = statement?.summary ? Number(statement.summary.total_paid || 0) : invoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const openingBalance = Number(statement?.summary?.opening_balance || 0);
  const outstanding = statement?.summary
    ? Number(statement.summary.operational_outstanding ?? (Number(statement.summary.total_invoiced || 0) - Number(statement.summary.total_paid || 0)))
    : totalInvoiced - totalPaid;
  const typeInfo = TYPE_MAP[customer.customer_type] || { ar: customer.customer_type, badge: "badge-gray" };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/sales/customers`}>{ar ? "العملاء" : "Customers"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{customer.name_ar}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            <h1 className="page-title">{customer.name_ar}</h1>
            <span className={`badge ${typeInfo.badge}`}>{typeInfo.ar}</span>
          </div>
          {customer.name_en && <p className="page-subtitle">{customer.name_en}</p>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/reports/sales/statement?customer_id=${id}`} className="btn btn-secondary btn-sm">
            <Icon name="ledger" size={14} /> {ar ? "كشف الحساب" : "Statement"}
          </Link>
          <Link href={`/${locale}/sales/invoices/new`} className="btn btn-primary btn-sm">
            <Icon name="plus" size={14} /> {ar ? "فاتورة جديدة" : "New Invoice"}
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          { label: ar ? "إجمالي الفواتير" : "Total Invoiced", value: `${fmt(totalInvoiced)} SAR`, color: "#5A187E", icon: <Icon name="invoice" size={20} /> },
          { label: ar ? "المحصّل" : "Total Paid", value: `${fmt(totalPaid)} SAR`, color: "#6F4A84", icon: <Icon name="wallet" size={20} /> },
          { label: ar ? "المستحق" : "Outstanding", value: `${fmt(outstanding)} SAR`, color: outstanding > 0 ? "#DC2626" : "#6F4A84", icon: <Icon name="money" size={20} /> },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + "18", color: s.color }}>{s.icon}</div>
            <div className="stat-content">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: 18, color: s.color }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Customer Info */}
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "بيانات العميل" : "Customer Info"}</span></div>
          <div className="card-body">
            {[
              { label: ar ? "رقم العميل" : "Customer #", value: customer.customer_number },
              { label: ar ? "الرقم الضريبي" : "VAT Number", value: customer.vat_number || "—" },
              { label: ar ? "السجل التجاري" : "CR Number", value: customer.cr_number || "—" },
              { label: ar ? "الهاتف" : "Phone", value: customer.phone || "—" },
              { label: ar ? "البريد الإلكتروني" : "Email", value: customer.email || "—" },
              { label: ar ? "المدينة" : "City", value: customer.address_city || "—" },
              { label: ar ? "الحي" : "District", value: customer.address_district || "—" },
              { label: ar ? "شروط الدفع" : "Payment Terms", value: `${customer.payment_terms_days} ${ar ? "يوم" : "days"}` },
              { label: ar ? "حد الائتمان" : "Credit Limit", value: `${fmt(customer.credit_limit)} SAR` },
              { label: ar ? "الرصيد الافتتاحي" : "Opening Balance", value: `${fmt(openingBalance)} SAR` },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
                <span style={{ fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "إجراءات سريعة" : "Quick Actions"}</span></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href={`/${locale}/sales/invoices/new`} className="btn btn-secondary" style={{ justifyContent: "flex-start", gap: 10 }}>
              <Icon name="invoice" size={16} /> {ar ? "إنشاء فاتورة جديدة" : "Create New Invoice"}
            </Link>
            <Link href={`/${locale}/sales/quotations/new`} className="btn btn-secondary" style={{ justifyContent: "flex-start", gap: 10 }}>
              <Icon name="receipt" size={16} /> {ar ? "إنشاء عرض سعر" : "Create Quotation"}
            </Link>
            <Link href={`/${locale}/sales/credit-notes/new`} className="btn btn-secondary" style={{ justifyContent: "flex-start", gap: 10 }}>
              <Icon name="reverse" size={16} /> {ar ? "مرتجع مبيعات" : "Sales Return"}
            </Link>
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "فواتير العميل" : "Customer Invoices"}</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{invoices.length} {ar ? "فاتورة" : "invoices"}</span>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {invoices.length === 0 ? (
            <div className="empty-state" style={{ padding: "32px 20px" }}>
              <div className="empty-state-title">{ar ? "لا توجد فواتير" : "No invoices"}</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم الفاتورة" : "Invoice #"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المدفوع" : "Paid"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المتبقي" : "Balance"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const s = STATUS_MAP[inv.status] || { ar: inv.status, badge: "badge-gray" };
                  const bal = Number(inv.total) - Number(inv.paid_amount);
                  return (
                    <tr key={inv.id}>
                      <td><Link href={`/${locale}/sales/invoices/${inv.id}`} style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}>{inv.invoice_number}</Link></td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(inv.issue_date).toLocaleDateString("en-SA")}</td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(inv.total)}</td>
                      <td style={{ textAlign: "end", color: "#6F4A84" }}>{fmt(inv.paid_amount)}</td>
                      <td style={{ textAlign: "end", fontWeight: 700, color: bal > 0.01 ? "#DC2626" : "#6F4A84" }}>{fmt(bal)}</td>
                      <td><span className={`badge ${s.badge}`}>{s.ar}</span></td>
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
