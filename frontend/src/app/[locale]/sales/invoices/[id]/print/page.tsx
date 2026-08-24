"use client";

import { useEffect, useState, use } from "react";
import { getInvoice, getCustomer } from "@/lib/sales";
import { getCompany } from "@/lib/settings";
import UnifiedDocumentPrint, { UnifiedPrintDocument } from "@/components/documents/UnifiedDocumentPrint";

export default function SalesInvoicePrintPage(props: { params: Promise<{ locale: string; id: string }> }) {
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
    Promise.all([getInvoice(id), getCompany()])
      .then(async ([invoiceRes, companyRes]) => {
        const invoice = invoiceRes.data;
        setCompany(companyRes.data);
        setDocument({
          number: invoice.invoice_number,
          issue_date: invoice.issue_date,
          supply_date: invoice.supply_date,
          due_date: invoice.due_date,
          status: invoice.status,
          invoice_type: invoice.invoice_type,
          uuid: invoice.uuid,
          qr_code: invoice.qr_code,
          currency_code: invoice.currency_code || "SAR",
          subtotal: invoice.subtotal,
          discount_amount: invoice.discount_amount,
          vat_amount: invoice.vat_amount,
          total: invoice.total,
          paid_amount: invoice.paid_amount,
          notes: invoice.notes,
          payment_method: invoice.invoice_payment_method,
          lines: (invoice.lines || []).map((line: any) => ({ ...line, vat_rate: line.vat_rate, unit: line.unit })),
        });
        if (invoice.customer_id) {
          try { setParty((await getCustomer(invoice.customer_id)).data); }
          catch { setParty({ name_ar: invoice.buyer_name_ar, vat_number: invoice.buyer_vat_number, address_street: invoice.buyer_address }); }
        } else setParty({ name_ar: invoice.buyer_name_ar, vat_number: invoice.buyer_vat_number, address_street: invoice.buyer_address });
      })
      .catch(() => setDocument(null));
  }, [id]);

  if (!document) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#64736B", fontFamily: "Cairo, sans-serif" }}>{ar ? "جارٍ تجهيز الفاتورة للطباعة…" : "Preparing invoice for print…"}</div>;
  return <UnifiedDocumentPrint kind={document.invoice_type === "simplified" ? "simplified_invoice" : "tax_invoice"} document={document} company={company} party={party} locale={locale} />;
}
