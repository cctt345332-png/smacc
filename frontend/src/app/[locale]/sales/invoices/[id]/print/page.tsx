"use client";
import { useEffect, useState } from "react";
import { getInvoice, getCustomer } from "@/lib/sales";
import { getCompany } from "@/lib/settings";
import InvoicePrint, { InvoicePrintDoc } from "@/components/documents/InvoicePrint";

export default function SalesInvoicePrintPage({
  params: { locale, id },
}: {
  params: { locale: string; id: string };
}) {
  const ar = locale === "ar";
  const [doc,     setDoc]     = useState<InvoicePrintDoc | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [party,   setParty]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getInvoice(id), getCompany()])
      .then(([invRes, compRes]) => {
        const inv = invRes.data;
        setCompany(compRes.data);

        const mapped: InvoicePrintDoc = {
          number:           inv.invoice_number,
          issue_date:       inv.issue_date,
          supply_date:      inv.supply_date,
          due_date:         inv.due_date,
          invoice_type:     inv.invoice_type,
          status:           inv.status,
          uuid:             inv.uuid,
          qr_code:          inv.qr_code,
          notes:            inv.notes,
          subtotal:         inv.subtotal,
          discount_amount:  inv.discount_amount,
          vat_amount:       inv.vat_amount,
          total:            inv.total,
          paid_amount:      inv.paid_amount,
          lines:            inv.lines || [],
        };
        setDoc(mapped);

        // جلب بيانات العميل
        if (inv.customer_id) {
          getCustomer(inv.customer_id)
            .then(r => setParty(r.data))
            .catch(() => {
              // fallback: استخدم snapshot المحفوظ في الفاتورة
              if (inv.buyer_name_ar) {
                setParty({ name_ar: inv.buyer_name_ar, vat_number: inv.buyer_vat_number });
              }
            });
        } else if (inv.buyer_name_ar) {
          setParty({ name_ar: inv.buyer_name_ar, vat_number: inv.buyer_vat_number });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // طباعة تلقائية
  useEffect(() => {
    if (!loading && doc) setTimeout(() => window.print(), 900);
  }, [loading, doc]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#6B7280" }}>
      {ar ? "جاري التحميل..." : "Loading..."}
    </div>
  );

  if (!doc) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#DC2626" }}>
      {ar ? "الفاتورة غير موجودة" : "Invoice not found"}
    </div>
  );

  return <InvoicePrint doc={doc} company={company} party={party} locale={locale} type="sale" />;
}
