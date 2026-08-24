"use client";

import { useEffect, useRef } from "react";

export type PrintDocumentKind =
  | "tax_invoice"
  | "simplified_invoice"
  | "credit_note"
  | "debit_note"
  | "quotation"
  | "sales_order"
  | "purchase_order"
  | "purchase_bill"
  | "receipt"
  | "payment"
  | "expense";

export type PrintLine = {
  description_ar?: string;
  description_en?: string;
  unit?: string;
  quantity?: number;
  unit_price?: number;
  discount_pct?: number;
  subtotal?: number;
  vat_rate?: number;
  vat_amount?: number;
  total?: number;
};

export type UnifiedPrintDocument = {
  number: string;
  issue_date?: string;
  supply_date?: string;
  due_date?: string;
  status?: string;
  invoice_type?: string;
  uuid?: string;
  qr_code?: string;
  currency_code?: string;
  subtotal?: number;
  discount_amount?: number;
  vat_amount?: number;
  total?: number;
  paid_amount?: number;
  notes?: string;
  terms?: string;
  reason?: string;
  reference_number?: string;
  reference_label?: string;
  payment_method?: string;
  delivery_address?: string;
  party_name?: string;
  lines?: PrintLine[];
};

type Props = {
  kind: PrintDocumentKind;
  document: UnifiedPrintDocument;
  company: any;
  party?: any;
  locale: string;
  autoPrint?: boolean;
};

const fmt = (value: unknown) => Number(value || 0).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFmt = (value?: string) => value
  ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
  : "—";

const address = (person: any) => [
  person?.address_building && person?.address_street ? `${person.address_building} ${person.address_street}` : person?.address_street,
  person?.address_district,
  person?.address_city,
  person?.address_postal,
].filter(Boolean).join("، ");

const kindMeta: Record<PrintDocumentKind, { ar: string; en: string; accent: string; tax: boolean; negative?: boolean }> = {
  tax_invoice: { ar: "فاتورة ضريبية", en: "Tax Invoice", accent: "#0B5D4A", tax: true },
  simplified_invoice: { ar: "فاتورة ضريبية مبسطة", en: "Simplified Tax Invoice", accent: "#0B5D4A", tax: true },
  credit_note: { ar: "إشعار دائن / مرتجع مبيعات", en: "Credit Note / Sales Return", accent: "#B42318", tax: true, negative: true },
  debit_note: { ar: "إشعار مدين / مرتجع مشتريات", en: "Debit Note / Purchase Return", accent: "#9A3412", tax: false, negative: true },
  quotation: { ar: "عرض سعر", en: "Quotation", accent: "#155E75", tax: false },
  sales_order: { ar: "أمر بيع", en: "Sales Order", accent: "#1D4ED8", tax: false },
  purchase_order: { ar: "أمر شراء", en: "Purchase Order", accent: "#6D28D9", tax: false },
  purchase_bill: { ar: "فاتورة مورد", en: "Purchase Bill", accent: "#6D28D9", tax: false },
  receipt: { ar: "سند قبض", en: "Receipt Voucher", accent: "#047857", tax: false },
  payment: { ar: "سند صرف", en: "Payment Voucher", accent: "#B45309", tax: false },
  expense: { ar: "سند مصروف", en: "Expense Voucher", accent: "#9F1239", tax: false },
};

const paymentLabels: Record<string, string> = {
  cash: "نقدًا", bank_transfer: "تحويل بنكي", transfer: "تحويل بنكي", cheque: "شيك",
  mada: "مدى", stc_pay: "STC Pay", credit_card: "بطاقة ائتمان", credit: "آجل",
};

function QR({ value }: { value?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!value || !ref.current) return;
    import("qrcode").then(QR => QR.toCanvas(ref.current!, value, { width: 94, margin: 1, errorCorrectionLevel: "M" }, () => {}));
  }, [value]);
  if (!value) return null;
  return <canvas ref={ref} aria-label="QR" />;
}

function Party({ title, data, fallback, ar }: { title: string; data?: any; fallback?: string; ar: boolean }) {
  const displayName = data?.name_ar || data?.name || fallback || "—";
  return (
    <section className="udoc-party">
      <div className="udoc-section-label">{title}</div>
      <strong>{displayName}</strong>
      {data?.name_en && <span className="udoc-muted">{data.name_en}</span>}
      {data?.vat_number && <span>{ar ? "الرقم الضريبي: " : "VAT No.: "}<b dir="ltr">{data.vat_number}</b></span>}
      {data?.cr_number && <span>{ar ? "السجل التجاري: " : "CR No.: "}<b dir="ltr">{data.cr_number}</b></span>}
      {address(data) && <span className="udoc-muted">{address(data)}</span>}
      {data?.phone && <span className="udoc-muted">{data.phone}</span>}
    </section>
  );
}

export default function UnifiedDocumentPrint({ kind, document, company, party, locale, autoPrint = true }: Props) {
  const ar = locale === "ar";
  const meta = kindMeta[kind];
  const currency = document.currency_code || "SAR";
  const isVoucher = ["receipt", "payment", "expense"].includes(kind);
  const isPurchase = ["purchase_order", "purchase_bill", "debit_note"].includes(kind);
  const sellerTitle = isPurchase ? (ar ? "المنشأة / المشتري" : "Company / Buyer") : (ar ? "البائع / المورد" : "Seller / Supplier");
  const partyTitle = isPurchase ? (ar ? "المورد" : "Vendor") : (ar ? "العميل / المشتري" : "Customer / Buyer");
  const lines = document.lines?.length ? document.lines : [{ description_ar: document.party_name || document.notes || meta.ar, quantity: 1, total: document.total, subtotal: document.subtotal ?? document.total }];
  const remaining = Number(document.total || 0) - Number(document.paid_amount || 0);

  useEffect(() => {
    if (autoPrint) {
      const timer = window.setTimeout(() => window.print(), 650);
      return () => window.clearTimeout(timer);
    }
  }, [autoPrint]);

  return (
    <div className="udoc-root" dir={ar ? "rtl" : "ltr"} style={{ "--udoc-accent": meta.accent } as React.CSSProperties}>
      <style>{`
        .udoc-root { --udoc-ink:#17342D; --udoc-border:#C8D0C7; --udoc-paper:#FFFEFA; font-family:"IBM Plex Sans Arabic", Cairo, Arial, sans-serif; color:var(--udoc-ink); background:#EEF1ED; min-height:100vh; padding:22px 0; }
        .udoc-toolbar { width:190mm; margin:0 auto 10px; display:flex; justify-content:flex-end; gap:8px; }
        .udoc-toolbar button { border:1px solid var(--udoc-accent); color:white; background:var(--udoc-accent); padding:8px 16px; font:700 13px inherit; cursor:pointer; border-radius:2px; }
        .udoc-page { width:210mm; min-height:297mm; margin:0 auto; padding:13mm 14mm 15mm; background:var(--udoc-paper); position:relative; box-shadow:0 4px 20px rgba(16,49,41,.12); }
        .udoc-page::before { content:""; position:absolute; inset:0; opacity:.25; pointer-events:none; background-image:linear-gradient(#e9eee7 1px,transparent 1px),linear-gradient(90deg,#e9eee7 1px,transparent 1px); background-size:18px 18px; }
        .udoc-content { position:relative; z-index:1; }
        .udoc-head { border-bottom:3px solid var(--udoc-accent); padding-bottom:12px; display:grid; grid-template-columns:1fr auto 1fr; gap:12px; align-items:start; }
        .udoc-brand { display:flex; gap:10px; align-items:flex-start; }
        .udoc-logo { width:56px; height:56px; object-fit:contain; border:1px solid var(--udoc-border); background:white; padding:3px; }
        .udoc-title { color:var(--udoc-accent); font-size:23px; font-weight:900; line-height:1.25; }
        .udoc-subtitle,.udoc-muted { display:block; color:#64736B; font-size:10px; margin-top:3px; }
        .udoc-qr { text-align:center; min-width:104px; }
        .udoc-qr canvas { background:white; border:1px solid var(--udoc-border); padding:3px; }
        .udoc-qr small { display:block; color:#64736B; font-size:9px; margin-top:2px; }
        .udoc-docmeta { text-align:end; font-size:11px; line-height:1.75; }
        .udoc-docno { font:800 18px "Courier New", monospace; letter-spacing:.02em; }
        .udoc-status { display:inline-block; padding:1px 7px; border:1px solid var(--udoc-accent); color:var(--udoc-accent); font-weight:700; font-size:10px; }
        .udoc-parties { display:grid; grid-template-columns:1fr 1fr; border:1px solid var(--udoc-border); margin:13px 0 10px; background:rgba(255,255,255,.75); }
        .udoc-party { padding:10px 12px; min-height:82px; font-size:11px; display:flex; flex-direction:column; gap:3px; }
        .udoc-party + .udoc-party { border-inline-start:1px solid var(--udoc-border); }
        .udoc-section-label { color:var(--udoc-accent); font-weight:800; font-size:10px; letter-spacing:.03em; }
        .udoc-info { display:grid; grid-template-columns:repeat(4,1fr); border:1px solid var(--udoc-border); border-inline-start:0; margin-bottom:10px; background:white; }
        .udoc-info div { padding:6px 8px; border-inline-start:1px solid var(--udoc-border); font-size:10px; }
        .udoc-info span { display:block; color:#64736B; font-size:9px; }
        .udoc-info b { font-family:"Courier New", monospace; }
        .udoc-reason { border-inline-start:3px solid var(--udoc-accent); background:#F1F6F2; padding:8px 10px; margin-bottom:10px; font-size:11px; }
        .udoc-table { width:100%; border-collapse:collapse; background:white; border:1px solid var(--udoc-border); }
        .udoc-table th { background:#E9ECE6; color:#24453B; font-size:10px; padding:7px 6px; text-align:start; border:1px solid var(--udoc-border); white-space:nowrap; }
        .udoc-table td { border:1px solid var(--udoc-border); padding:7px 6px; font-size:10px; vertical-align:top; }
        .udoc-number { text-align:end; font-family:"Courier New", monospace; direction:ltr; }
        .udoc-totals-wrap { display:flex; justify-content:flex-end; margin-top:12px; }
        .udoc-totals { width:78mm; background:white; border:1px solid var(--udoc-border); }
        .udoc-totalrow { display:flex; justify-content:space-between; padding:6px 8px; border-bottom:1px solid var(--udoc-border); font-size:11px; }
        .udoc-totalrow strong { font-family:"Courier New", monospace; direction:ltr; }
        .udoc-grand { background:var(--udoc-accent); color:white; padding:9px 8px; font-weight:800; font-size:13px; }
        .udoc-note { border:1px solid var(--udoc-border); background:#fff; padding:8px 10px; margin-top:10px; font-size:10px; line-height:1.6; }
        .udoc-footer { position:absolute; inset-inline:14mm; bottom:8mm; border-top:1px solid var(--udoc-border); padding-top:5px; display:flex; justify-content:space-between; color:#64736B; font-size:8.5px; }
        @media print { body:not(.thermal-print-mode) .udoc-root, body:not(.thermal-print-mode) .udoc-root * { visibility:visible !important; } .udoc-root { background:white; padding:0; } .udoc-toolbar { display:none!important; } .udoc-page { width:210mm; min-height:297mm; box-shadow:none; margin:0; padding:12mm 13mm 14mm; } @page { size:A4 portrait; margin:0; } }
      `}</style>
      <div className="udoc-toolbar no-print"><button onClick={() => window.print()}>{ar ? "طباعة / حفظ PDF" : "Print / Save PDF"}</button></div>
      <main className="udoc-page">
        <div className="udoc-content">
          <header className="udoc-head">
            <div className="udoc-brand">
              {company?.logo_data && <img src={company.logo_data} className="udoc-logo" alt="Logo" />}
              <div>
                <div className="udoc-title">{ar ? meta.ar : meta.en}</div>
                <span className="udoc-subtitle">{ar ? meta.en : meta.ar}</span>
                {meta.tax && <span className="udoc-subtitle">{ar ? "وثيقة ضريبية إلكترونية" : "Electronic tax document"}</span>}
              </div>
            </div>
            <div className="udoc-qr">{meta.tax && <>{document.qr_code ? <QR value={document.qr_code} /> : <div style={{ width:94, height:94, border:"1px dashed #9AA9A1", display:"grid", placeItems:"center", fontSize:9, color:"#64736B" }}>{ar ? "QR غير متاح" : "QR unavailable"}</div>}<small>{ar ? "رمز الاستجابة السريعة" : "QR code"}</small></>}</div>
            <div className="udoc-docmeta">
              <div className="udoc-docno">{document.number}</div>
              <div>{ar ? "تاريخ الإصدار: " : "Issue date: "}{dateFmt(document.issue_date)}</div>
              {document.supply_date && <div>{ar ? "تاريخ التوريد: " : "Supply date: "}{dateFmt(document.supply_date)}</div>}
              {document.due_date && <div>{ar ? "تاريخ الاستحقاق: " : "Due date: "}{dateFmt(document.due_date)}</div>}
              {document.status && <span className="udoc-status">{document.status}</span>}
            </div>
          </header>

          <section className="udoc-parties">
            <Party title={sellerTitle} data={company} ar={ar} />
            <Party title={partyTitle} data={party} fallback={document.party_name} ar={ar} />
          </section>

          <section className="udoc-info">
            <div><span>{ar ? "نوع المستند" : "Document type"}</span><b>{ar ? meta.ar : meta.en}</b></div>
            <div><span>{ar ? "العملة" : "Currency"}</span><b>{currency}</b></div>
            <div><span>{ar ? (document.reference_label || "المرجع") : "Reference"}</span><b>{document.reference_number || "—"}</b></div>
            <div><span>{ar ? "طريقة الدفع" : "Payment method"}</span><b>{paymentLabels[document.payment_method || ""] || document.payment_method || "—"}</b></div>
          </section>

          {(document.reason || document.delivery_address) && <div className="udoc-reason"><b>{document.reason ? (ar ? "البيان / سبب المستند: " : "Reason / description: ") : (ar ? "عنوان التسليم: " : "Delivery address: ")}</b>{document.reason || document.delivery_address}</div>}

          <table className="udoc-table">
            <thead><tr><th>#</th><th>{ar ? "الوصف" : "Description"}</th><th className="udoc-number">{ar ? "الكمية" : "Qty"}</th><th className="udoc-number">{ar ? "سعر الوحدة" : "Unit price"}</th><th className="udoc-number">{ar ? "الخصم" : "Discount"}</th><th className="udoc-number">{ar ? "الوعاء الضريبي" : "Taxable"}</th><th className="udoc-number">{ar ? "الضريبة" : "VAT"}</th><th className="udoc-number">{ar ? "الإجمالي" : "Total"}</th></tr></thead>
            <tbody>{lines.map((line, index) => <tr key={index}><td>{index + 1}</td><td><b>{line.description_ar || "—"}</b>{line.description_en && <span className="udoc-muted">{line.description_en}</span>}{line.unit && <span className="udoc-muted">{line.unit}</span>}</td><td className="udoc-number">{fmt(line.quantity || 1)}</td><td className="udoc-number">{fmt(line.unit_price ?? line.total)}</td><td className="udoc-number">{Number(line.discount_pct || 0) ? `${fmt(line.discount_pct)}%` : "—"}</td><td className="udoc-number">{fmt(line.subtotal ?? line.total)}</td><td className="udoc-number">{fmt(line.vat_amount)}</td><td className="udoc-number"><b>{fmt(line.total)}</b></td></tr>)}</tbody>
          </table>

          <section className="udoc-totals-wrap"><div className="udoc-totals"><div className="udoc-totalrow"><span>{ar ? "المجموع قبل الضريبة" : "Subtotal"}</span><strong>{fmt(document.subtotal)} {currency}</strong></div>{Number(document.discount_amount || 0) > 0 && <div className="udoc-totalrow"><span>{ar ? "الخصم" : "Discount"}</span><strong>− {fmt(document.discount_amount)} {currency}</strong></div>}<div className="udoc-totalrow"><span>{ar ? "ضريبة القيمة المضافة" : "VAT"}</span><strong>{fmt(document.vat_amount)} {currency}</strong></div><div className="udoc-totalrow udoc-grand"><span>{ar ? (meta.negative ? "إجمالي الإشعار" : "الإجمالي شامل الضريبة") : (meta.negative ? "Credit / debit total" : "Total incl. VAT")}</span><strong>{fmt(document.total)} {currency}</strong></div>{Number(document.paid_amount || 0) > 0 && <div className="udoc-totalrow"><span>{ar ? "المتبقي" : "Remaining"}</span><strong>{fmt(remaining)} {currency}</strong></div>}</div></section>

          {document.terms && <section className="udoc-note"><b>{ar ? "الشروط والأحكام: " : "Terms: "}</b>{document.terms}</section>}
          {document.notes && <section className="udoc-note"><b>{ar ? "ملاحظات: " : "Notes: "}</b>{document.notes}</section>}
          {document.uuid && <section className="udoc-note"><b>UUID: </b><span dir="ltr">{document.uuid}</span></section>}
        </div>
        <footer className="udoc-footer"><span>{company?.name || company?.name_ar || "SMACC"}</span><span>{document.number}</span><span>{ar ? "تم إنشاء المستند من نظام SMACC" : "Generated by SMACC"}</span></footer>
      </main>
    </div>
  );
}
