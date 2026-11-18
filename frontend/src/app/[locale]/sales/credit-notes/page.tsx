"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { getInvoices } from "@/lib/sales";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function CreditNotesPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [items, setItems] = useState<any[]>([]);
  const [invoiceMap, setInvoiceMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    // لا نربط ظهور المرتجعات بنجاح طلب الفواتير؛ المرتجع المحفوظ يجب أن يظهر
    // حتى لو تعذر جلب بيانات الفاتورة الأصلية مؤقتًا.
    try {
      const cnRes = await api.get("/sales/credit-notes");
      setItems(cnRes.data || []);
    } catch { setItems([]); }
    try {
      const invRes = await getInvoices();
      const map: Record<string, string> = {};
      (invRes.data || []).forEach((inv: any) => { map[inv.id] = inv.invoice_number; });
      setInvoiceMap(map);
    } catch { setInvoiceMap({}); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const deleteDraft = async (id: string) => {
    if (!window.confirm(ar ? "هل تريد حذف مسودة المرتجع؟" : "Delete this return draft?")) return;
    try {
      await api.delete(`/sales/credit-notes/${id}`);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || (ar ? "تعذر حذف المرتجع" : "Could not delete return"));
    }
  };

  const cancelPosted = async (id: string, number: string) => {
    if (!window.confirm(ar
      ? `سيتم إلغاء المرتجع ${number} وعكس أثره المالي والمخزني. هل أنت متأكد؟`
      : `Cancel return ${number} and reverse its financial and inventory effects?`)) return;
    try {
      await api.post(`/sales/credit-notes/${id}/cancel`);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || (ar ? "تعذر إلغاء المرتجع" : "Could not cancel return"));
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/sales`}>{ar ? "المبيعات" : "Sales"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "مرتجعات المبيعات" : "Sales Returns"}</span>
          </div>
          <h1 className="page-title">{ar ? "مرتجعات المبيعات" : "Sales Returns"}</h1>
          <p className="page-subtitle">{ar ? "إدارة مرتجعات المبيعات" : "Sales returns management"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
        <button onClick={load} className="btn btn-secondary btn-sm" disabled={loading}>{ar ? "تحديث" : "Refresh"}</button>
        <Link href={`/${locale}/sales/credit-notes/new`} className="btn btn-primary btn-sm">
          <Icon name="plus" size={14} /> {ar ? "+ مرتجع جديد" : "+ New Return"}
        </Link>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}>
                <Icon name="reverse" size={24} />
              </div>
              <div className="empty-state-title">{ar ? "لا توجد مرتجعات مبيعات" : "No sales returns"}</div>
              <Link href={`/${locale}/sales/credit-notes/new`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                {ar ? "إنشاء مرتجع جديد" : "Create New Return"}
              </Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم الإشعار" : "CN #"}</th>
                  <th>{ar ? "الفاتورة الأصلية" : "Original Invoice"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "السبب" : "Reason"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((cn: any) => (
                  <tr key={cn.id}>
                    <td>
                      <Link href={`/${locale}/sales/credit-notes/${cn.id}`} style={{ fontWeight: 700, color: "#DC2626", textDecoration: "none" }}>
                        {cn.credit_note_number}
                      </Link>
                    </td>
                    <td>
                      {/* رقم الفاتورة الأصلية بدل UUID */}
                      {invoiceMap[cn.original_invoice_id] ? (
                        <Link href={`/${locale}/sales/invoices/${cn.original_invoice_id}`} style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none", fontSize: 13 }}>
                          {invoiceMap[cn.original_invoice_id]}
                        </Link>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(cn.issue_date).toLocaleDateString("en-SA")}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{cn.reason}</td>
                    <td><span className="badge" style={{ color: cn.status === "draft" ? "#92400E" : cn.status === "cancelled" ? "#991B1B" : "#166534" }}>{cn.status === "draft" ? (ar ? "مسودة" : "Draft") : cn.status === "cancelled" ? (ar ? "ملغى" : "Cancelled") : (ar ? "مرحل" : "Posted")}</span></td>
                    <td style={{ textAlign: "end", fontWeight: 700, color: "#DC2626" }}>{fmt(cn.total)} SAR</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Link href={`/${locale}/sales/credit-notes/${cn.id}`} className="btn btn-ghost btn-sm btn-icon" title={ar ? "عرض" : "View"}>
                          <Icon name="view" size={14} />
                        </Link>
                        <Link href={`/${locale}/sales/credit-notes/new?edit=${cn.id}`} className="btn btn-ghost btn-sm btn-icon" title={ar ? "تعديل" : "Edit"}>
                          <Icon name="edit" size={14} />
                        </Link>
                        <button className="btn btn-ghost btn-sm btn-icon" title={ar ? "طباعة" : "Print"}
                          onClick={() => window.open(`/${locale}/sales/credit-notes/${cn.id}`, "_blank")}>
                          <Icon name="print" size={14} />
                        </button>
                        {cn.status !== "draft" && cn.status !== "cancelled" && <button className="btn btn-ghost btn-sm btn-icon" title={ar ? "إلغاء المرتجع وعكس أثره" : "Cancel and reverse return"} onClick={() => cancelPosted(cn.id, cn.credit_note_number)} style={{ color: "var(--danger)" }}>
                          <Icon name="close" size={14} />
                        </button>}
                        {cn.status === "draft" && <button className="btn btn-ghost btn-sm btn-icon" title={ar ? "حذف المسودة" : "Delete draft"} onClick={() => deleteDraft(cn.id)} style={{ color: "var(--danger)" }}>
                          <Icon name="trash" size={14} />
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
