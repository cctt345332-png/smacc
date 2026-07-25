"use client";
/**
 * ThermalReceipt — فاتورة حرارية متوافقة مع متطلبات زاتكا السعودية
 *
 * المتطلبات المطبّقة:
 * - اسم البائع بالعربي
 * - الرقم الضريبي (15 رقم)
 * - رقم السجل التجاري
 * - العنوان الوطني
 * - تاريخ ووقت الإصدار
 * - رقم الفاتورة التسلسلي
 * - UUID الفاتورة
 * - تفاصيل الأصناف مع الكمية والسعر والضريبة
 * - المجموع قبل الضريبة، مبلغ الضريبة، الإجمالي
 * - QR Code (TLV مشفّر base64 — يُعرض كصورة)
 * - نوع الفاتورة: مبسّطة (B2C)
 */

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface ReceiptLine {
  product_name_ar: string;
  quantity: number;
  unit_price: number;
  discount_pct?: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  serial_number?: string;
  variant_label?: string;
  batch_label?: string;
}

interface Company {
  name: string;
  name_en?: string;
  vat_number?: string;
  cr_number?: string;
  address_building?: string;
  address_street?: string;
  address_district?: string;
  address_city?: string;
  address_postal?: string;
  phone?: string;
  logo_data?: string;
}

interface ThermalReceiptProps {
  // بيانات المعاملة
  transaction_number: string;
  uuid?: string;
  created_at: string;
  // بيانات الشركة
  company: Company;
  // رأس وذيل الجهاز
  receipt_header?: string;
  receipt_footer?: string;
  // الأصناف
  lines: ReceiptLine[];
  // الإجماليات
  subtotal: number;
  discount_amount: number;
  vat_amount: number;
  total: number;
  // الدفع
  payment_method: string;
  cash_tendered?: number;
  change_amount?: number;
  card_amount?: number;
  // العميل
  customer_name?: string;
  customer_phone?: string;
  // QR زاتكا (base64 TLV)
  qr_code?: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقداً", mada: "مدى", credit_card: "بطاقة ائتمان",
  stc_pay: "STC Pay", split: "دفع مقسّم",
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ThermalReceipt({
  transaction_number, uuid, created_at,
  company, receipt_header, receipt_footer,
  lines, subtotal, discount_amount, vat_amount, total,
  payment_method, cash_tendered, change_amount, card_amount,
  customer_name, customer_phone, qr_code,
}: ThermalReceiptProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // رسم QR Code من الـ base64 TLV
  useEffect(() => {
    if (!qr_code || !qrCanvasRef.current) return;
    QRCode.toCanvas(qrCanvasRef.current, qr_code, {
      width: 140,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [qr_code]);

  const issueDate = new Date(created_at);
  const dateStr = issueDate.toLocaleDateString("ar-SA", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const timeStr = issueDate.toLocaleTimeString("ar-SA", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const taxableAmount = subtotal - discount_amount;

  return (
    <div
      className="thermal-receipt"
      style={{
        width: 302,           // عرض ورق 80mm ≈ 302px
        fontFamily: "'Alexandria', 'Courier New', monospace",
        fontSize: 12,
        color: "#000",
        background: "#fff",
        padding: "8px 10px",
        direction: "rtl",
        lineHeight: 1.5,
      }}
    >
      {/* ── رأس مخصص من الجهاز ── */}
      {receipt_header && (
        <div style={{ textAlign: "center", fontSize: 11, marginBottom: 6, whiteSpace: "pre-line", borderBottom: "1px dashed #000", paddingBottom: 6 }}>
          {receipt_header}
        </div>
      )}

      {/* ── شعار الشركة ── */}
      {company.logo_data && (
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <img src={company.logo_data} alt="logo" style={{ maxHeight: 50, maxWidth: 120, objectFit: "contain" }} />
        </div>
      )}

      {/* ── اسم الشركة ── */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{company.name}</div>
        {company.name_en && <div style={{ fontSize: 11, color: "#333" }}>{company.name_en}</div>}
      </div>

      {/* ── بيانات زاتكا ── */}
      <div style={{ fontSize: 10, textAlign: "center", marginBottom: 4, color: "#333" }}>
        {company.vat_number && <div>الرقم الضريبي: {company.vat_number}</div>}
        {company.cr_number  && <div>السجل التجاري: {company.cr_number}</div>}
        {(company.address_building || company.address_street) && (
          <div>
            {[company.address_building, company.address_street, company.address_district, company.address_city]
              .filter(Boolean).join("، ")}
          </div>
        )}
        {company.address_postal && <div>الرمز البريدي: {company.address_postal}</div>}
        {company.phone && <div>هاتف: {company.phone}</div>}
      </div>

      <Divider />

      {/* ── نوع الفاتورة ── */}
      <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
        فاتورة ضريبية مبسّطة
        <div style={{ fontSize: 9, fontWeight: 400, color: "#555" }}>Simplified Tax Invoice</div>
      </div>

      {/* ── رقم الفاتورة والتاريخ ── */}
      <Row label="رقم الفاتورة" value={transaction_number} />
      <Row label="التاريخ" value={dateStr} />
      <Row label="الوقت" value={timeStr} />
      {uuid && <Row label="UUID" value={uuid.slice(0, 8) + "..."} small />}

      {/* ── بيانات العميل ── */}
      {(customer_name || customer_phone) && (
        <>
          <Divider />
          {customer_name  && <Row label="العميل" value={customer_name} />}
          {customer_phone && <Row label="الجوال" value={customer_phone} />}
        </>
      )}

      <Divider />

      {/* ── رأس جدول الأصناف ── */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, marginBottom: 3, borderBottom: "1px solid #000", paddingBottom: 2 }}>
        <span style={{ flex: 2 }}>الصنف</span>
        <span style={{ textAlign: "center", width: 30 }}>كمية</span>
        <span style={{ textAlign: "center", width: 45 }}>سعر</span>
        <span style={{ textAlign: "left", width: 50 }}>إجمالي</span>
      </div>

      {/* ── أسطر الأصناف ── */}
      {lines.map((line, i) => {
        const lineSubtotal = line.quantity * line.unit_price;
        const lineDisc = (lineSubtotal * (line.discount_pct || 0)) / 100;
        return (
          <div key={i} style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ flex: 2, lineHeight: 1.3 }}>{line.product_name_ar}</span>
              <span style={{ textAlign: "center", width: 30 }}>{line.quantity}</span>
              <span style={{ textAlign: "center", width: 45 }}>{fmt(line.unit_price)}</span>
              <span style={{ textAlign: "left", width: 50, fontWeight: 600 }}>{fmt(line.total)}</span>
            </div>
            {/* تفاصيل إضافية */}
            {line.serial_number && (
              <div style={{ fontSize: 9, color: "#555", paddingRight: 4 }}>SN: {line.serial_number}</div>
            )}
            {line.variant_label && (
              <div style={{ fontSize: 9, color: "#555", paddingRight: 4 }}>{line.variant_label}</div>
            )}
            {line.batch_label && (
              <div style={{ fontSize: 9, color: "#555", paddingRight: 4 }}>تشغيلة: {line.batch_label}</div>
            )}
            {lineDisc > 0 && (
              <div style={{ fontSize: 9, color: "#555", paddingRight: 4 }}>
                خصم {line.discount_pct}%: -{fmt(lineDisc)}
              </div>
            )}
            <div style={{ fontSize: 9, color: "#555", paddingRight: 4 }}>
              ضريبة {line.vat_rate}%: {fmt(line.vat_amount)} ر.س
            </div>
          </div>
        );
      })}

      <Divider />

      {/* ── الإجماليات ── */}
      <Row label="المجموع قبل الضريبة" value={`${fmt(taxableAmount)} ر.س`} />
      {discount_amount > 0 && (
        <Row label="إجمالي الخصم" value={`-${fmt(discount_amount)} ر.س`} />
      )}
      <Row label="ضريبة القيمة المضافة (15%)" value={`${fmt(vat_amount)} ر.س`} />
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, borderTop: "1px solid #000", paddingTop: 4, marginTop: 2 }}>
        <span>الإجمالي</span>
        <span>{fmt(total)} ر.س</span>
      </div>

      <Divider />

      {/* ── طريقة الدفع ── */}
      <Row label="طريقة الدفع" value={PAYMENT_LABELS[payment_method] || payment_method} />
      {payment_method === "cash" && cash_tendered != null && (
        <>
          <Row label="المبلغ المدفوع" value={`${fmt(cash_tendered)} ر.س`} />
          {(change_amount ?? 0) > 0 && (
            <Row label="الباقي" value={`${fmt(change_amount!)} ر.س`} bold />
          )}
        </>
      )}
      {payment_method === "split" && card_amount != null && (
        <>
          <Row label="نقداً" value={`${fmt(total - card_amount)} ر.س`} />
          <Row label="بطاقة" value={`${fmt(card_amount)} ر.س`} />
        </>
      )}

      {/* ── QR Code زاتكا ── */}
      {qr_code && (
        <>
          <Divider />
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>
              رمز الاستجابة السريعة — ZATCA QR
            </div>
            <canvas ref={qrCanvasRef} style={{ display: "block", margin: "0 auto" }} />
            <div style={{ fontSize: 8, color: "#777", marginTop: 2 }}>
              امسح الرمز للتحقق من الفاتورة
            </div>
          </div>
        </>
      )}

      <Divider />

      {/* ── ذيل مخصص من الجهاز ── */}
      {receipt_footer ? (
        <div style={{ textAlign: "center", fontSize: 11, whiteSpace: "pre-line", marginBottom: 4 }}>
          {receipt_footer}
        </div>
      ) : (
        <div style={{ textAlign: "center", fontSize: 11, marginBottom: 4 }}>
          شكراً لزيارتكم
          <div style={{ fontSize: 9, color: "#555" }}>Thank you for your visit</div>
        </div>
      )}

      {/* ── رقم الفاتورة في الأسفل ── */}
      <div style={{ textAlign: "center", fontSize: 9, color: "#777", marginTop: 4 }}>
        {transaction_number}
      </div>
    </div>
  );
}

// ── مكونات مساعدة ────────────────────────────────────────────────────

function Divider() {
  return <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />;
}

function Row({ label, value, small, bold }: {
  label: string; value: string; small?: boolean; bold?: boolean;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      fontSize: small ? 9 : 11, marginBottom: 2,
      fontWeight: bold ? 700 : 400,
    }}>
      <span style={{ color: "#444" }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 600 }}>{value}</span>
    </div>
  );
}
