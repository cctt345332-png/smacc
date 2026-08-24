"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { getCompany } from "@/lib/settings";
import UnifiedDocumentPrint, { PrintDocumentKind, UnifiedPrintDocument } from "./UnifiedDocumentPrint";

type Source = "credit_note" | "quotation" | "sales_order" | "debit_note" | "purchase_order" | "receipt" | "payment" | "expense";

type Props = { source: Source; locale: string; id: string };

const configs: Record<Source, { endpoint: (id: string) => string; kind: PrintDocumentKind; number: string; partyId?: string; partyRoute?: (id: string) => string }> = {
  credit_note: { endpoint: id => `/sales/credit-notes/${id}`, kind: "credit_note", number: "credit_note_number" },
  quotation: { endpoint: id => `/sales/quotations/${id}`, kind: "quotation", number: "quotation_number", partyId: "customer_id", partyRoute: id => `/sales/customers/${id}` },
  sales_order: { endpoint: id => `/sales/orders/${id}`, kind: "sales_order", number: "order_number", partyId: "customer_id", partyRoute: id => `/sales/customers/${id}` },
  debit_note: { endpoint: id => `/purchases/debit-notes/${id}`, kind: "debit_note", number: "debit_note_number" },
  purchase_order: { endpoint: id => `/purchases/orders/${id}`, kind: "purchase_order", number: "order_number", partyId: "vendor_id", partyRoute: id => `/purchases/vendors/${id}` },
  receipt: { endpoint: id => `/treasury/vouchers/${id}`, kind: "receipt", number: "voucher_number" },
  payment: { endpoint: id => `/treasury/vouchers/${id}`, kind: "payment", number: "voucher_number" },
  expense: { endpoint: id => `/treasury/vouchers/${id}`, kind: "expense", number: "voucher_number" },
};

const sourceLabel: Record<Source, string> = {
  credit_note: "مرتجع المبيعات", quotation: "عرض السعر", sales_order: "أمر البيع", debit_note: "مرتجع المشتريات", purchase_order: "أمر الشراء", receipt: "سند القبض", payment: "سند الصرف", expense: "سند المصروف",
};

function normalizeLines(raw: any): any[] {
  const lines = Array.isArray(raw?.lines) ? raw.lines : [];
  return lines.map((line: any) => ({
    description_ar: line.description_ar || line.item_name_ar || line.name_ar || raw?.description_ar || "—",
    description_en: line.description_en || line.item_name_en,
    unit: line.unit,
    quantity: line.quantity ?? 1,
    unit_price: line.unit_price ?? line.price ?? line.total,
    discount_pct: line.discount_pct,
    subtotal: line.subtotal ?? line.taxable_amount ?? line.total,
    vat_rate: line.vat_rate,
    vat_amount: line.vat_amount,
    total: line.total ?? line.subtotal,
  }));
}

export default function CommercialPrintPage({ source, locale, id }: Props) {
  const ar = locale === "ar";
  const [company, setCompany] = useState<any>(null);
  const [party, setParty] = useState<any>(null);
  const [document, setDocument] = useState<UnifiedPrintDocument | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const config = configs[source];
    let alive = true;
    async function load() {
      try {
        const [companyRes, docRes] = await Promise.all([getCompany(), api.get(config.endpoint(id))]);
        if (!alive) return;
        const raw = docRes.data;
        let related: any = null;
        let resolvedParty: any = null;

        if (config.partyId && raw?.[config.partyId] && config.partyRoute) {
          try { resolvedParty = (await api.get(config.partyRoute(raw[config.partyId]))).data; } catch {}
        }
        if (source === "credit_note" && raw?.original_invoice_id) {
          try {
            related = (await api.get(`/sales/invoices/${raw.original_invoice_id}`)).data;
            if (related?.customer_id) resolvedParty = (await api.get(`/sales/customers/${related.customer_id}`)).data;
          } catch {}
        }
        if (source === "debit_note" && raw?.original_bill_id) {
          try {
            related = (await api.get(`/purchases/bills/${raw.original_bill_id}`)).data;
            if (related?.vendor_id) resolvedParty = (await api.get(`/purchases/vendors/${related.vendor_id}`)).data;
          } catch {}
        }

        const isVoucher = ["receipt", "payment", "expense"].includes(source);
        const normalized: UnifiedPrintDocument = {
          number: raw?.[config.number] || raw?.document_number || raw?.number || "—",
          issue_date: raw?.issue_date || raw?.order_date || raw?.quotation_date || raw?.voucher_date || raw?.created_at,
          supply_date: raw?.supply_date,
          due_date: raw?.due_date || raw?.expiry_date,
          status: raw?.status,
          invoice_type: raw?.invoice_type,
          uuid: raw?.uuid,
          qr_code: raw?.qr_code,
          currency_code: raw?.currency_code || "SAR",
          subtotal: raw?.subtotal ?? raw?.taxable_amount ?? raw?.amount ?? raw?.total ?? 0,
          discount_amount: raw?.discount_amount,
          vat_amount: raw?.vat_amount ?? 0,
          total: raw?.total ?? raw?.amount ?? 0,
          paid_amount: raw?.paid_amount,
          notes: raw?.notes,
          terms: raw?.terms,
          reason: raw?.reason || raw?.description_ar,
          reference_number: raw?.original_invoice_number || raw?.original_bill_number || related?.invoice_number || related?.bill_number || raw?.reference,
          reference_label: raw?.original_invoice_id ? "الفاتورة الأصلية" : raw?.original_bill_id ? "فاتورة المورد الأصلية" : "المرجع",
          payment_method: raw?.payment_method,
          delivery_address: raw?.delivery_address,
          party_name: raw?.party_name || raw?.buyer_name_ar || raw?.customer_name_ar || raw?.vendor_name_ar,
          lines: isVoucher ? [{ description_ar: raw?.description_ar || raw?.description || sourceLabel[source], quantity: 1, unit_price: raw?.amount, subtotal: raw?.amount, vat_amount: raw?.vat_amount, total: raw?.amount }] : normalizeLines(raw),
        };
        setCompany(companyRes.data);
        setParty(resolvedParty || raw?.customer || raw?.vendor || (related ? { name_ar: related.buyer_name_ar || related.vendor_name_ar, vat_number: related.buyer_vat_number || related.vendor_vat_number } : null));
        setDocument(normalized);
      } catch {
        if (alive) setError(ar ? "تعذر تحميل بيانات الطباعة" : "Unable to load the print document");
      }
    }
    load();
    return () => { alive = false; };
  }, [source, id, ar]);

  if (error) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#B42318", fontFamily: "Cairo, sans-serif" }}>{error}</div>;
  if (!document) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#64736B", fontFamily: "Cairo, sans-serif" }}>{ar ? "جارٍ تجهيز قالب الطباعة…" : "Preparing print template…"}</div>;
  return <UnifiedDocumentPrint kind={configs[source].kind} document={document} company={company} party={party} locale={locale} />;
}
