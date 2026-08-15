"use client";
import { useEffect, useState } from "react";
import { getBill, getVendor } from "@/lib/purchases";
import { getCompany } from "@/lib/settings";
import InvoicePrint, { InvoicePrintDoc } from "@/components/documents/InvoicePrint";

export default function BillPrintPage({
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
    Promise.all([getBill(id), getCompany()])
      .then(([billRes, compRes]) => {
        const bill = billRes.data;
        setCompany(compRes.data);

        const mapped: InvoicePrintDoc = {
          number:                bill.bill_number,
          vendor_invoice_number: bill.vendor_invoice_number,
          bill_date:             bill.bill_date,
          supply_date:           bill.supply_date,
          due_date:              bill.due_date,
          status:                bill.status,
          notes:                 bill.notes,
          subtotal:              bill.subtotal,
          discount_amount:       bill.discount_amount,
          vat_amount:            bill.vat_amount,
          total:                 bill.total,
          paid_amount:           bill.paid_amount,
          lines:                 bill.lines || [],
        };
        setDoc(mapped);

        // جلب بيانات المورد
        if (bill.vendor_id) {
          getVendor(bill.vendor_id)
            .then(r => setParty(r.data))
            .catch(() => {
              if (bill.vendor_name_ar) {
                setParty({
                  name_ar:    bill.vendor_name_ar,
                  vat_number: bill.vendor_vat_number,
                  cr_number:  bill.vendor_cr_number,
                });
              }
            });
        } else if (bill.vendor_name_ar) {
          setParty({
            name_ar:    bill.vendor_name_ar,
            vat_number: bill.vendor_vat_number,
            cr_number:  bill.vendor_cr_number,
          });
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
      {ar ? "الفاتورة غير موجودة" : "Bill not found"}
    </div>
  );

  return <InvoicePrint doc={doc} company={company} party={party} locale={locale} type="purchase" />;
}
