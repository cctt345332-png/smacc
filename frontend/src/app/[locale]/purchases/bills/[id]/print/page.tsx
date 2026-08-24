"use client";

import { useEffect, useState, use } from "react";
import { getBill, getVendor } from "@/lib/purchases";
import { getCompany } from "@/lib/settings";
import UnifiedDocumentPrint, { UnifiedPrintDocument } from "@/components/documents/UnifiedDocumentPrint";

export default function BillPrintPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const ar = locale === "ar";
  const [document, setDocument] = useState<UnifiedPrintDocument | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [party, setParty] = useState<any>(null);

  useEffect(() => {
    Promise.all([getBill(id), getCompany()])
      .then(async ([billRes, companyRes]) => {
        const bill = billRes.data;
        setCompany(companyRes.data);
        setDocument({
          number: bill.bill_number,
          issue_date: bill.bill_date,
          supply_date: bill.supply_date,
          due_date: bill.due_date,
          status: bill.status,
          currency_code: bill.currency_code || "SAR",
          subtotal: bill.subtotal,
          discount_amount: bill.discount_amount,
          vat_amount: bill.vat_amount,
          total: bill.total,
          paid_amount: bill.paid_amount,
          notes: bill.notes,
          reference_number: bill.vendor_invoice_number,
          reference_label: "رقم فاتورة المورد",
          lines: (bill.lines || []).map((line: any) => ({ ...line, vat_rate: line.vat_rate, unit: line.unit })),
        });
        if (bill.vendor_id) {
          try { setParty((await getVendor(bill.vendor_id)).data); }
          catch { setParty({ name_ar: bill.vendor_name_ar, vat_number: bill.vendor_vat_number, cr_number: bill.vendor_cr_number }); }
        } else setParty({ name_ar: bill.vendor_name_ar, vat_number: bill.vendor_vat_number, cr_number: bill.vendor_cr_number });
      })
      .catch(() => setDocument(null));
  }, [id]);

  if (!document) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#64736B", fontFamily: "Cairo, sans-serif" }}>{ar ? "جارٍ تجهيز فاتورة المورد للطباعة…" : "Preparing purchase bill for print…"}</div>;
  return <UnifiedDocumentPrint kind="purchase_bill" document={document} company={company} party={party} locale={locale} />;
}
