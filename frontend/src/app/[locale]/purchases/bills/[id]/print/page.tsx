"use client";
/**
 * صفحة طباعة فاتورة المشتريات الواردة
 * - route مستقل بدون sidebar / header → تُفتح في tab جديد
 * - تطبع تلقائياً بعد التحميل
 */
import { useEffect, useRef, useState } from "react";
import { getBill, getVendor } from "@/lib/purchases";
import { getCompany } from "@/lib/settings";

const fmt = (n: any) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── بيانات المورد ──────────────────────────────────────────────────
function VendorBlock({ vendor, ar }: { vendor: any; ar: boolean }) {
  if (!vendor) return <div style={{ fontSize: 14, color: "#6B7280" }}>—</div>;
  const address = [
    vendor.address_building && vendor.address_street
      ? `${vendor.address_building} ${vendor.address_street}`
      : vendor.address_street || null,
    vendor.address_district,
    vendor.address_city,
    vendor.address_postal,
  ]
    .filter(Boolean)
    .join("، ");
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{vendor.name_ar || "—"}</div>
      {vendor.name_en && <div style={{ fontSize: 12, color: "#6B7280" }}>{vendor.name_en}</div>}
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
        {vendor.vat_number && (
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "#9CA3AF" }}>{ar ? "الرقم الضريبي: " : "VAT: "}</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{vendor.vat_number}</span>
          </div>
        )}
        {vendor.cr_number && (
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "#9CA3AF" }}>{ar ? "السجل التجاري: " : "CR: "}</span>
            <span style={{ fontWeight: 600 }}>{vendor.cr_number}</span>
          </div>
        )}
        {address && <div style={{ fontSize: 12, color: "#6B7280" }}>{address}</div>}
        {vendor.phone && <div style={{ fontSize: 12, color: "#6B7280" }}>{vendor.phone}</div>}
        {vendor.email && <div style={{ fontSize: 12, color: "#6B7280" }}>{vendor.email}</div>}
      </div>
    </div>
  );
}

// ── بيانات الشركة (المشتري) ────────────────────────────────────────
function CompanyBlock({ company, ar }: { company: any; ar: boolean }) {
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

// ── الصفحة ────────────────────────────────────────────────────────
export default function BillPrintPage({
  params: { locale, id },
}: {
  params: { locale: string; id: string };
}) {
  const ar = locale === "ar";
  const [bill, setBill] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getBill(id), getCompany()])
      .then(([billRes, compRes]) => {
        setBill(billRes.data);
        setCompany(compRes.data);
        if (billRes.data?.vendor_id) {
          getVendor(billRes.data.vendor_id)
            .then(r => setVendor(r.data))
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // طباعة تلقائية بعد التحميل
  useEffect(() => {
    if (!loading && bill) {
      setTimeout(() => window.print(), 900);
    }
  }, [loading, bill]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 14, color: "#6B7280" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 14, color: "#DC2626" }}>
          {ar ? "الفاتورة غير موجودة" : "Bill not found"}
        </div>
      </div>
    );
  }

  const remaining = Number(bill.total || 0) - Number(bill.paid_amount || 0);

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
            padding: "10px 32px", background: "#7C3AED", color: "white",
            border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}
        >
          {ar ? "طباعة / حفظ PDF" : "Print / Save PDF"}
        </button>
      </div>

      {/* ── رأس الفاتورة ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 20, paddingBottom: 16, borderBottom: "2px solid #7C3AED",
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
            <div style={{ fontSize: 22, fontWeight: 800, color: "#7C3AED" }}>
              {ar ? "فاتورة واردة" : "Purchase Bill — فاتورة واردة"}
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              {ar ? "مشتريات / Purchases" : "Purchases / مشتريات"}
            </div>
          </div>
        </div>

        {/* يمين: رقم الفاتورة والتواريخ */}
        <div style={{ textAlign: "start" }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace" }}>
            {bill.bill_number}
          </div>
          {bill.vendor_invoice_number && (
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              {ar ? "رقم فاتورة المورد:" : "Vendor Invoice:"} {bill.vendor_invoice_number}
            </div>
          )}
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
            {ar ? "تاريخ الفاتورة:" : "Bill Date:"}{" "}
            {bill.bill_date ? new Date(bill.bill_date).toLocaleDateString("en-SA") : "—"}
          </div>
          {bill.supply_date && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              {ar ? "تاريخ التوريد:" : "Supply Date:"}{" "}
              {new Date(bill.supply_date).toLocaleDateString("en-SA")}
            </div>
          )}
          {bill.due_date && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              {ar ? "تاريخ الاستحقاق:" : "Due Date:"}{" "}
              {new Date(bill.due_date).toLocaleDateString("en-SA")}
            </div>
          )}
        </div>
      </div>

      {/* ── الشركة والمورد ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 20,
      }}>
        <div style={{ padding: "16px 20px", borderInlineEnd: "1px solid #E5E7EB" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", marginBottom: 10, letterSpacing: "0.08em" }}>
            {ar ? "الشركة / Buyer" : "Buyer / الشركة"}
          </div>
          <CompanyBlock company={company} ar={ar} />
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", marginBottom: 10, letterSpacing: "0.08em" }}>
            {ar ? "المورد / Vendor" : "Vendor / المورد"}
          </div>
          {vendor ? (
            <VendorBlock vendor={vendor} ar={ar} />
          ) : bill.vendor_name_ar ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{bill.vendor_name_ar}</div>
              {bill.vendor_vat_number && (
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  <span style={{ color: "#9CA3AF" }}>{ar ? "الرقم الضريبي: " : "VAT: "}</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{bill.vendor_vat_number}</span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>
              {ar ? "بدون مورد محدد" : "No vendor specified"}
            </div>
          )}
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
            {(bill.lines || []).map((line: any, i: number) => (
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
            <span>{fmt(bill.subtotal)} SAR</span>
          </div>
          {Number(bill.discount_amount) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#DC2626" }}>{ar ? "الخصم" : "Discount"}</span>
              <span style={{ color: "#DC2626" }}>− {fmt(bill.discount_amount)} SAR</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#D97706", fontWeight: 600 }}>
            <span>{ar ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)"}</span>
            <span>{fmt(bill.vat_amount)} SAR</span>
          </div>
          <div style={{ height: 1, background: "#E5E7EB" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800 }}>
            <span>{ar ? "الإجمالي شامل الضريبة" : "TOTAL (incl. VAT)"}</span>
            <span style={{ color: "#7C3AED" }}>{fmt(bill.total)} SAR</span>
          </div>
          {Number(bill.paid_amount) > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#059669" }}>
                <span>{ar ? "المدفوع" : "Paid"}</span>
                <span>{fmt(bill.paid_amount)} SAR</span>
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
      {bill.notes && (
        <div style={{
          border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 16px",
          marginBottom: 20, fontSize: 13, color: "#374151",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: "#6B7280", fontSize: 11, textTransform: "uppercase" }}>
            {ar ? "ملاحظات" : "Notes"}
          </div>
          {bill.notes}
        </div>
      )}

      {/* ── تذييل ── */}
      <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 12, fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
        {bill.bill_number} — {company?.name || ""} — {ar ? "وثيقة داخلية" : "Internal Document"}
      </div>
    </>
  );
}
