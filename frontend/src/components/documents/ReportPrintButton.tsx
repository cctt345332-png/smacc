"use client";

import { getCompany } from "@/lib/settings";

type Props = {
  locale: string;
  title: string;
  reportType?: string;
  period: string;
  contentId: string;
};

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[char] || char));

export default function ReportPrintButton({ locale, title, reportType, period, contentId }: Props) {
  const ar = locale === "ar";
  const printReport = async () => {
    const content = document.getElementById(contentId);
    if (!content) return;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;

    let company: any = null;
    try { company = (await getCompany()).data; } catch {}

    const address = [company?.address_building, company?.address_street, company?.address_district, company?.address_city, company?.address_postal].filter(Boolean).join("، ");
    const generated = new Date().toLocaleString(ar ? "ar-SA" : "en-GB");
    const brand = company?.name || company?.name_ar || "SMACC";
    const logo = company?.logo_data ? `<img src="${escapeHtml(company.logo_data)}" alt="Logo" />` : "";
    const tax = company?.vat_number ? `<span>${ar ? "الرقم الضريبي: " : "VAT No.: "}<b dir="ltr">${escapeHtml(company.vat_number)}</b></span>` : "";
    const cr = company?.cr_number ? `<span>${ar ? "السجل التجاري: " : "CR No.: "}<b dir="ltr">${escapeHtml(company.cr_number)}</b></span>` : "";

    reportWindow.document.write(`<!doctype html><html dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>
      @page { size:A4 portrait; margin:12mm; }
      *{box-sizing:border-box} body{margin:0;color:#172E27;background:#fff;font-family:"IBM Plex Sans Arabic",Cairo,Arial,sans-serif;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .report-paper{width:100%;min-height:273mm;position:relative;padding-bottom:24mm}.report-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid #364152;padding-bottom:9px;margin-bottom:14px}.company{display:flex;gap:9px;align-items:flex-start}.company img{width:54px;height:54px;object-fit:contain;border:1px solid #C8D0C7;padding:2px}.company strong{display:block;font-size:14px;color:#364152}.company span{display:block;color:#52655B;font-size:9px;margin-top:3px}.report-meta{text-align:end}.report-meta h1{font-size:17px;margin:0;color:#364152}.report-meta p{margin:3px 0 0;color:#52655B;font-size:10px}.period{margin:0 0 10px;padding:7px 9px;background:#F2F6F2;border:1px solid #C8D0C7;font-weight:700;color:#24453B}.period b{font-family:"Courier New",monospace;direction:ltr;display:inline-block;margin-inline-start:6px}.report-body .card{border:1px solid #C8D0C7!important;border-radius:0!important;box-shadow:none!important;background:#fff!important;overflow:visible!important}.report-body .card-header{padding:7px 9px!important;background:#E9ECE6!important;border-bottom:1px solid #C8D0C7!important}.report-body .card-title{color:#24453B!important;font-size:11px!important;font-weight:800!important}.report-body .table-wrapper{border:0!important;border-radius:0!important;overflow:visible!important}.report-body table{width:100%;border-collapse:collapse;font-size:9px}.report-body th,.report-body td{border:1px solid #C8D0C7!important;padding:5px!important;vertical-align:middle}.report-body th{background:#E9ECE6!important;color:#24453B!important;font-weight:800}.report-body tfoot td{font-weight:800;background:#F6F8F4}.report-body .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.report-footer{position:absolute;bottom:0;inset-inline:0;border-top:1px solid #C8D0C7;padding-top:8px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;text-align:center;color:#52655B;font-size:9px}.signature{min-height:28px;border-bottom:1px dotted #9BA99F;padding-top:4px}.signature b{display:block;color:#24453B;margin-bottom:12px}@media print{.report-paper{min-height:273mm}.report-body{break-inside:auto}.report-body .card{break-inside:avoid}.report-body tr{break-inside:avoid}}
    </style></head><body><main class="report-paper"><header class="report-head"><section class="company">${logo}<div><strong>${escapeHtml(brand)}</strong>${tax}${cr}${address ? `<span>${escapeHtml(address)}</span>` : ""}</div></section><section class="report-meta"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(reportType || title)}</p><p>${ar ? "تاريخ الطباعة: " : "Printed: "}${escapeHtml(generated)}</p></section></header><div class="period">${ar ? "فترة التقرير:" : "Report period:"}<b>${escapeHtml(period)}</b></div><section class="report-body">${content.innerHTML}</section><footer class="report-footer"><div class="signature"><b>${ar ? "المحاسب" : "Accountant"}</b></div><div class="signature"><b>${ar ? "المدير المالي" : "Finance Manager"}</b></div><div class="signature"><b>${ar ? "اعتماد الإدارة" : "Management approval"}</b></div></footer></main><script>window.onload=()=>setTimeout(()=>window.print(),250);</script></body></html>`);
    reportWindow.document.close();
  };

  return <button type="button" className="btn btn-secondary btn-sm" onClick={printReport}>🖨️ {ar ? "طباعة تقرير" : "Print report"}</button>;
}
