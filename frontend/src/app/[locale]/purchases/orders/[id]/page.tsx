"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPurchaseOrder, confirmPurchaseOrder, cancelPurchaseOrder, getVendor } from "@/lib/purchases";
import { getCompany } from "@/lib/settings";
import { Icon } from "@/components/ui/Icons";
import SellerBlock from "@/components/documents/SellerBlock";
import CustomerBlock from "@/components/documents/CustomerBlock";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const STATUS_MAP: Record<string, { ar: string; badge: string }> = {
  draft:              { ar: "مسودة",       badge: "badge-warning" },
  confirmed:          { ar: "مؤكد",        badge: "badge-info" },
  partially_received: { ar: "استلام جزئي", badge: "badge-warning" },
  received:           { ar: "مستلم",       badge: "badge-success" },
  billed:             { ar: "مفوتر",       badge: "badge-success" },
  cancelled:          { ar: "ملغي",        badge: "badge-danger" },
};

export default function PurchaseOrderDetailPage({ params: { locale, id } }: { params: { locale: string; id: string } }) {
  const ar = locale === "ar";
  const [order, setOrder] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = async () => {
    try {
      const [orderRes, compRes] = await Promise.all([getPurchaseOrder(id), getCompany()]);
      setOrder(orderRes.data);
      setCompany(compRes.data);
      if (orderRes.data?.vendor_id) {
        const vendorRes = await getVendor(orderRes.data.vendor_id);
        setVendor(vendorRes.data);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleConfirm = async () => {
    if (!confirm(ar ? "تأكيد أمر الشراء؟" : "Confirm this purchase order?")) return;
    setActing(true);
    try { await confirmPurchaseOrder(id); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(false); }
  };

  const handleCancel = async () => {
    if (!confirm(ar ? "إلغاء أمر الشراء؟" : "Cancel this purchase order?")) return;
    setActing(true);
    try { await cancelPurchaseOrder(id); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(false); }
  };

  if (loading) {
    return <div className="empty-state" style={{ minHeight: "60vh" }}><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;
  }

  if (!order) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-title">{ar ? "أمر الشراء غير موجود" : "Order not found"}</div>
        <Link href={`/${locale}/purchases/orders`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
          {ar ? "العودة لأوامر الشراء" : "Back to Orders"}
        </Link>
      </div>
    );
  }

  const status = STATUS_MAP[order.status] || { ar: order.status, badge: "badge-gray" };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/purchases/orders`}>{ar ? "أوامر الشراء" : "Purchase Orders"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{order.order_number}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <h1 className="page-title">{order.order_number}</h1>
            <span className={`badge ${status.badge}`}>{status.ar}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Icon name="print" size={14} /> {ar ? "طباعة" : "Print"}
          </button>
          {order.status === "draft" && (
            <button className="btn btn-primary btn-sm" onClick={handleConfirm} disabled={acting}>
              <Icon name="check" size={14} /> {ar ? "تأكيد" : "Confirm"}
            </button>
          )}
          {["confirmed", "received", "partially_received"].includes(order.status) && (
            <button
              className="btn btn-primary btn-sm"
              onClick={async () => {
                if (!confirm(ar ? "تحويل أمر الشراء لفاتورة واردة؟" : "Convert to purchase bill?")) return;
                setActing(true);
                try {
                  const { convertOrderToBill } = await import("@/lib/purchases");
                  const { data } = await convertOrderToBill(id);
                  window.location.href = `/${locale}/purchases/bills/${data.id}`;
                } catch (e: any) {
                  alert(e?.response?.data?.detail || "Error");
                  setActing(false);
                }
              }}
              disabled={acting}
            >
              <Icon name="invoice" size={14} /> {ar ? "تحويل لفاتورة" : "Create Bill"}
            </button>
          )}
          {["draft", "confirmed"].includes(order.status) && (
            <button className="btn btn-danger btn-sm" onClick={handleCancel} disabled={acting}>
              <Icon name="cancel" size={14} /> {ar ? "إلغاء" : "Cancel"}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        {/* Document Header */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border)", background: "#F8FAFC" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              {company?.logo_data && (
                <img src={company.logo_data} alt="Logo" style={{ height: 52, objectFit: "contain", borderRadius: 6 }} />
              )}
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)" }}>
                  {ar ? "أمر شراء" : "Purchase Order — أمر شراء"}
                </div>
                <span className={`badge ${status.badge}`} style={{ marginTop: 4 }}>{status.ar}</span>
              </div>
            </div>
            <div style={{ textAlign: "end" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{order.order_number}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {ar ? "تاريخ الأمر:" : "Order Date:"} {new Date(order.order_date).toLocaleDateString("en-SA")}
              </div>
              {order.expected_date && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {ar ? "تاريخ الاستلام المتوقع:" : "Expected Date:"} {new Date(order.expected_date).toLocaleDateString("en-SA")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Company & Vendor */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--border)" }}>
          <div style={{ padding: "18px 28px", borderInlineEnd: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.08em" }}>
              {ar ? "الشركة / Buyer" : "Buyer / الشركة"}
            </div>
            <SellerBlock company={company} ar={ar} />
          </div>
          <div style={{ padding: "18px 28px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.08em" }}>
              {ar ? "المورد / Vendor" : "Vendor / المورد"}
            </div>
            <CustomerBlock customer={vendor} ar={ar} />
          </div>
        </div>

        {/* Lines Table */}
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{ar ? "الوصف" : "Description"}</th>
                <th>{ar ? "الوحدة" : "Unit"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "سعر الوحدة" : "Unit Price"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الخصم" : "Disc."}</th>
                <th style={{ textAlign: "end" }}>{ar ? "ضريبة%" : "VAT%"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "قبل الضريبة" : "Subtotal"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الضريبة" : "VAT"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
              </tr>
            </thead>
            <tbody>
              {(order.lines || []).map((line: any, i: number) => (
                <tr key={i}>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{i + 1}</td>
                  <td><div style={{ fontWeight: 500 }}>{line.description_ar}</div></td>
                  <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{line.unit || "—"}</td>
                  <td style={{ textAlign: "end" }}>{fmt(line.quantity)}</td>
                  <td style={{ textAlign: "end" }}>{fmt(line.unit_price)}</td>
                  <td style={{ textAlign: "end", color: "var(--danger)" }}>
                    {Number(line.discount_pct) > 0 ? `${line.discount_pct}%` : "—"}
                  </td>
                  <td style={{ textAlign: "end" }}>{line.vat_rate ?? 15}%</td>
                  <td style={{ textAlign: "end" }}>{fmt(line.subtotal)}</td>
                  <td style={{ textAlign: "end", color: "#D97706" }}>{fmt(line.vat_amount)}</td>
                  <td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ padding: "20px 28px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 300, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{ar ? "المجموع قبل الضريبة" : "Subtotal (excl. VAT)"}</span>
              <span>{fmt(order.subtotal)} SAR</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#D97706", fontWeight: 600 }}>
              <span>{ar ? "ضريبة القيمة المضافة" : "VAT"}</span>
              <span>{fmt(order.vat_amount)} SAR</span>
            </div>
            <div style={{ height: 1, background: "var(--border)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800 }}>
              <span>{ar ? "الإجمالي شامل الضريبة" : "TOTAL (incl. VAT)"}</span>
              <span style={{ color: "var(--primary)" }}>{fmt(order.total)} SAR</span>
            </div>
          </div>
        </div>

        {order.delivery_address && (
          <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", background: "#F8FAFC" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {ar ? "عنوان التسليم" : "Delivery Address"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{order.delivery_address}</div>
          </div>
        )}
      </div>
    </>
  );
}
