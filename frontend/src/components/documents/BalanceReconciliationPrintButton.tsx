"use client";

import { getCompany } from "@/lib/settings";

const esc = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] || char));
const money = (value: unknown) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  locale: string;
  customerName: string;
  customerNumber?: string;
  period: string;
  systemBalance: number;
  reconciliationDate: string;
};

export default function BalanceReconciliationPrintButton({ locale, customerName, customerNumber, period, systemBalance, reconciliationDate }: Props) {
  const ar = locale === "ar";
  const onPrint = async () => {
    const win = window.open("", "_blank");
    if (!win) return;
    let company: any = null;
    try { company = (await getCompany()).data; } catch {}
    const companyName = company?.name || company?.name_ar || "مسار";
    const logo = company?.logo_data ? `<img src="${esc(company.logo_data)}" alt="logo">` : "";
    const today = new Date().toLocaleDateString("en-GB");
    const amount = money(systemBalance);
    win.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${esc(ar ? "مطابقة رصيد" : "Balance confirmation")}</title><style>
      @page{size:A4 portrait;margin:16mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#2B1A32;font-family:"IBM Plex Sans Arabic",Cairo,Arial,sans-serif;font-size:14px;line-height:1.9}.sheet{min-height:265mm;position:relative}.header{display:flex;align-items:center;gap:12px;border-bottom:3px solid #3E0865;padding-bottom:12px}.header img{width:58px;height:58px;object-fit:contain;border:1px solid #D5C8DD;padding:3px}.company{font-size:20px;font-weight:800;color:#3E0865}.company small{display:block;font-size:10px;font-weight:400;color:#75617F;line-height:1.5}.title{text-align:center;margin:30px 0 26px;color:#3E0865;font-size:22px;font-weight:800;text-decoration:underline;text-underline-offset:7px}.date{text-align:left;direction:ltr;color:#75617F;font-size:12px;margin-bottom:18px}.letter{font-size:16px}.greeting{font-weight:700;margin-bottom:20px}.recipient{font-weight:800;margin:10px 0}.amount{margin:28px auto;padding:17px 22px;border:2px solid #3E0865;border-radius:8px;text-align:center;max-width:520px;background:#F8F4FA;color:#3E0865}.amount span{display:block;font-size:13px;color:#75617F}.amount b{display:block;direction:ltr;font:800 25px "Courier New",monospace;margin-top:5px}.period{font-weight:700;color:#3E0865}.closing{margin-top:22px}.confirm{margin-top:45px;border:1px solid #CDBED6;padding:16px 20px;break-inside:avoid}.confirm h2{margin:0 0 8px;color:#3E0865;font-size:16px}.checks{display:flex;gap:42px;margin-top:12px}.check{display:inline-flex;align-items:center;gap:8px}.box{width:17px;height:17px;border:1px solid #3E0865;display:inline-block}.lines{margin-top:15px;border-bottom:1px dotted #9C8BA6;height:36px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:42px;text-align:center}.signature{border-top:1px solid #A995B2;padding-top:8px;color:#75617F}.footer{position:absolute;bottom:0;inset-inline:0;border-top:1px solid #D5C8DD;padding-top:8px;text-align:center;color:#75617F;font-size:10px}.footer b{color:#3E0865}@media print{.confirm{break-inside:avoid}}
    </style></head><body><main class="sheet"><header class="header">${logo}<div class="company">${esc(companyName)}<small>${esc([company?.vat_number ? `${ar ? "الرقم الضريبي" : "VAT"}: ${company.vat_number}` : "", company?.cr_number ? `${ar ? "السجل التجاري" : "CR"}: ${company.cr_number}` : "", company?.address_city || ""].filter(Boolean).join(" · "))}</small></div></header><div class="date">${esc(ar ? `التاريخ: ${today}` : `Date: ${today}`)}</div><h1 class="title">${esc(ar ? "خطاب مطابقة رصيد" : "Balance Confirmation Letter")}</h1><section class="letter"><p class="greeting">السلام عليكم ورحمة الله وبركاته،</p><p>السادة/ <strong>${esc(customerName)}</strong> المحترمين،</p><p>نفيدكم بأن الرصيد المستحق لكم حسب سجلاتنا المحاسبية حتى نهاية الفترة المحددة أدناه هو:</p><div class="amount"><span>${esc(ar ? "الرصيد حسب سجلاتنا" : "Balance according to our records")}</span><b>${esc(amount)} SAR</b></div><p class="period">الفترة: <span dir="ltr">${esc(period)}</span>${customerNumber ? ` — رقم العميل: <span dir="ltr">${esc(customerNumber)}</span>` : ""}</p><p>نأمل منكم التكرم بمراجعة الرصيد أعلاه والتوقيع أدناه بالمطابقة، أو كتابة أي ملاحظات أو اختلافات إن وجدت.</p><p class="closing">وتفضلوا بقبول فائق الاحترام والتقدير.</p></section><section class="confirm"><h2>إقرار العميل</h2><p>أقر أنا/ نحن بأن الرصيد الموضح أعلاه:</p><div class="checks"><span class="check"><i class="box"></i> مطابق</span><span class="check"><i class="box"></i> غير مطابق</span></div><div class="lines">ملاحظات العميل:</div><div class="lines"></div></section><section class="signatures"><div class="signature">اسم العميل وتوقيعه</div><div class="signature">ختم المنشأة</div></section><footer class="footer"><b>${esc(companyName)}</b> — ${esc(ar ? "خطاب مطابقة رصيد" : "Balance confirmation letter")}</footer></main><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
    win.document.close();
  };
  return <button type="button" className="btn btn-secondary btn-sm" onClick={onPrint}>🖨️ {ar ? "طباعة مطابقة الرصيد" : "Print balance confirmation"}</button>;
}
