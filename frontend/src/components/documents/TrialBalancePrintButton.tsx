"use client";

import { getCompany } from "@/lib/settings";

type TrialRow = {
  account_id: string;
  account_code: string;
  account_name_ar: string;
  account_name_en?: string;
  opening_debit: number | string;
  opening_credit: number | string;
  period_debit: number | string;
  period_credit: number | string;
  closing_debit: number | string;
  closing_credit: number | string;
};

type Props = { locale: string; fromDate: string; toDate: string; rows: TrialRow[] };

const esc = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[char] || char));
const num = (value: unknown) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TrialBalancePrintButton({ locale, fromDate, toDate, rows }: Props) {
  const ar = locale === "ar";
  const print = async () => {
    const win = window.open("", "_blank");
    if (!win) return;
    let company: any = null;
    try { company = (await getCompany()).data; } catch {}

    const totals = rows.reduce((acc, row) => ({
      od: acc.od + Number(row.opening_debit || 0), oc: acc.oc + Number(row.opening_credit || 0),
      pd: acc.pd + Number(row.period_debit || 0), pc: acc.pc + Number(row.period_credit || 0),
      cd: acc.cd + Number(row.closing_debit || 0), cc: acc.cc + Number(row.closing_credit || 0),
    }), { od: 0, oc: 0, pd: 0, pc: 0, cd: 0, cc: 0 });
    const balanced = Math.abs(totals.cd - totals.cc) < 0.01;
    const rowsHtml = rows.map((row, i) => `<tr>
      <td class="serial">${i + 1}</td><td class="code">${esc(row.account_code)}</td><td class="name">${esc(ar ? row.account_name_ar : row.account_name_en || row.account_name_ar)}</td>
      <td>${num(row.opening_debit)}</td><td>${num(row.opening_credit)}</td><td>${num(row.period_debit)}</td><td>${num(row.period_credit)}</td><td>${num(row.closing_debit)}</td><td>${num(row.closing_credit)}</td>
    </tr>`).join("");
    const companyName = company?.name || company?.name_ar || "SMACC";
    const address = [company?.address_building, company?.address_street, company?.address_district, company?.address_city, company?.address_postal].filter(Boolean).join("، ");
    const logo = company?.logo_data ? `<img src="${esc(company.logo_data)}" alt="logo" />` : "";
    const vat = company?.vat_number ? `<span>${ar ? "الرقم الضريبي: " : "VAT No.: "}<b dir="ltr">${esc(company.vat_number)}</b></span>` : "";
    const cr = company?.cr_number ? `<span>${ar ? "السجل التجاري: " : "CR No.: "}<b dir="ltr">${esc(company.cr_number)}</b></span>` : "";
    const generated = new Date().toLocaleString(ar ? "ar-SA" : "en-GB");

    win.document.write(`<!doctype html><html dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${ar ? "ميزان المراجعة" : "Trial Balance"}</title><style>
      @page { size: A4 landscape; margin: 10mm; } *{box-sizing:border-box} body{margin:0;background:#fff;color:#17342D;font-family:"IBM Plex Sans Arabic",Cairo,Arial,sans-serif;font-size:9px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{min-height:190mm;position:relative;padding-bottom:20mm}.head{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:start;border-bottom:2px solid #3E0865;padding-bottom:8px}.company{display:flex;gap:8px;align-items:flex-start}.company img{width:45px;height:45px;object-fit:contain;border:1px solid #C8D0C7;padding:2px}.company strong{display:block;color:#3E0865;font-size:13px;margin-bottom:3px}.company span{display:block;color:#55665C;font-size:8px;line-height:1.55}.title{text-align:center}.title h1{margin:0;color:#3E0865;font-size:18px}.title p{margin:4px 0 0;font-size:9px;color:#55665C}.meta{text-align:end;color:#55665C;font-size:8px;line-height:1.7}.meta b{color:#17342D}.facts{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #C8D0C7;margin:10px 0}.facts div{padding:5px 7px;border-inline-start:1px solid #C8D0C7}.facts div:first-child{border-inline-start:0}.facts span{display:block;color:#687A70;font-size:8px}.facts b{font-family:"Courier New",monospace;color:#17342D;font-size:9px}.notice{display:flex;justify-content:space-between;align-items:center;margin:0 0 8px;padding:5px 7px;background:#F2F6F2;border-inline-start:3px solid #3E0865;font-size:8px}.status-ok{color:#087443;font-weight:800}.status-alert{color:#B42318;font-weight:800}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #BFCAC0;padding:5px 4px;text-align:end;font-family:"Courier New",monospace;white-space:nowrap}th{background:#E7EDE7;color:#24453B;font-family:"IBM Plex Sans Arabic",Cairo,Arial,sans-serif;font-weight:800;text-align:center}thead tr:first-child th{background:#DCE8DC}td.serial{width:4%;text-align:center;font-family:inherit}td.code{width:8%;text-align:center}td.name{width:24%;text-align:start;font-family:"IBM Plex Sans Arabic",Cairo,Arial,sans-serif;white-space:normal}tfoot td{background:#EEF3ED;font-weight:800;border-top:2px solid #3E0865}.foot{position:absolute;bottom:0;inset-inline:0;border-top:1px solid #C8D0C7;padding-top:7px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;text-align:center;color:#617168;font-size:8px}.sign{height:25px;border-bottom:1px dotted #9BA99F}.sign b{display:block;color:#24453B;margin-bottom:12px}@media print{thead{display:table-header-group}tfoot{display:table-footer-group}tr{break-inside:avoid}}
    </style></head><body><main class="sheet"><header class="head"><section class="company">${logo}<div><strong>${esc(companyName)}</strong>${vat}${cr}${address ? `<span>${esc(address)}</span>` : ""}</div></section><section class="title"><h1>${ar ? "ميزان المراجعة" : "Trial Balance"}</h1><p>${ar ? "تقرير أرصدة الحسابات حسب الفترة" : "Account balances by reporting period"}</p></section><section class="meta"><div><b>${ar ? "رقم التقرير:" : "Report No.:"}</b> TB-${esc(toDate.replaceAll("-", ""))}</div><div><b>${ar ? "تاريخ الطباعة:" : "Printed:"}</b> ${esc(generated)}</div><div><b>${ar ? "العملة:" : "Currency:"}</b> SAR</div></section></header><section class="facts"><div><span>${ar ? "من تاريخ" : "From date"}</span><b>${esc(fromDate)}</b></div><div><span>${ar ? "إلى تاريخ" : "To date"}</span><b>${esc(toDate)}</b></div><div><span>${ar ? "عدد الحسابات" : "Accounts"}</span><b>${rows.length}</b></div><div><span>${ar ? "أساس التقرير" : "Basis"}</span><b>${ar ? "الاستحقاق" : "Accrual"}</b></div></section><div class="notice"><span>${ar ? "يعرض التقرير الأرصدة الافتتاحية وحركة الفترة والأرصدة الختامية لكل حساب." : "Opening, period movement and closing balances by account."}</span><span class="${balanced ? "status-ok" : "status-alert"}">${balanced ? (ar ? "الميزان متوازن" : "BALANCED") : (ar ? "الميزان غير متوازن" : "OUT OF BALANCE")}</span></div><table><thead><tr><th rowSpan="2">#</th><th rowSpan="2">${ar ? "رمز الحساب" : "Account code"}</th><th rowSpan="2">${ar ? "اسم الحساب" : "Account name"}</th><th colSpan="2">${ar ? "الرصيد الافتتاحي" : "Opening balance"}</th><th colSpan="2">${ar ? "حركة الفترة" : "Period movement"}</th><th colSpan="2">${ar ? "الرصيد الختامي" : "Closing balance"}</th></tr><tr><th>${ar ? "مدين" : "Debit"}</th><th>${ar ? "دائن" : "Credit"}</th><th>${ar ? "مدين" : "Debit"}</th><th>${ar ? "دائن" : "Credit"}</th><th>${ar ? "مدين" : "Debit"}</th><th>${ar ? "دائن" : "Credit"}</th></tr></thead><tbody>${rowsHtml || `<tr><td colspan="9" style="text-align:center;font-family:inherit;color:#687A70">${ar ? "لا توجد أرصدة ضمن الفترة المختارة" : "No balances in the selected period"}</td></tr>`}</tbody><tfoot><tr><td colspan="3" style="text-align:start;font-family:'IBM Plex Sans Arabic',Cairo,Arial,sans-serif">${ar ? "الإجمالي" : "TOTAL"}</td><td>${num(totals.od)}</td><td>${num(totals.oc)}</td><td>${num(totals.pd)}</td><td>${num(totals.pc)}</td><td>${num(totals.cd)}</td><td>${num(totals.cc)}</td></tr></tfoot></table><footer class="foot"><div class="sign"><b>${ar ? "إعداد: المحاسب" : "Prepared by: Accountant"}</b></div><div class="sign"><b>${ar ? "مراجعة: المدير المالي" : "Reviewed by: Finance Manager"}</b></div><div class="sign"><b>${ar ? "اعتماد: الإدارة" : "Approved by: Management"}</b></div><div class="sign"><b>${ar ? "رقم الصفحة: 1" : "Page: 1"}</b></div></footer></main><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
    win.document.close();
  };
  return <button type="button" className="btn btn-secondary btn-sm" onClick={print}>🖨️ {ar ? "طباعة ميزان المراجعة" : "Print Trial Balance"}</button>;
}
