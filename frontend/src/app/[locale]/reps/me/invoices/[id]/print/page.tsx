"use client";
/**
 * صفحة طباعة الفاتورة للمندوب — نفس الفاتورة الأصلية كاملة
 * تُفتح في tab جديد وتطبع تلقائياً
 */
import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

function QRCodeDisplay({ data, size = 88 }: { data: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    import("qrcode").then(QRCode => {
      QRCode.toCanvas(canvasRef.current!, data, { width: size, margin: 1 }, () => {});
    });
  }, [data, size]);
  return <canvas ref={canvasRef} style={{ borderRadius: 4 }} />;
}

export default function RepInvoicePrintPage({
  params: { locale, id },
}: {
  params: { locale: string; id: string };
}) {
  const ar = locale === "ar";
  const [invoice, setInvoice] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/sales/invoices/${id}`),
      import("@/lib/settings").then(m => m.getCompany()),
    ]).then(([invRes, compRes]) => {
      setInvoice(invRes.data);
      setCompany(compRes.data);
      if (invRes.data?.customer_id) {
        import("@/lib/sales").then(({ getCustomer }) =>
          getCustomer(invRes.data.customer_id).then(r =>
            setInvoice((prev: any) => ({ ...prev, customer: r.data }))
          )
        );
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  // طباعة تلقائية بعد التحميل
  useEffect(() => {
    if (!loading && invoice) {
      setTimeout(() => window.print(), 900);
    }
  }, [loading, invoice]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 14, color: "#6B7280" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 14, color: "#DC2626" }}>{ar ? "الفاتورة غير موجودة" : "Invoice not found"}</div>
      </div>
    );
  }

  const remaining = Number(invoice.total || 0) - Number(invoice.paid_amount || 0);
  const STATUS_AR: Record<string, string> = {
    draft: "مسودة", submitted: "بانتظار المراجعة", approved: "موافق عليها",
    rejected: "مرفوضة", confirmed: "مؤكدة", paid: "مدفوعة",
    partial: "جزئي", cancelled: "ملغاة",
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; direction: rtl; color: #111; background: white; }
        @media print {
          .no-print { display: none !important; }
          body { padding: 0; }
          @page { margin: 10mm; size: A4; }
        }
        @media screen {
          body { padding: 24px; max-width: 820px; margin: 0 auto; }
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 12px; }
        thead tr { background: #F9FAFB; }
        th { font-size: 12px; color: #6B7280; font-weight: 600; text-align: start; border-bottom: 1px solid #E5E7EB; }
        tbody tr { border-bottom: 1px solid #F3F4F6; }
      `}</style>

      {/* زر طباعة — يختفي عند الطباعة */}
      <div className="no-print" style={{ textAlign: "center", padding: "16px 0 24px" }}>
        <button onClick={() => window.print()}
          style={{ padding: "10px 32px", background: "#1D4ED8", color: "white", border: "none",
            borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {ar ? "طباعة / حفظ PDF" : "Print / Save PDF"}
        </button>
      </div>

      {/* ── رأس الفاتورة ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 20, paddingBottom: 16, borderBottom: "2px solid #1D4ED8" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          {company?.logo_data && (
            <img src={company.logo_data} alt="Logo"
              style={{ height: 50, objectFit: "contain", borderRadius: 6 }} />
          )}
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1D4ED8" }}>
              {ar ? "فاتورة ضريبية" : "Tax Invoice — فاتورة ضريبية"}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              {invoice.invoice_type === "simplified"
                ? (ar ? "مبسطة" : "Simplified")
                : (ar ? "ضريبية كاملة" : "Standard")}
            </div>
          </div>
        </div>

        {/* QR */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {invoice.qr_code ? (
            <QRCodeDisplay data={invoice.qr_code} size={84} />
          ) : (
            <div style={{ width: 84, height: 84, border: "1px dashed #D1D5DB", borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>QR</span>
            </div>
          )}
          <div style={{ fontSize: 9, color: "#9CA3AF" }}>ZATCA QR</div>
        </div>

        {/* رقم الفاتورة والتواريخ */}
        <div style={{ textAlign: "start" }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace" }}>
            {invoice.invoice_number}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
            {ar ? "تاريخ الإصدار:" : "Issue Date:"}{" "}
            {new Date(invoice.issue_date).toLocaleDateString("en-SA")}
          </div>
          {invoice.supply_date && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              {ar ? "تاريخ التوريد:" : "Supply Date:"}{" "}
              {new Date(invoice.supply_date).toLocaleDateString("en-SA")}
            </div>
          )}
          {invoice.due_date && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              {ar ? "تاريخ الاستحقاق:" : "Due Date:"}{" "}
              {new Date(invoice.due_date).toLocaleDateString("en-SA")}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px",
              borderRadius: 20, background: "#DBEAFE", color: "#1D4ED8" }}>
              {STATUS_AR[invoice.status] || invoice.status}
            </span>
          </div>
        </div>
      </div>

      {/* ── البائع والعميل ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24,
        marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #E5E7EB" }}>
        {/* البائع */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            color: "#9CA3AF", marginBottom: 8, letterSpacing: "0.06em" }}>
            {ar ? "الشركة / Seller" : "Seller / الشركة"}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{company?.name || ""}</div>
          {company?.vat_number && (
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              {ar ? "الرقم الضريبي:" : "VAT:"} {company.vat_number}
            </div>
          )}
          {company?.cr_number && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              {ar ? "السجل التجاري:" : "CR:"} {company.cr_number}
            </div>
          )}
          {company?.address_city && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>{company.address_city}</div>
          )}
          {company?.phone && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>{company.phone}</div>
          )}
        </div>
        {/* العميل */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            color: "#9CA3AF", marginBottom: 8, letterSpacing: "0.06em" }}>
            {ar ? "العميل / Customer" : "Customer / العميل"}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{invoice.buyer_name_ar || ""}</div>
          {invoice.buyer_vat_number && (
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              {ar ? "الرقم الضريبي:" : "VAT:"} {invoice.buyer_vat_number}
            </div>
          )}
          {invoice.customer?.address_city && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>{invoice.customer.address_city}</div>
          )}
          {invoice.customer?.phone && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>{invoice.customer.phone}</div>
          )}
        </div>
      </div>

      {/* ── أسطر الفاتورة ── */}
      <div style={{ marginBottom: 20 }}>
        <table style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>{ar ? "الوصف" : "Description"}</th>
              <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
              <th style={{ textAlign: "end" }}>{ar ? "سعر الوحدة" : "Unit Price"}</th>
              <th style={{ textAlign: "end" }}>{ar ? "الخصم" : "Disc."}</th>
              <th style={{ textAlign: "end" }}>{ar ? "قبل الضريبة" : "Taxable"}</th>
              <th style={{ textAlign: "end" }}>{ar ? "ضريبة 15%" : "VAT 15%"}</th>
              <th style={{ textAlign: "end", fontWeight: 700 }}>{ar ? "الإجمالي" : "Total"}</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.lines || []).map((line: any, i: number) => (
              <tr key={i}>
                <td style={{ color: "#9CA3AF", fontSize: 12 }}>{i + 1}</td>
                <td>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{line.description_ar}</div>
                  {line.description_en && (
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{line.description_en}</div>
                  )}
                </td>
                <td style={{ textAlign: "end", fontSize: 13 }}>{fmt(line.quantity)}</td>
                <td style={{ textAlign: "end", fontSize: 13 }}>{fmt(line.unit_price)}</td>
                <td style={{ textAlign: "end", fontSize: 13, color: "#DC2626" }}>
                  {Number(line.discount_pct) > 0 ? `${line.discount_pct}%` : "—"}
                </td>
                <td style={{ textAlign: "end", fontSize: 13 }}>{fmt(line.subtotal)}</td>
                <td style={{ textAlign: "end", fontSize: 13, color: "#D97706" }}>{fmt(line.vat_amount)}</td>
                <td style={{ textAlign: "end", fontWeight: 700, fontSize: 13 }}>{fmt(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── الإجماليات ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <div style={{ minWidth: 280, background: "#F9FAFB", border: "1px solid #E5E7EB",
          borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0",
            fontSize: 13, borderBottom: "1px solid #E5E7EB" }}>
            <span style={{ color: "#6B7280" }}>{ar ? "المجموع قبل الضريبة" : "Subtotal"}</span>
            <span>{fmt(invoice.subtotal)} SAR</span>
          </div>
          {Number(invoice.discount_amount) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0",
              fontSize: 13, borderBottom: "1px solid #E5E7EB" }}>
              <span style={{ color: "#DC2626" }}>{ar ? "الخصم" : "Discount"}</span>
              <span style={{ color: "#DC2626" }}>- {fmt(invoice.discount_amount)} SAR</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0",
            fontSize: 13, color: "#D97706", fontWeight: 600, borderBottom: "1px solid #E5E7EB" }}>
            <span>{ar ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)"}</span>
            <span>{fmt(invoice.vat_amount)} SAR</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 5px",
            fontSize: 18, fontWeight: 800 }}>
            <span>{ar ? "الإجمالي شامل الضريبة" : "TOTAL (incl. VAT)"}</span>
            <span style={{ color: "#1D4ED8" }}>{fmt(invoice.total)} SAR</span>
          </div>
          {Number(invoice.paid_amount) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0",
              fontSize: 13 }}>
              <span style={{ color: "#059669", fontWeight: 600 }}>{ar ? "المدفوع" : "Paid"}</span>
              <span style={{ color: "#059669", fontWeight: 700 }}>{fmt(invoice.paid_amount)} SAR</span>
            </div>
          )}
          {remaining > 0.01 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0",
              fontSize: 13 }}>
              <span style={{ color: "#DC2626", fontWeight: 600 }}>{ar ? "المتبقي" : "Remaining"}</span>
              <span style={{ color: "#DC2626", fontWeight: 700 }}>{fmt(remaining)} SAR</span>
            </div>
          )}
        </div>
      </div>

      {/* UUID */}
      {invoice.uuid && (
        <div style={{ padding: "8px 0", borderTop: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF" }}>
          UUID: <code>{invoice.uuid}</code>
        </div>
      )}

      {/* التذييل */}
      <div style={{ marginTop: 24, paddingTop: 12, borderTop: "1px solid #E5E7EB",
        textAlign: "center", fontSize: 11, color: "#9CA3AF" }}>
        {ar ? "تم إنشاء هذه الفاتورة إلكترونياً" : "This invoice was generated electronically"} — {company?.name || ""}
      </div>
    </>
  );
}
