"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyInvoices } from "@/lib/reps";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const statusColor: Record<string, string> = {
  draft: "#94A3B8",
  confirmed: "#2563EB",
  paid: "#059669",
  partial: "#D97706",
  overdue: "#DC2626",
  cancelled: "#EF4444",
};

const statusLabel: Record<string, { ar: string; en: string }> = {
  draft: { ar: "مسودة", en: "Draft" },
  confirmed: { ar: "مؤكدة", en: "Confirmed" },
  paid: { ar: "مدفوعة", en: "Paid" },
  partial: { ar: "جزئي", en: "Partial" },
  overdue: { ar: "متأخرة", en: "Overdue" },
  cancelled: { ar: "ملغاة", en: "Cancelled" },
};

export default function RepInvoicesPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyInvoices()
      .then((res) => setInvoices(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "فواتيري" : "My Invoices"}</h1>
          <p className="page-subtitle">
            {ar ? "كل الفواتير التي أصدرتها" : "All invoices you have issued"}
          </p>
        </div>
        <Link href={`/${locale}/reps/invoices/new`} className="btn btn-primary">
          + {ar ? "فاتورة جديدة" : "New Invoice"}
        </Link>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {ar ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {ar ? "لا توجد فواتير بعد" : "No invoices yet"}
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم الفاتورة" : "Invoice #"}</th>
                  <th>{ar ? "العميل" : "Customer"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المدفوع" : "Paid"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#2563EB" }}>
                        {inv.invoice_number}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{inv.buyer_name_ar}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                      {new Date(inv.issue_date).toLocaleDateString("ar-SA")}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: (statusColor[inv.status] || "#94A3B8") + "20",
                          color: statusColor[inv.status] || "#94A3B8",
                          fontSize: 11,
                        }}
                      >
                        {ar
                          ? statusLabel[inv.status]?.ar || inv.status
                          : statusLabel[inv.status]?.en || inv.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "end", fontWeight: 700 }}>
                      {fmt(inv.total)} SAR
                    </td>
                    <td style={{ textAlign: "end", color: "#059669" }}>
                      {fmt(inv.paid_amount)} SAR
                    </td>
                    <td>
                      <Link
                        href={`/${locale}/sales/invoices/${inv.id}`}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 12 }}
                      >
                        {ar ? "عرض" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
