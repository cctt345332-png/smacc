"use client";
/**
 * صفحة طباعة فاتورة المبيعات
 * - route مستقل بدون sidebar / header → تُفتح في tab جديد
 * - تطبع تلقائياً بعد التحميل
 */
import { useEffect, useRef, useState } from "react";
import { getInvoice, getCustomer } from "@/lib/sales";
import { getCompany } from "@/lib/settings";

const fmt = (n: any) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── QR Code ────────────────────────────────────────────────────────
function QRCodeDisplay({ data, size = 90 }: { data: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!data || !canvasRef.current) return;
    import("qrcode").then(QRCode => {
      QRCode.toCanvas(canvasRef.current!, data, { width: size, margin: 1, errorCorrectionLevel: "M" }, () => {});
    });
  }, [data, size]);
  return <canvas ref={canvasRef} style={{ borderRadius: 4 }} />;
}

// ── بيانات الشركة البائعة ──────────────────────────────────────────
function SellerBlock({ company, ar }: { company: any; ar: boolean }) {
  if (!company) return <div style={{ fontSize: 14, color: "#6B7280" }}>—</div>;
  const address = [
    company.address_building && company.address_street
      ? `${company.address_building} ${company.address_street}`
      : company.address_street || null,
    company.address_district,
    company.address_city,
    company.address_postal,
  ]
    .filter(Boolean)
    .join("، ");
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{company.name || "—"}</div>
      {company.name_en && <div style={{ fontSize: 12, color: "#6B7280" }}>{company.name_en}</div>}
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
        {company.vat_number && (
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "#9CA3AF" }}>{ar ? "الرقم الضريبي: " : "VAT: "}</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{company.vat_number}</span>
          </div>
        )}
        {company.cr_number && (
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "#9CA3AF" }}>{ar ? "السجل التجاري: " : "CR: "}</span>
            <span style={{ fontWeight: 600 }}>{company.cr_number}</span>
          </div>
        )}
        {address && <div style={{ fontSize: 12, color: "#6B7280" }}>{address}</div>}
        {company.phone && <div style={{ fontSize: 12, color: "#6B7280" }}>{company.phone}</div>}
        {company.email && <div style={{ fontSize: 12, color: "#6B7280" }}>{company.email}</div>}
      </div>
    </div>
  );
}

// ── بيانات العميل المشتري ──────────────────────────────────────────
function CustomerBlock({ customer, ar }: { customer: any; ar: boolean }) {
  if (!customer) return <div style={{ fontSize: 14, color: "#6B7280" }}>—</div>;
  const address = [
    customer.address_building && customer.address_street
      ? `${customer.address_building} ${customer.address_street}`
      : customer.address_street || null,
    customer.address_district,
    customer.address_city,
    customer.address_postal,
  ]
    .filter(Boolean)
    .join("، ");
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{customer.name_ar || "—"}</div>
      {customer.name_en && <div style={{ fontSize: 12, color: "#6B7280" }}>{customer.name_en}</div>}
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
        {customer.vat_number && (
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "#9CA3AF" }}>{ar ? "الرقم الضريبي: " : "VAT: "}</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{customer.vat_number}</span>
          </div>
        )}
        {customer.cr_number && (
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "#9CA3AF" }}>{ar ? "السجل التجاري: " : "CR: "}</span>
            <span style={{ fontWeight: 600 }}>{customer.cr_number}</span>
          </div>
        )}
        {address && <div style={{ fontSize: 12, color: "#6B7280" }}>{address}</div>}
        {customer.phone && <div style={{ fontSize: 12, color: "#6B7280" }}>{customer.phone}</div>}
        {customer.email && <div style={{ fontSize: 12, color: "#6B7280" }}>{customer.email}</div>}
      </div>
    </div>
  );
}

// ── الصفحة ────────────────────────────────────────────────────────
export default function InvoicePrintPage({
  params: { locale, id },
}: {
  params: { locale: string; id: string };
}) {
  const ar = locale === "ar";
  const [invoice, setInvoice] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getInvoice(id), getCompany()])
      .then(([invRes, compRes]) => {
        setInvoice(invRes.data);
        setCompany(compRes.data);
        // جلب بيانات العميل إذا كان هناك customer_id
        if (invRes.data?.customer_id) {
          getCustomer(invRes.data.customer_id)
            .then(r => setInvoice((prev: any) => ({ ...prev, customer: r.data })))
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
        <div style={{ fontSize: 14, color: "#DC2626" }}>
          {ar ? "الفاتورة غير موجودة" : "Invoice not found"}
        </div>
      </div>
    );
  }

  const remaining = Number(invoice.total || 0) - Number(invoice.paid_amount || 0);

  // بيانات العميل: من customer أو من snapshot
  const customerData = invoice.customer || {
    name_ar: invoice.buyer_name_ar,
    vat_number: invoice.buyer_vat_number,
    address_city: null,
    phone: null,
    email: null,
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: "Segoe UI", Tahoma, Arial, sans-serif;
          direction: ${ar ? "rtl" : "ltr"};
          color: #111;
          background: white;
        }
        @media print {
          .no-print { display: none !important; }
          body { padding: 0; }
          @page { margin: 10mm; size: A4; }
        }
        @media screen {
          body { padding: 24px; max-width: 860px; margin: 0 auto; }
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 12px; }
        thead tr { background: #F9FAFB; }
        th { font-size: 12px; color: #6B7280; font-weight: 600; text-align: start; border-bottom: 1px solid #E5E7EB; }
        tbody tr { border-bottom: 1px solid #F3F4F6; }
        td { font-size: 13px; }
      `}</style>

      {/* ── زر طباعة — يختفي عند الطباعة ── */}
      <div className="no-print" style={{ textAlign: "center", padding: "16px 0 24px" }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: "10px 32px", background: "#1D4ED8", color: "white",
            border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}
        >
          {ar ? "طباعة / حفظ PDF" : "Print / Save PDF"}
        </button>
      </div>

      {/* ── رأس الفاتورة ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 20, paddingBottom: 16, borderBottom: "2px solid #1D4ED8",
      }}>
        {/* يسار: شعار + العنوان */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          {company?.logo_data && (
            <img
              src={company.logo_data} alt="Logo"
              style={{ height: 50, objectFit: "contain", borderRadius: 6 }}
            />
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

        {/* وسط: QR Code */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {invoice.qr_code ? (
            <QRCodeDisplay data={invoice.qr_code} size={84} />
          ) : (
            <div style={{
              width: 84, height: 84, border: "1px dashed #D1D5DB", borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>QR</span>
            </div>
          )}
          <div style={{ fontSize: 9, color: "#9CA3AF" }}>ZATCA QR</div>
        </div>

        {/* يمين: رقم الفاتورة والتواريخ */}
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
        </div>
      </div>

      {/* ── الشركة والعميل ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 20,
      }}>
        <div style={{ padding: "16px 20px", borderInlineEnd: "1px solid #E5E7EB" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", marginBottom: 10, letterSpacing: "0.08em" }}>
            {ar ? "الشركة / Seller" : "Seller / الشركة"}
          </div>
          <SellerBlock company={company} ar={ar} />
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", marginBottom: 10, letterSpacing: "0.08em" }}>
            {ar ? "العميل / Customer" : "Customer / العميل"}
          </div>
          <CustomerBlock customer={customerData} ar={ar} />
        </div>
      </div>

      {/* ── جدول الأسطر ── */}
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 20, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>{ar ? "الوصف" : "Description"}</th>
              <th style={{ textAlign: "end", width: 70 }}>{ar ? "الكمية" : "Qty"}</th>
              <th style={{ textAlign: "end", width: 100 }}>{ar ? "سعر الوحدة" : "Unit Price"}</th>
              <th style={{ textAlign: "end", width: 80 }}>{ar ? "الخصم" : "Disc."}</th>
              <th style={{ textAlign: "end", width: 110 }}>{ar ? "قبل الضريبة" : "Taxable"}</th>
              <th style={{ textAlign: "end", width: 100 }}>{ar ? "ضريبة 15%" : "VAT 15%"}</th>
              <th style={{ textAlign: "end", width: 110 }}>{ar ? "الإجمالي" : "Total"}</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.lines || []).map((line: any, i: number) => (
              <tr key={i}>
                <td style={{ color: "#9CA3AF", fontSize: 12 }}>{i + 1}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{line.description_ar}</div>
                  {line.description_en && (
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{line.description_en}</div>
                  )}
                </td>
                <td style={{ textAlign: "end" }}>{fmt(line.quantity)}</td>
                <td style={{ textAlign: "end" }}>{fmt(line.unit_price)}</td>
                <td style={{ textAlign: "end", color: "#DC2626" }}>
                  {Number(line.discount_pct) > 0 ? `${line.discount_pct}%` : "—"}
                </td>
                <td style={{ textAlign: "end" }}>{fmt(line.subtotal)}</td>
                <td style={{ textAlign: "end", color: "#D97706" }}>{fmt(line.vat_amount)}</td>
                <td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── الإجماليات ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <div style={{
          minWidth: 300, display: "flex", flexDirection: "column", gap: 8,
          border: "1px solid #E5E7EB", borderRadius: 8, padding: "16px 20px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "#6B7280" }}>{ar ? "المجموع قبل الضريبة" : "Subtotal (excl. VAT)"}</span>
            <span>{fmt(invoice.subtotal)} SAR</span>
          </div>
          {Number(invoice.discount_amount) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#DC2626" }}>{ar ? "الخصم" : "Discount"}</span>
              <span style={{ color: "#DC2626" }}>− {fmt(invoice.discount_amount)} SAR</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#D97706", fontWeight: 600 }}>
            <span>{ar ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)"}</span>
            <span>{fmt(invoice.vat_amount)} SAR</span>
          </div>
          <div style={{ height: 1, background: "#E5E7EB" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800 }}>
            <span>{ar ? "الإجمالي شامل الضريبة" : "TOTAL (incl. VAT)"}</span>
            <span style={{ color: "#1D4ED8" }}>{fmt(invoice.total)} SAR</span>
          </div>
          {Number(invoice.paid_amount) > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#059669" }}>
                <span>{ar ? "المدفوع" : "Paid"}</span>
                <span>{fmt(invoice.paid_amount)} SAR</span>
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700,
                color: remaining > 0 ? "#DC2626" : "#059669",
              }}>
                <span>{ar ? "المتبقي" : "Remaining"}</span>
                <span>{fmt(remaining)} SAR</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── ملاحظات ── */}
      {invoice.notes && (
        <div style={{
          border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 16px",
          marginBottom: 20, fontSize: 13, color: "#374151",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: "#6B7280", fontSize: 11, textTransform: "uppercase" }}>
            {ar ? "ملاحظات" : "Notes"}
          </div>
          {invoice.notes}
        </div>
      )}

      {/* ── UUID (ZATCA) ── */}
      {invoice.uuid && (
        <div style={{ paddingTop: 10, borderTop: "1px solid #E5E7EB", fontSize: 11, color: "#9CA3AF" }}>
          <span>UUID: </span>
          <code style={{ fontSize: 11 }}>{invoice.uuid}</code>
        </div>
      )}

      {/* ── تذييل ── */}
      <div style={{ borderTop: "1px solid #E5E7EB", marginTop: 16, paddingTop: 12, fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
        {invoice.invoice_number} — {company?.name || ""} — {ar ? "وثيقة ضريبية رسمية" : "Official Tax Document"}
      </div>
    </>
  );
}
