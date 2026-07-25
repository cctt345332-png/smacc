"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getOrders, confirmOrder, cancelOrder, orderToInvoice } from "@/lib/orders";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const STATUS_MAP: Record<string, { ar: string; badge: string }> = {
  draft:                { ar: "مسودة",          badge: "badge-warning" },
  confirmed:            { ar: "مؤكد",           badge: "badge-info" },
  partially_delivered:  { ar: "تسليم جزئي",     badge: "badge-warning" },
  delivered:            { ar: "مسلّم",           badge: "badge-success" },
  invoiced:             { ar: "تم الفوترة",      badge: "badge-success" },
  cancelled:            { ar: "ملغي",            badge: "badge-danger" },
};

export default function SalesOrdersPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    try { const { data } = await getOrders(filterStatus || undefined); setOrders(data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const handle = async (fn: () => Promise<any>, msg: string) => {
    if (!confirm(msg)) return;
    try { await fn(); load(); } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
  };

  const stats = Object.entries(STATUS_MAP).map(([k, v]) => ({ ...v, count: orders.filter(o => o.status === k).length }));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/sales`}>{ar ? "المبيعات" : "Sales"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "أوامر البيع" : "Sales Orders"}</span>
          </div>
          <h1 className="page-title">{ar ? "أوامر البيع" : "Sales Orders"}</h1>
          <p className="page-subtitle">{ar ? "إدارة أوامر البيع وتحويلها لفواتير" : "Manage sales orders and convert to invoices"}</p>
        </div>
        <Link href={`/${locale}/sales/orders/new`} className="btn btn-primary btn-sm">
          <Icon name="plus" size={14} /> {ar ? "أمر بيع جديد" : "New Order"}
        </Link>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {stats.map(s => (
          <div key={s.ar} className="card" style={{ padding: "12px 16px", minWidth: 120, cursor: "pointer" }}
            onClick={() => setFilterStatus(filterStatus === s.ar ? "" : "")}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{s.ar}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{s.count}</div>
            <span className={`badge ${s.badge}`} style={{ marginTop: 4 }}>{s.ar}</span>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
          <select className="form-input form-select" style={{ width: 200 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">{ar ? "كل الحالات" : "All Status"}</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.ar}</option>)}
          </select>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {orders.length} {ar ? "أمر" : "orders"}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}>
                <Icon name="receipt" size={24} />
              </div>
              <div className="empty-state-title">{ar ? "لا توجد أوامر بيع" : "No sales orders"}</div>
              <Link href={`/${locale}/sales/orders/new`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                {ar ? "إنشاء أمر بيع" : "Create Order"}
              </Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم الأمر" : "Order #"}</th>
                  <th>{ar ? "العميل" : "Customer"}</th>
                  <th>{ar ? "تاريخ الأمر" : "Order Date"}</th>
                  <th>{ar ? "تاريخ التسليم" : "Delivery Date"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const s = STATUS_MAP[o.status] || { ar: o.status, badge: "badge-gray" };
                  return (
                    <tr key={o.id}>
                      <td><Link href={`/${locale}/sales/orders/${o.id}`} style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}>{o.order_number}</Link></td>
                      <td>{o.customer?.name_ar || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(o.order_date).toLocaleDateString("en-SA")}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{o.delivery_date ? new Date(o.delivery_date).toLocaleDateString("en-SA") : "—"}</td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(o.total)} SAR</td>
                      <td><span className={`badge ${s.badge}`}>{s.ar}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Link href={`/${locale}/sales/orders/${o.id}`} className="btn btn-ghost btn-sm btn-icon"><Icon name="view" size={14} /></Link>
                          {o.status === "draft" && (
                            <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "var(--success)" }}
                              onClick={() => handle(() => confirmOrder(o.id), ar ? "تأكيد الأمر؟" : "Confirm order?")} disabled={acting === o.id}>
                              <Icon name="check" size={14} />
                            </button>
                          )}
                          {o.status === "confirmed" && (
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "var(--primary)" }}
                              onClick={() => handle(() => orderToInvoice(o.id), ar ? "تحويل لفاتورة؟" : "Convert to invoice?")} disabled={acting === o.id}>
                              <Icon name="invoice" size={14} />
                            </button>
                          )}
                          {["draft", "confirmed"].includes(o.status) && (
                            <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "var(--danger)" }}
                              onClick={() => handle(() => cancelOrder(o.id), ar ? "إلغاء الأمر؟" : "Cancel order?")} disabled={acting === o.id}>
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
