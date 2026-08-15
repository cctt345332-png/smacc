"use client";
/**
 * InvoicePrint — مكوّن طباعة الفاتورة الموحَّد
 *
 * يُستخدم في:
 *   - sales/invoices/[id]/print
 *   - purchases/bills/[id]/print
 *   - reps/me/invoices/[id]/print
 *
 * Props:
 *   doc       — بيانات الفاتورة/الفاتورة الواردة (مُوحَّدة من الخارج)
 *   company   — بيانات الشركة (البائع / المشتري)
 *   party     — الطرف الثاني: عميل أو مورد
 *   locale    — "ar" | "en"
 *   type      — "sale" | "purchase"  → يغيّر لون رأس الصفحة والعنوان
 */

import { useEffect, useRef } from "react";

// ── QR Code ────────────────────────────────────────────────────────
function QRCode({ data, size = 86 }: { data: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!data || !ref.current) return;
    import("qrcode").then(QR =>
      QR.toCanvas(ref.current!, data, { width: size, margin: 1, errorCorrectionLevel: "M" }, () => {})
    );
  }, [data, size]);
  return <canvas ref={ref} style={{ borderRadius: 4, display: "block" }} />;
}

// ── مساعد تنسيق الأرقام ────────────────────────────────────────────
const fmt = (n: any) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── بناء نص العنوان ────────────────────────────────────────────────
function buildAddress(p: any): string {
  if (!p) return "";
  return [
    p.address_building && p.address_street
      ? `${p.address_building} ${p.address_street}`
      : p.address_street || null,
    p.address_district,
    p.address_city,
    p.address_postal,
  ]
    .filter(Boolean)
    .join("، ");
}

// ── بلوك الطرف (شركة أو عميل أو مورد) ───────────────────────────
function PartyBlock({
  data,
  nameField = "name",
  ar,
}: {
  data: any;
  nameField?: "name" | "name_ar";
  ar: boolean;
}) {
  if (!data) return <div style={{ color: "#9CA3AF", fontStyle: "italic", fontSize: 13 }}>—</div>;

  const name    = data[nameField] || data.name || data.name_ar || "—";
  const address = buildAddress(data);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{name}</div>
      {data.name_en && nameField === "name_ar" && (
        <div style={{ fontSize: 11, color: "#6B7280" }}>{data.name_en}</div>
      )}
      {data.name_en && nameField === "name" && (
        <div style={{ fontSize: 11, color: "#6B7280" }}>{data.name_en}</div>
      )}
      {data.vat_number && (
        <div style={{ fontSize: 12 }}>
          <span style={{ color: "#9CA3AF" }}>{ar ? "الرقم الضريبي: " : "VAT: "}</span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.03em" }}>
            {data.vat_number}
          </span>
        </div>
      )}
      {data.cr_number && (
        <div style={{ fontSize: 12 }}>
          <span style={{ color: "#9CA3AF" }}>{ar ? "السجل التجاري: " : "CR: "}</span>
          <span style={{ fontWeight: 600 }}>{data.cr_number}</span>
        </div>
      )}
      {address && <div style={{ fontSize: 12, color: "#6B7280" }}>{address}</div>}
      {data.phone && <div style={{ fontSize: 12, color: "#6B7280" }}>{data.phone}</div>}
      {data.email && <div style={{ fontSize: 12, color: "#6B7280" }}>{data.email}</div>}
    </div>
  );
}

// ── الواجهة العامة ─────────────────────────────────────────────────
export interface InvoicePrintDoc {
  // رقم وتواريخ
  number: string;              // invoice_number أو bill_number
  vendor_invoice_number?: string;
  issue_date?: string;
  bill_date?: string;
  supply_date?: string;
  due_date?: string;
  invoice_type?: string;       // "simplified" | "standard"
  status?: string;
  uuid?: string;
  qr_code?: string;
  notes?: string;
  // مبالغ
  subtotal: number;
  discount_amount?: number;
  vat_amount: number;
  total: number;
  paid_amount?: number;
  // أسطر
  lines: {
    description_ar: string;
    description_en?: string;
    quantity: number;
    unit_price: number;
    discount_pct?: number;
    subtotal: number;
    vat_amount: number;
    total: number;
  }[];
}

interface Props {
  doc: InvoicePrintDoc;
  company: any;   // بيانات الشركة من getCompany()
  party?: any;    // عميل أو مورد
  locale: string;
  type: "sale" | "purchase";
}

// ألوان كل نوع
const COLORS = {
  sale:     { primary: "#1D4ED8", light: "#DBEAFE", badge: "#EFF6FF" },
  purchase: { primary: "#7C3AED", light: "#EDE9FE", badge: "#F5F3FF" },
};

const STATUS_AR: Record<string, string> = {
  draft: "مسودة", confirmed: "مؤكدة", paid: "مدفوعة",
  partial: "جزئية", cancelled: "ملغاة", submitted: "بانتظار المراجعة",
  approved: "موافق عليها", rejected: "مرفوضة", overdue: "متأخرة",
};

export default function InvoicePrint({ doc, company, party, locale, type }: Props) {
  const ar    = locale === "ar";
  const color = COLORS[type];

  const issueDate = doc.issue_date || doc.bill_date;
  const remaining = Number(doc.total || 0) - Number(doc.paid_amount || 0);

  const titleAr = type === "sale"
    ? (doc.invoice_type === "simplified" ? "فاتورة ضريبية مبسطة" : "فاتورة ضريبية")
    : "فاتورة واردة";
  const titleEn = type === "sale"
    ? (doc.invoice_type === "simplified" ? "Simplified Tax Invoice" : "Tax Invoice")
    : "Purchase Bill";

  const sellerLabel = type === "sale"
    ? (ar ? "البائع / Seller"   : "Seller / البائع")
    : (ar ? "المشتري / Buyer"  : "Buyer / المشتري");
  const buyerLabel  = type === "sale"
    ? (ar ? "المشتري / Customer" : "Customer / المشتري")
    : (ar ? "المورد / Vendor"   : "Vendor / المورد");

  return (
    <>
      {/* ── CSS للطباعة — مضمَّن حتى لا يعتمد على globals ── */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: "Segoe UI", Tahoma, Arial, sans-serif;
          direction: ${ar ? "rtl" : "ltr"};
          color: #111827;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-page {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 14mm 16mm 14mm;
          background: #fff;
        }
        @media screen {
          body { background: #F3F4F6; padding: 24px 0; }
        }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; padding: 0; }
          @page { size: A4 portrait; margin: 0; }
          .print-page { padding: 10mm 14mm; }
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 7px 10px; }
        th {
          font-size: 11px; font-weight: 600; color: #6B7280;
          text-align: start; background: #F9FAFB;
          border-bottom: 1px solid #E5E7EB;
        }
        td { font-size: 12px; border-bottom: 1px solid #F3F4F6; }
        .divider { height: 1px; background: #E5E7EB; margin: 14px 0; }
      `}</style>

      {/* زر طباعة — يختفي عند الطباعة */}
      <div className="no-print" style={{
        textAlign: "center", padding: "20px 0",
        background: "#F3F4F6", borderBottom: "1px solid #E5E7EB",
      }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: "10px 36px", background: color.primary, color: "#fff",
            border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700,
            cursor: "pointer", letterSpacing: "0.02em",
          }}
        >
          {ar ? "طباعة / حفظ PDF" : "Print / Save PDF"}
        </button>
      </div>

      {/* ════ ورقة A4 ════ */}
      <div className="print-page">

        {/* ── رأس الفاتورة ── */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          paddingBottom: 14, marginBottom: 14,
          borderBottom: `2.5px solid ${color.primary}`,
          gap: 12,
        }}>

          {/* يسار: شعار + عنوان */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
            {company?.logo_data && (
              <img
                src={company.logo_data} alt="Logo"
                style={{ height: 52, maxWidth: 120, objectFit: "contain", borderRadius: 6 }}
              />
            )}
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: color.primary, lineHeight: 1.2 }}>
                {ar ? titleAr : titleEn}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>
                {ar ? titleEn : titleAr}
              </div>
            </div>
          </div>

          {/* وسط: QR (فقط للمبيعات) */}
          {type === "sale" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              {doc.qr_code ? (
                <QRCode data={doc.qr_code} size={86} />
              ) : (
                <div style={{
                  width: 86, height: 86, border: "1px dashed #D1D5DB", borderRadius: 6,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ fontSize: 10, color: "#9CA3AF" }}>QR</span>
                </div>
              )}
              <div style={{ fontSize: 9, color: "#9CA3AF" }}>ZATCA QR</div>
            </div>
          )}

          {/* يمين: رقم + تواريخ + حالة */}
          <div style={{ textAlign: "start", minWidth: 160 }}>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "monospace", color: "#111827" }}>
              {doc.number}
            </div>
            {doc.vendor_invoice_number && (
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                {ar ? "رقم فاتورة المورد: " : "Vendor Inv.: "}
                <span style={{ fontWeight: 600 }}>{doc.vendor_invoice_number}</span>
              </div>
            )}
            {issueDate && (
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                {ar ? "التاريخ: " : "Date: "}
                {new Date(issueDate).toLocaleDateString("en-SA")}
              </div>
            )}
            {doc.supply_date && (
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                {ar ? "تاريخ التوريد: " : "Supply: "}
                {new Date(doc.supply_date).toLocaleDateString("en-SA")}
              </div>
            )}
            {doc.due_date && (
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                {ar ? "الاستحقاق: " : "Due: "}
                {new Date(doc.due_date).toLocaleDateString("en-SA")}
              </div>
            )}
            {doc.status && (
              <div style={{ marginTop: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 10px",
                  borderRadius: 20, background: color.light, color: color.primary,
                }}>
                  {STATUS_AR[doc.status] || doc.status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── البائع والمشتري ── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0,
          border: "1px solid #E5E7EB", borderRadius: 8,
          marginBottom: 16, overflow: "hidden",
        }}>
          {/* الشركة */}
          <div style={{ padding: "14px 16px", borderInlineEnd: "1px solid #E5E7EB" }}>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              color: "#9CA3AF", marginBottom: 8, letterSpacing: "0.07em",
            }}>
              {sellerLabel}
            </div>
            <PartyBlock data={company} nameField="name" ar={ar} />
          </div>

          {/* العميل / المورد */}
          <div style={{ padding: "14px 16px" }}>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              color: "#9CA3AF", marginBottom: 8, letterSpacing: "0.07em",
            }}>
              {buyerLabel}
            </div>
            {party ? (
              <PartyBlock data={party} nameField="name_ar" ar={ar} />
            ) : (
              <div style={{ color: "#9CA3AF", fontStyle: "italic", fontSize: 13 }}>
                {ar ? "غير محدد" : "Not specified"}
              </div>
            )}
          </div>
        </div>

        {/* ── جدول الأسطر ── */}
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }}>#</th>
                <th>{ar ? "الوصف" : "Description"}</th>
                <th style={{ textAlign: "end", width: 60 }}>{ar ? "الكمية" : "Qty"}</th>
                <th style={{ textAlign: "end", width: 90 }}>{ar ? "سعر الوحدة" : "Unit Price"}</th>
                <th style={{ textAlign: "end", width: 70 }}>{ar ? "الخصم" : "Disc."}</th>
                <th style={{ textAlign: "end", width: 100 }}>{ar ? "قبل الضريبة" : "Taxable"}</th>
                <th style={{ textAlign: "end", width: 90 }}>{ar ? "ضريبة 15%" : "VAT 15%"}</th>
                <th style={{ textAlign: "end", width: 100, fontWeight: 700 }}>{ar ? "الإجمالي" : "Total"}</th>
              </tr>
            </thead>
            <tbody>
              {(doc.lines || []).map((line, i) => (
                <tr key={i}>
                  <td style={{ color: "#9CA3AF" }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{line.description_ar}</div>
                    {line.description_en && (
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{line.description_en}</div>
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
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <div style={{
            minWidth: 290,
            border: "1px solid #E5E7EB", borderRadius: 8,
            overflow: "hidden",
          }}>
            {/* صفوف الإجماليات */}
            {[
              {
                label: ar ? "المجموع قبل الضريبة" : "Subtotal (excl. VAT)",
                value: fmt(doc.subtotal) + " SAR",
                color: "#374151",
                show: true,
              },
              {
                label: ar ? "الخصم" : "Discount",
                value: "− " + fmt(doc.discount_amount) + " SAR",
                color: "#DC2626",
                show: Number(doc.discount_amount) > 0,
              },
              {
                label: ar ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)",
                value: fmt(doc.vat_amount) + " SAR",
                color: "#D97706",
                show: true,
                bold: true,
              },
            ]
              .filter(r => r.show)
              .map((row, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "8px 14px", borderBottom: "1px solid #F3F4F6",
                  fontSize: 13,
                }}>
                  <span style={{ color: row.bold ? row.color : "#6B7280", fontWeight: row.bold ? 600 : 400 }}>
                    {row.label}
                  </span>
                  <span style={{ color: row.color, fontWeight: row.bold ? 700 : 500 }}>{row.value}</span>
                </div>
              ))}

            {/* الإجمالي الكبير */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              padding: "10px 14px", background: color.light,
              fontSize: 16, fontWeight: 900,
            }}>
              <span>{ar ? "الإجمالي شامل الضريبة" : "TOTAL (incl. VAT)"}</span>
              <span style={{ color: color.primary }}>{fmt(doc.total)} SAR</span>
            </div>

            {/* مدفوع / متبقي */}
            {Number(doc.paid_amount) > 0 && (
              <>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "7px 14px", fontSize: 13,
                  borderTop: "1px solid #E5E7EB",
                }}>
                  <span style={{ color: "#059669", fontWeight: 600 }}>{ar ? "المدفوع" : "Paid"}</span>
                  <span style={{ color: "#059669", fontWeight: 700 }}>{fmt(doc.paid_amount)} SAR</span>
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "7px 14px", fontSize: 13,
                }}>
                  <span style={{ color: remaining > 0.01 ? "#DC2626" : "#059669", fontWeight: 600 }}>
                    {ar ? "المتبقي" : "Remaining"}
                  </span>
                  <span style={{ color: remaining > 0.01 ? "#DC2626" : "#059669", fontWeight: 700 }}>
                    {fmt(remaining)} SAR
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── ملاحظات ── */}
        {doc.notes && (
          <div style={{
            border: "1px solid #E5E7EB", borderRadius: 8,
            padding: "10px 14px", marginBottom: 16,
            fontSize: 12, color: "#374151",
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              color: "#9CA3AF", marginBottom: 4, letterSpacing: "0.07em",
            }}>
              {ar ? "ملاحظات" : "Notes"}
            </div>
            {doc.notes}
          </div>
        )}

        {/* ── UUID (ZATCA) ── */}
        {doc.uuid && (
          <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 12 }}>
            UUID: <code style={{ letterSpacing: "0.02em" }}>{doc.uuid}</code>
          </div>
        )}

        {/* ── تذييل ── */}
        <div style={{
          borderTop: "1px solid #E5E7EB", paddingTop: 10,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ fontSize: 10, color: "#9CA3AF" }}>
            {doc.number} — {company?.name || ""}
          </div>
          <div style={{ fontSize: 10, color: "#9CA3AF" }}>
            {type === "sale"
              ? (ar ? "وثيقة ضريبية رسمية" : "Official Tax Document")
              : (ar ? "وثيقة مشتريات داخلية" : "Internal Purchase Document")}
          </div>
        </div>

      </div>{/* end .print-page */}
    </>
  );
}
