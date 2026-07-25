"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getRep, getRepSummary, getRepStock, getRepInvoices, getRepTransfers, updateRep } from "@/lib/reps";
import api from "@/lib/api";

const fmt  = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtD = (d: any) => d ? new Date(d).toLocaleDateString("en-US") : "—";

const STATUS: Record<string, { ar: string; color: string; bg: string }> = {
  draft:     { ar: "مسودة",        color: "#6B7280", bg: "#F3F4F6" },
  submitted: { ar: "بانتظار المراجعة", color: "#D97706", bg: "#FFFBEB" },
  approved:  { ar: "موافق عليها",  color: "#2563EB", bg: "#EFF6FF" },
  rejected:  { ar: "مرفوضة",       color: "#DC2626", bg: "#FEF2F2" },
  confirmed: { ar: "مؤكدة",        color: "#059669", bg: "#F0FDF4" },
  paid:      { ar: "مدفوعة",       color: "#059669", bg: "#F0FDF4" },
  partial:   { ar: "جزئي",         color: "#D97706", bg: "#FFFBEB" },
  unpaid:    { ar: "غير مدفوعة",   color: "#DC2626", bg: "#FEF2F2" },
  cancelled: { ar: "ملغاة",        color: "#6B7280", bg: "#F3F4F6" },
};

const PAY_METHOD: Record<string, string> = {
  cash: "نقد", credit: "آجل", cheque: "شيك", transfer: "تحويل",
};

export default function RepDetailPage({ params: { locale, rep_id } }: { params: { locale: string; rep_id: string } }) {
  const ar = locale === "ar";
  const [rep, setRep] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [stock, setStock] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [tab, setTab] = useState<"info" | "stock" | "invoices" | "review" | "transfers">("info");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<any>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [repRes, sumRes, stockRes, invRes, trRes] = await Promise.all([
        getRep(rep_id), getRepSummary(rep_id), getRepStock(rep_id),
        getRepInvoices(rep_id), getRepTransfers(rep_id),
      ]);
      setRep(repRes.data); setSummary(sumRes.data);
      setStock(Array.isArray(stockRes.data) ? stockRes.data : []);
      setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
      setTransfers(Array.isArray(trRes.data) ? trRes.data : []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [rep_id]);

  const doApprove = async (invId: string) => {
    setActionLoading(invId);
    try {
      await api.post(`/sales/invoices/${invId}/approve`);
      setMsg({ type: "ok", text: "تمت الموافقة على الفاتورة" });
      load();
    } catch (e: any) { setMsg({ type: "err", text: e.response?.data?.detail || "خطأ" }); }
    finally { setActionLoading(null); }
  };

  const doReject = async () => {
    if (!rejectModal || !rejectNote.trim()) return;
    setActionLoading(rejectModal.id);
    try {
      await api.post(`/sales/invoices/${rejectModal.id}/reject`, { rejection_note: rejectNote });
      setMsg({ type: "ok", text: "تم رفض الفاتورة" });
      setRejectModal(null); setRejectNote("");
      load();
    } catch (e: any) { setMsg({ type: "err", text: e.response?.data?.detail || "خطأ" }); }
    finally { setActionLoading(null); }
  };

  const doConfirm = async (invId: string) => {
    setActionLoading(invId);
    try {
      await api.post(`/sales/invoices/${invId}/confirm`);
      setMsg({ type: "ok", text: "تم تأكيد الفاتورة وخصم المخزون" });
      load();
    } catch (e: any) { setMsg({ type: "err", text: e.response?.data?.detail || "خطأ" }); }
    finally { setActionLoading(null); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>;
  if (!rep) return <div style={{ padding: 40, textAlign: "center", color: "#DC2626" }}>{ar ? "المندوب غير موجود" : "Rep not found"}</div>;

  const submittedInvoices = invoices.filter(i => i.status === "submitted");
  const pct = rep.target_monthly > 0
    ? Math.min(100, Math.round((Number(summary?.total_sales || 0) / Number(rep.target_monthly)) * 100))
    : null;

  const TABS = [
    { key: "info",      label: ar ? "الملف الشخصي" : "Profile" },
    { key: "invoices",  label: ar ? "الفواتير" : "Invoices", count: invoices.length },
    { key: "review",    label: ar ? "للمراجعة" : "Review", count: submittedInvoices.length, alert: submittedInvoices.length > 0 },
    { key: "stock",     label: ar ? "المخزون" : "Stock", count: stock.length },
    { key: "transfers", label: ar ? "المناقلات" : "Transfers", count: transfers.length },
  ] as const;

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reps/manage`}>{ar ? "المناديب" : "Sales Reps"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{rep.full_name}</span>
          </div>
          <h1 className="page-title">{rep.full_name}</h1>
          <p className="page-subtitle">
            {rep.rep_code}
            {rep.zone ? ` · ${rep.zone}` : ""}
            {rep.vehicle_plate ? ` · ${rep.vehicle_plate}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {submittedInvoices.length > 0 && (
            <span style={{ background: "#FEF3C7", color: "#D97706", border: "1px solid #FCD34D", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
              {submittedInvoices.length} {ar ? "فاتورة تنتظر المراجعة" : "pending review"}
            </span>
          )}
          <span className={`badge ${rep.is_active ? "badge-success" : "badge-danger"}`} style={{ fontSize: 13, padding: "6px 14px" }}>
            {rep.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
          </span>
        </div>
      </div>

      {/* رسائل */}
      {msg && (
        <div style={{ background: msg.type === "ok" ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${msg.type === "ok" ? "#BBF7D0" : "#FECACA"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: msg.type === "ok" ? "#059669" : "#DC2626", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 16 }}>x</button>
        </div>
      )}

      {/* بطاقات الإحصائيات */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: ar ? "إجمالي المبيعات" : "Total Sales", value: fmt(summary.total_sales) + " SAR", color: "#2563EB" },
            { label: ar ? "عدد الفواتير" : "Invoices", value: summary.invoice_count, color: "#7C3AED" },
            { label: ar ? "المحصّل" : "Collected", value: fmt(summary.total_collected) + " SAR", color: "#059669" },
            { label: ar ? "المستحق" : "Outstanding", value: fmt(summary.outstanding) + " SAR", color: Number(summary.outstanding) > 0 ? "#DC2626" : "#059669" },
            { label: ar ? "المخزون" : "Stock Qty", value: Number(summary.stock_qty || 0).toLocaleString("en-US"), color: "#D97706" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* شريط التبويبات */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ padding: "8px 16px", border: "none", borderBottom: tab === t.key ? "2px solid var(--primary)" : "2px solid transparent", background: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 700 : 400, color: tab === t.key ? "var(--primary)" : "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
            {t.label}
            {"count" in t && t.count! > 0 && (
              <span style={{ background: "alert" in t && t.alert ? "#FEF3C7" : "var(--secondary)", color: "alert" in t && t.alert ? "#D97706" : "var(--text-secondary)", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* تبويب: الملف الشخصي */}
      {tab === "info" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* بيانات أساسية */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>{ar ? "البيانات الأساسية" : "Basic Info"}</div>
            {[
              { label: ar ? "البريد الإلكتروني" : "Email", value: rep.email },
              { label: ar ? "الجوال" : "Phone", value: rep.phone || "—" },
              { label: ar ? "المنطقة / المسار" : "Zone / Route", value: rep.zone || "—" },
              { label: ar ? "المستودع" : "Warehouse", value: rep.warehouse_name },
              { label: ar ? "تاريخ الإنشاء" : "Created", value: fmtD(rep.created_at) },
            ].map(f => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{f.value}</span>
                <span style={{ color: "var(--text-secondary)" }}>{f.label}</span>
              </div>
            ))}
          </div>

          {/* بيانات الهوية والسيارة */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>{ar ? "الهوية" : "Identity"}</div>
              {[
                { label: ar ? "رقم الهوية" : "ID Number", value: rep.id_number || "—" },
                { label: ar ? "انتهاء الهوية" : "ID Expiry", value: fmtD(rep.id_expiry) },
                { label: ar ? "انتهاء الرخصة" : "License Expiry", value: fmtD(rep.license_expiry) },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{f.value}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{f.label}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>{ar ? "السيارة" : "Vehicle"}</div>
              {[
                { label: ar ? "لوحة السيارة" : "Plate", value: rep.vehicle_plate || "—" },
                { label: ar ? "النوع" : "Type", value: rep.vehicle_type || "—" },
                { label: ar ? "اللون" : "Color", value: rep.vehicle_color || "—" },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span style={{ fontWeight: 600, fontFamily: f.label.includes("لوحة") || f.label === "Plate" ? "monospace" : undefined }}>{f.value}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* الأهداف */}
          <div className="card" style={{ padding: 20, gridColumn: "1 / -1" }}>
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>{ar ? "الأهداف والعمولة" : "Targets & Commission"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{ar ? "الهدف الشهري" : "Monthly Target"}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#2563EB" }}>{rep.target_monthly > 0 ? fmt(rep.target_monthly) + " SAR" : "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{ar ? "نسبة التحقق" : "Achievement"}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: pct !== null ? (pct >= 100 ? "#059669" : pct >= 70 ? "#D97706" : "#2563EB") : "var(--text-muted)" }}>
                  {pct !== null ? `${pct}%` : "—"}
                </div>
                {pct !== null && (
                  <div style={{ marginTop: 6, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "#059669" : pct >= 70 ? "#D97706" : "#2563EB", borderRadius: 3, transition: "width 0.3s" }} />
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{ar ? "نسبة العمولة" : "Commission %"}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#7C3AED" }}>{rep.commission_pct > 0 ? `${rep.commission_pct}%` : "—"}</div>
                {rep.commission_pct > 0 && summary && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                    {ar ? "المستحق:" : "Due:"} {fmt(Number(summary.total_sales || 0) * Number(rep.commission_pct) / 100)} SAR
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* تبويب: للمراجعة */}
      {tab === "review" && (
        <div>
          {submittedInvoices.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</div>
              <div className="empty-state-title">{ar ? "لا توجد فواتير بانتظار المراجعة" : "No invoices pending review"}</div>
            </div>
          ) : (
            <div className="card">
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "رقم الفاتورة" : "Invoice"}</th>
                      <th>{ar ? "العميل" : "Customer"}</th>
                      <th>{ar ? "طريقة الدفع" : "Payment"}</th>
                      <th>{ar ? "تاريخ التقديم" : "Submitted"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                      <th>{ar ? "الإجراء" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submittedInvoices.map((inv: any) => (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 600, color: "var(--primary)", fontFamily: "monospace" }}>{inv.invoice_number}</td>
                        <td>{inv.buyer_name_ar}</td>
                        <td>
                          <span style={{ background: "#F3F4F6", padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>
                            {PAY_METHOD[inv.invoice_payment_method] || "—"}
                          </span>
                          {inv.invoice_payment_method === "credit" && inv.credit_days && (
                            <span style={{ fontSize: 11, color: "var(--text-muted)", marginInlineStart: 4 }}>{inv.credit_days} {ar ? "يوم" : "days"}</span>
                          )}
                          {inv.invoice_payment_method === "cheque" && inv.cheque_number && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{inv.cheque_number}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtD(inv.submitted_at)}</td>
                        <td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(inv.total)} SAR</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-primary btn-sm" disabled={actionLoading === inv.id} onClick={() => doApprove(inv.id)}>
                              {actionLoading === inv.id ? "..." : (ar ? "موافقة" : "Approve")}
                            </button>
                            <button className="btn btn-secondary btn-sm" style={{ color: "#DC2626" }} disabled={actionLoading === inv.id}
                              onClick={() => { setRejectModal(inv); setRejectNote(""); }}>
                              {ar ? "رفض" : "Reject"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* تبويب: الفواتير */}
      {tab === "invoices" && (
        <div className="card">
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            {invoices.length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد فواتير" : "No invoices"}</div></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{ar ? "رقم الفاتورة" : "Invoice"}</th>
                    <th>{ar ? "العميل" : "Customer"}</th>
                    <th>{ar ? "الحالة" : "Status"}</th>
                    <th>{ar ? "طريقة الدفع" : "Payment"}</th>
                    <th>{ar ? "التاريخ" : "Date"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "المتبقي" : "Remaining"}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => {
                    const st = STATUS[inv.status] || STATUS.draft;
                    const remaining = Number(inv.total || 0) - Number(inv.paid_amount || 0);
                    return (
                      <tr key={inv.id}>
                        <td style={{ fontWeight: 600, color: "var(--primary)", fontFamily: "monospace" }}>{inv.invoice_number}</td>
                        <td>{inv.buyer_name_ar}</td>
                        <td>
                          <span style={{ background: st.bg, color: st.color, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{st.ar}</span>
                          {inv.status === "rejected" && inv.rejection_note && (
                            <div style={{ fontSize: 11, color: "#DC2626", marginTop: 2 }} title={inv.rejection_note}>
                              {inv.rejection_note.substring(0, 40)}{inv.rejection_note.length > 40 ? "..." : ""}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 12 }}>{PAY_METHOD[inv.invoice_payment_method] || "—"}</td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtD(inv.issue_date)}</td>
                        <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(inv.total)} SAR</td>
                        <td style={{ textAlign: "end", color: remaining > 0 ? "#DC2626" : "#059669", fontWeight: 600 }}>
                          {remaining > 0.01 ? fmt(remaining) : "0.00"} SAR
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* تبويب: المخزون */}
      {tab === "stock" && (
        <div className="card">
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            {stock.length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">{ar ? "لا يوجد مخزون" : "No stock"}</div></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{ar ? "الصنف" : "Item"}</th>
                    <th>{ar ? "SKU" : "SKU"}</th>
                    <th>{ar ? "النوع" : "Type"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "المتاح" : "Available"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "سعر البيع" : "Sale Price"}</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((s: any) => (
                    <tr key={s.stock_id || s.item_id} style={s.is_low_stock ? { background: "#FFFBEB" } : {}}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.item_name}</div>
                        {s.category_name && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.category_name}</div>}
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{s.item_sku || "—"}</td>
                      <td><span style={{ background: "#F3F4F6", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>{s.item_tracking}</span></td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>{s.quantity}</td>
                      <td style={{ textAlign: "end", fontWeight: 700, color: s.available_qty <= 0 ? "#DC2626" : s.is_low_stock ? "#D97706" : "#059669" }}>
                        {s.available_qty}
                        {s.is_low_stock && <span style={{ fontSize: 10, marginInlineStart: 4, color: "#D97706" }}>منخفض</span>}
                      </td>
                      <td style={{ textAlign: "end" }}>{fmt(s.sale_price)} SAR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* تبويب: المناقلات */}
      {tab === "transfers" && (
        <div className="card">
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            {transfers.length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد مناقلات" : "No transfers"}</div></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{ar ? "التاريخ" : "Date"}</th>
                    <th>{ar ? "الاتجاه" : "Direction"}</th>
                    <th>{ar ? "المنتج" : "Product"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                    <th>{ar ? "المستودع" : "Warehouse"}</th>
                    <th>{ar ? "ملاحظات" : "Notes"}</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.date}</td>
                      <td>
                        <span style={{ background: t.direction === "in" ? "#F0FDF4" : "#FEF2F2", color: t.direction === "in" ? "#059669" : "#DC2626", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          {t.direction === "in" ? (ar ? "وارد" : "In") : (ar ? "صادر" : "Out")}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{t.product_name}</td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>{t.quantity}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t.direction === "in" ? t.from_warehouse : t.to_warehouse}</td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal الرفض */}
      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 460, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{ar ? "رفض الفاتورة" : "Reject Invoice"}</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              {ar ? "الفاتورة" : "Invoice"} <strong>{rejectModal.invoice_number}</strong> — {rejectModal.buyer_name_ar}
            </p>
            <div className="form-group">
              <label className="form-label">{ar ? "سبب الرفض" : "Rejection Reason"} <span className="required">*</span></label>
              <textarea className="form-input" rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                placeholder={ar ? "أدخل سبب الرفض بوضوح..." : "Enter rejection reason clearly..."} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setRejectModal(null)}>{ar ? "إلغاء" : "Cancel"}</button>
              <button className="btn btn-danger" onClick={doReject} disabled={!rejectNote.trim() || actionLoading === rejectModal.id}
                style={{ background: "#DC2626", color: "white" }}>
                {actionLoading === rejectModal.id ? "..." : (ar ? "تأكيد الرفض" : "Confirm Reject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
