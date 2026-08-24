"use client";
import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { getCustomer, convertToInvoice } from "@/lib/sales";
import { getCompany } from "@/lib/settings";
import { Icon } from "@/components/ui/Icons";
import SellerBlock from "@/components/documents/SellerBlock";
import CustomerBlock from "@/components/documents/CustomerBlock";

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

const STATUS_MAP: Record<string, { ar: string; badge: string }> = {
  draft:    { ar: "مسودة",    badge: "badge-warning" },
  sent:     { ar: "مرسلة",   badge: "badge-info" },
  accepted: { ar: "مقبولة",  badge: "badge-success" },
  rejected: { ar: "مرفوضة", badge: "badge-danger" },
  expired:  { ar: "منتهية",  badge: "badge-gray" },
};

export default function QuotationDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const ar = locale === "ar";
  const router = useRouter();
  const [quotation, setQuotation] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = async () => {
    try {
      const [quotRes, compRes] = await Promise.all([
        api.get(`/sales/quotations/${id}`),
        getCompany(),
      ]);
      setQuotation(quotRes.data);
      setCompany(compRes.data);
      if (quotRes.data?.customer_id) {
        const custRes = await getCustomer(quotRes.data.customer_id);
        setCustomer(custRes.data);
      }
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleConvert = async () => {
    if (!confirm(ar ? "تحويل عرض السعر لفاتورة؟" : "Convert this quotation to an invoice?")) return;
    setActing(true);
    try {
      await convertToInvoice(id);
      router.push(`/${locale}/sales/invoices`);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Error");
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="empty-state" style={{ minHeight: "60vh" }}>
        <div className="empty-state-title">{ar ? "عرض السعر غير موجود" : "Quotation not found"}</div>
        <Link href={`/${locale}/sales/quotations`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
          {ar ? "العودة لعروض الأسعار" : "Back to Quotations"}
        </Link>
      </div>
    );
  }

  const status = STATUS_MAP[quotation.status] || { ar: quotation.status, badge: "badge-gray" };

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/sales/quotations`}>{ar ? "عروض الأسعار" : "Quotations"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{quotation.quotation_number}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <h1 className="page-title">{quotation.quotation_number}</h1>
            <span className={`badge ${status.badge}`}>{status.ar}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.open(`/${locale}/sales/quotations/${id}/print`, "_blank")}>
            <Icon name="print" size={14} />
            {ar ? "طباعة" : "Print"}
          </button>
          {(quotation.status === "draft" || quotation.status === "sent" || quotation.status === "accepted") && (
            <button className="btn btn-primary btn-sm" onClick={handleConvert} disabled={acting}>
              <Icon name="invoice" size={14} />
              {ar ? "تحويل لفاتورة" : "Convert to Invoice"}
            </button>
          )}
        </div>
      </div>

      {/* Document Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        {/* ── رأس المستند ── */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border)", background: "#F8FAFC" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            {/* يسار: شعار + عنوان */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              {company?.logo_data && (
                <img src={company.logo_data} alt="Logo" style={{ height: 52, objectFit: "contain", borderRadius: 6 }} />
              )}
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)" }}>
                  {ar ? "عرض سعر" : "Quotation — عرض سعر"}
                </div>
                <span className={`badge ${status.badge}`} style={{ marginTop: 4 }}>{status.ar}</span>
              </div>
            </div>

            {/* وسط: فراغ (لا QR لعروض الأسعار) */}
            <div style={{ width: 88 }} />

            {/* يمين: الرقم والتواريخ */}
            <div style={{ textAlign: "end" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{quotation.quotation_number}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {ar ? "تاريخ الإصدار:" : "Issue Date:"} {new Date(quotation.issue_date).toLocaleDateString("en-SA")}
              </div>
              {quotation.expiry_date && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {ar ? "تاريخ الانتهاء:" : "Expiry Date:"} {new Date(quotation.expiry_date).toLocaleDateString("en-SA")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── الشركة والعميل ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--border)" }}>
          {/* الشركة (البائع) */}
          <div style={{ padding: "18px 28px", borderInlineEnd: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.08em" }}>
              {ar ? "الشركة / Seller" : "Seller / الشركة"}
            </div>
            <SellerBlock company={company} ar={ar} />
          </div>

          {/* العميل */}
          <div style={{ padding: "18px 28px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.08em" }}>
              {ar ? "العميل / Customer" : "Customer / العميل"}
            </div>
            <CustomerBlock customer={customer} ar={ar} />
          </div>
        </div>

        {/* ── جدول الأسطر ── */}
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{ar ? "الوصف" : "Description"}</th>
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
              {(quotation.lines || []).map((line: any, i: number) => (
                <tr key={i}>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{line.description_ar}</div>
                    {line.description_en && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{line.description_en}</div>}
                  </td>
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

        {/* ── الإجماليات ── */}
        <div style={{ padding: "20px 28px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 300, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{ar ? "المجموع قبل الضريبة" : "Subtotal (excl. VAT)"}</span>
              <span>{fmt(quotation.subtotal)} SAR</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#D97706", fontWeight: 600 }}>
              <span>{ar ? "ضريبة القيمة المضافة" : "VAT"}</span>
              <span>{fmt(quotation.vat_amount)} SAR</span>
            </div>
            <div style={{ height: 1, background: "var(--border)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800 }}>
              <span>{ar ? "الإجمالي شامل الضريبة" : "TOTAL (incl. VAT)"}</span>
              <span style={{ color: "var(--primary)" }}>{fmt(quotation.total)} SAR</span>
            </div>
          </div>
        </div>

        {/* ملاحظات */}
        {quotation.notes && (
          <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", background: "#FFFBEB" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {ar ? "ملاحظات" : "Notes"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{quotation.notes}</div>
          </div>
        )}
      </div>
    </>
  );
}
