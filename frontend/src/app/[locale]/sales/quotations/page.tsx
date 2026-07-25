"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getQuotations, convertToInvoice } from "@/lib/sales";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const STATUS_MAP: Record<string, { ar: string; badge: string }> = {
  draft:    { ar: "مسودة",   badge: "badge-warning" },
  sent:     { ar: "مرسلة",   badge: "badge-info" },
  accepted: { ar: "مقبولة",  badge: "badge-success" },
  rejected: { ar: "مرفوضة", badge: "badge-danger" },
  expired:  { ar: "منتهية",  badge: "badge-gray" },
};

export default function QuotationsPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data } = await getQuotations();
      setQuotations(data);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleConvert = async (id: string, quotationNumber: string) => {
    if (!confirm(ar ? `تحويل عرض السعر ${quotationNumber} إلى فاتورة؟` : `Convert quotation ${quotationNumber} to invoice?`)) return;
    setConverting(id);
    try {
      await convertToInvoice(id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Error");
    } finally { setConverting(null); }
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
            <span>{ar ? "عروض الأسعار" : "Quotations"}</span>
          </div>
          <h1 className="page-title">{ar ? "عروض الأسعار" : "Quotations"}</h1>
          <p className="page-subtitle">{ar ? "إدارة عروض الأسعار وتحويلها لفواتير" : "Manage quotations and convert to invoices"}</p>
        </div>
        <Link href={`/${locale}/sales/quotations/new`} className="btn btn-primary">
          <Icon name="plus" size={16} />
          {ar ? "+ عرض سعر جديد" : "+ New Quotation"}
        </Link>
      </div>

      {/* Summary */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {Object.entries(STATUS_MAP).map(([key, val]) => {
          const count = quotations.filter(q => q.status === key).length;
          return (
            <div key={key} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{val.ar}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{count}</div>
              <div style={{ marginTop: 6 }}><span className={`badge ${val.badge}`}>{val.ar}</span></div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state">
              <div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
            </div>
          ) : quotations.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}>
                <Icon name="receipt" size={24} />
              </div>
              <div className="empty-state-title">{ar ? "لا توجد عروض أسعار" : "No quotations found"}</div>
              <div className="empty-state-desc">
                <Link href={`/${locale}/sales/quotations/new`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                  {ar ? "إنشاء عرض سعر جديد" : "Create New Quotation"}
                </Link>
              </div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم العرض" : "Quotation #"}</th>
                  <th>{ar ? "العميل" : "Customer"}</th>
                  <th>{ar ? "الموضوع" : "Subject"}</th>
                  <th>{ar ? "تاريخ الإصدار" : "Issue Date"}</th>
                  <th>{ar ? "تاريخ الانتهاء" : "Expiry Date"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map(q => {
                  const status = STATUS_MAP[q.status] || { ar: q.status, badge: "badge-gray" };
                  const isExpired = q.expiry_date && new Date(q.expiry_date) < new Date();
                  return (
                    <tr key={q.id}>
                      <td>
                        <span style={{ fontWeight: 700, color: "var(--primary)" }}>{q.quotation_number}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{q.customer?.name_ar || q.buyer_name_ar || "—"}</div>
                        {q.customer?.name_en && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{q.customer.name_en}</div>}
                      </td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{q.subject || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{q.issue_date}</td>
                      <td style={{ fontSize: 12, color: isExpired ? "var(--danger)" : "var(--text-secondary)" }}>
                        {q.expiry_date || "—"}
                        {isExpired && <span className="badge badge-danger" style={{ marginInlineStart: 6, fontSize: 10 }}>{ar ? "منتهية" : "Expired"}</span>}
                      </td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>
                        {fmt(q.total)} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>SAR</span>
                      </td>
                      <td><span className={`badge ${status.badge}`}>{status.ar}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Link href={`/${locale}/sales/quotations/${q.id}`} className="btn btn-ghost btn-sm" title={ar ? "عرض" : "View"}>
                            <Icon name="view" size={14} />
                          </Link>
                          {(q.status === "draft" || q.status === "sent" || q.status === "accepted") && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: "var(--primary)", fontSize: 11, gap: 4, padding: "5px 8px" }}
                              onClick={() => handleConvert(q.id, q.quotation_number)}
                              disabled={converting === q.id}
                              title={ar ? "تحويل لفاتورة" : "Convert to Invoice"}
                            >
                              <Icon name="invoice" size={14} />
                              <span style={{ fontSize: 11 }}>{ar ? "تحويل لفاتورة" : "Convert"}</span>
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
