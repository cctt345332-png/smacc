"use client";

import { useEffect, useRef } from "react";

const money = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (value: any) => value ? new Date(value).toLocaleString("ar-SA") : "—";
const esc = (value: any) => String(value ?? "—");

const policy = [
  ["أولًا: الاستبدال أو الاسترجاع في حال وجود خلل مصنعي", "في حال ملاحظة العميل وجود خلل مصنعي في الجهاز، يتم استقبال الجهاز لدى الشركة لإجراء الفحص الفني اللازم. تستغرق عملية الفحص الفني مدة تتراوح من 3 إلى 7 أيام عمل حسب طبيعة العطل ونتائج الفحص. بعد انتهاء الفحص يحدد القسم الفني الإجراء المناسب: استبدال الجهاز، أو إصلاحه، أو رفض الطلب إذا تبين أن المشكلة ناتجة عن سوء استخدام أو سبب خارج عن عيوب التصنيع."],
  ["ثانيًا: حالات سوء الاستخدام", "لا يعتبر الجهاز مشمولًا بالاستبدال بسبب عيب مصنعي إذا ثبت أن المشكلة ناتجة عن سوء الاستخدام أو الكسر أو الصدمات أو دخول السوائل أو الحرارة أو العبث بالجهاز أو أي استخدام يخالف تعليمات الشركة. وقد يتحمل العميل تكاليف الفحص أو الإصلاح أو الأجزاء اللازمة بحسب الحالة."],
  ["ثالثًا: الأجهزة التي تم فتحها أو استخدامها", "فتح الجهاز أو استخدامه أو إزالة التغليف أو تشغيله يعني أن المنتج لم يعد بحالته الأصلية المعدة للبيع. لذلك لا يقبل طلب الإرجاع لمجرد تغيير الرأي أو عدم الرغبة بعد فتح الجهاز أو استخدامه، مع عدم الإخلال بحقوق العميل النظامية عند ثبوت عيب مصنعي."],
  ["رابعًا: شروط قبول طلب الاستبدال", "إحضار فاتورة الشراء أو ما يثبت عملية الشراء، وإحضار الجهاز وجميع ملحقاته ومحتوياته الأصلية متى كان ذلك مطلوبًا للفحص، وعدم وجود كسر أو تلف أو آثار سوائل أو عبث بالجهاز ما لم يثبت خلاف ذلك بتقرير الفحص الفني. يخضع الجهاز للفحص قبل اعتماد الاستبدال."],
  ["خامسًا: قرار الفحص الفني", "يعد تقرير القسم الفني الأساس في تحديد ما إذا كانت المشكلة ناتجة عن عيب مصنعي أو سوء استخدام أو سبب آخر، وبناءً عليه يحدد الإجراء المناسب وفقًا للأنظمة والضوابط المعمول بها."],
  ["سادسًا: مدة الفحص", "مدة الفحص الفني المتوقعة من 3 إلى 7 أيام عمل، وقد تزيد المدة في بعض الحالات التي تتطلب فحصًا إضافيًا أو الرجوع إلى الشركة المصنعة."],
];

export default function MaintenanceA4Print({ ticket, company, document = "intake" }: { ticket: any; company?: any; document?: "intake" | "inspection" }) {
  const qr = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const value = `${ticket?.ticket_number || ""}|${ticket?.device_serial || ""}`;
    if (!value || !qr.current) return;
    import("qrcode").then(QR => QR.toCanvas(qr.current!, value, { width: 92, margin: 1, errorCorrectionLevel: "M" }, () => {}));
  }, [ticket]);
  const isInspection = document === "inspection";
  const parts = ticket?.parts || [];
  const services = ticket?.services || [];
  const warrantyLaborLines = isInspection ? [
    { name: "أجور الفحص (ضمن الضمان)", qty: 1, unit: 0, total: 0 },
    { name: "أجور الصيانة (ضمن الضمان)", qty: 1, unit: 0, total: 0 },
  ] : [];
  const lines = [...warrantyLaborLines, ...services.map((x: any) => ({ name: x.service_name, qty: 1, unit: x.amount, total: x.amount })), ...parts.map((x: any) => ({ name: x.product_name, qty: x.quantity, unit: x.unit_price, total: x.total }))];
  const subtotal = lines.reduce((sum: number, x: any) => sum + Number(x.total || 0) / 1.15, 0);
  const vat = lines.reduce((sum: number, x: any) => sum + Number(x.total || 0) - Number(x.total || 0) / 1.15, 0);
  const total = lines.reduce((sum: number, x: any) => sum + Number(x.total || 0), 0);
  return <>
    <style>{`*{box-sizing:border-box}body{margin:0;background:#eef0f3;color:#172033;font-family:Arial,Tahoma,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.a4{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:10mm 14mm;position:relative}.no-print{display:flex;justify-content:center;gap:8px;margin:12px}.no-print button{border:0;border-radius:6px;padding:10px 28px;background:#3E0865;color:#fff;font-weight:700;cursor:pointer}.top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:2px solid #3E0865;padding-bottom:9px}.brand-block{display:flex;align-items:flex-start;gap:10px;flex:1}.logo{height:50px;max-width:120px;object-fit:contain;border-radius:6px}.brand{font-size:19px;font-weight:800}.muted{color:#667085;font-size:10px}.title{background:#172033;color:#fff;padding:9px 14px;text-align:center;font-weight:800;font-size:16px;min-width:210px}.meta{display:grid;grid-template-columns:1fr 1fr;border:1px solid #cbd5e1;margin-top:9px}.meta>div{padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:10px}.meta>div:nth-child(odd){border-left:1px solid #e5e7eb}.label{font-weight:700;color:#475467}.section{margin-top:8px;border:1px solid #cbd5e1}.section-title{background:#eef1f5;padding:5px 8px;font-size:11px;font-weight:800}.section-body{padding:7px;white-space:pre-wrap;min-height:28px;font-size:10px}.info-table,table{width:100%;border-collapse:collapse}th{background:#172033;color:#fff;font-size:9px;padding:5px}td{border:1px solid #cbd5e1;padding:5px;font-size:10px}td.num,th.num{text-align:center}.summary{margin-top:8px;width:55%;margin-right:auto;border:1px solid #cbd5e1}.summary div{display:flex;justify-content:space-between;padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:10px}.summary .grand{background:#172033;color:#fff;font-size:13px;font-weight:800}.qrbox{position:absolute;left:14mm;bottom:20mm;text-align:center;font-size:8px}.terms{margin-top:9px;border-top:1px solid #cbd5e1;padding-top:6px}.terms h2{text-align:center;font-size:12px;margin:0 0 6px}.term{margin:4px 0}.term h3{font-size:9px;margin:0 0 1px}.term p{font-size:8px;line-height:1.3;margin:0}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:45px;margin-top:14px}.signature{border-top:1px solid #667085;padding-top:5px;text-align:center;font-size:9px}.footer{text-align:center;border-top:1px solid #cbd5e1;margin-top:8px;padding-top:6px;font-size:8px;color:#667085}@media print{@page{size:A4 portrait;margin:0}body{background:#fff}.a4{margin:0;min-height:297mm;padding:10mm 14mm}.no-print{display:none!important}}`}</style>
    <div className="no-print"><button onClick={() => window.print()}>طباعة</button><button onClick={() => window.close()} style={{background:"#fff",color:"#3E0865",border:"1px solid #3E0865"}}>إغلاق</button></div>
    <main className="a4" dir="rtl">
      <div className="top"><div className="brand-block">{company?.logo_data && <img className="logo" src={company.logo_data} alt="شعار الشركة" />}<div><div className="brand">{company?.name || company?.name_ar || "اسم شركتكم / مركز الصيانة المعتمد"}</div><div className="muted">مركز صيانة معتمد — {ticket?.branch_name || ticket?.terminal_name || ""}</div><div className="muted">الرقم الضريبي: {company?.vat_number || "—"}</div><div className="muted">الهاتف: {company?.phone || "—"}</div></div></div><div className="title">{isInspection ? "تقرير فحص وصيانة" : "إيصال استلام جهاز صيانة"}<div className="muted" style={{color:"#fff",opacity:.8,marginTop:3}}>{isInspection ? "MAINTENANCE INSPECTION REPORT" : "MAINTENANCE INTAKE RECEIPT"}</div></div></div>
      <div className="meta"><div><span className="label">رقم الطلب:</span> {ticket?.ticket_number}</div><div><span className="label">التاريخ:</span> {date(ticket?.created_at)}</div><div><span className="label">العميل:</span> {ticket?.customer_name || "—"}</div><div><span className="label">الجوال:</span> {ticket?.customer_phone || "—"}</div><div><span className="label">الجهاز:</span> {ticket?.device_name || "—"}</div><div><span className="label">السيريال:</span> {ticket?.device_serial || "—"}</div><div><span className="label">اللون / السعة:</span> {[ticket?.device_color, ticket?.device_capacity].filter(Boolean).join(" / ") || "—"}</div><div><span className="label">الحالة:</span> {ticket?.status || "—"}</div></div>
      <div className="section"><div className="section-title">1. بيانات المشكلة عند الاستلام</div><div className="section-body">{ticket?.reported_problem || "—"}</div></div>
      {isInspection && <div className="section"><div className="section-title">2. نتيجة الفحص والإجراء المقترح</div><div className="section-body">{ticket?.diagnosis || "لم يتم رفع تقرير الفحص بعد"}</div></div>}
      {isInspection && <div className="section"><div className="section-title">3. القطع والخدمات</div><table><thead><tr><th>#</th><th>البيان</th><th className="num">الكمية</th><th className="num">سعر الوحدة</th><th className="num">الإجمالي</th></tr></thead><tbody>{lines.length ? lines.map((x: any, i: number) => <tr key={i}><td className="num">{i + 1}</td><td>{x.name}</td><td className="num">{x.qty}</td><td className="num">{money(x.unit)} ر.س</td><td className="num">{money(x.total)} ر.س</td></tr>) : <tr><td colSpan={5} style={{textAlign:"center"}}>لا توجد قطع أو خدمات مضافة</td></tr>}</tbody></table></div>}
      {isInspection && <div className="summary"><div><span>الإجمالي قبل الضريبة</span><b>{money(subtotal)} ر.س</b></div><div><span>ضريبة القيمة المضافة 15%</span><b>{money(vat)} ر.س</b></div><div className="grand"><span>الإجمالي شامل الضريبة</span><b>{money(total)} ر.س</b></div></div>}
      {!isInspection && <div className="section"><div className="section-title">تنبيه</div><div className="section-body">تم استلام الجهاز للفحص أولًا، وسيتم اعتماد السعر والإجراء بعد صدور تقرير القسم الفني. هذا المستند ليس فاتورة ضريبية.</div></div>}
      <div className="qrbox"><canvas ref={qr}/><div>رمز الطلب</div></div><div className="footer">HOTWAV السعودية — جدة: شارع فلسطين — الرياض: البطحاء — www.ab-tw.com — خدمة العملاء: 0500909030</div>
      <div className="terms"><h2>سياسة الاستبدال والاسترجاع – HOTWAV السعودية</h2>{policy.map(([heading, text]) => <div className="term" key={heading}><h3>{heading}</h3><p>{text}</p></div>)}<div className="term"><h3>للاستفسارات وخدمة العملاء</h3><p>HOTWAV السعودية — رقم خدمة العملاء: 0500909030. نشكر لكم ثقتكم بـ HOTWAV، ونسعد دائمًا بخدمتكم.</p></div><div className="signatures"><div className="signature">توقيع العميل بالاستلام والموافقة</div><div className="signature">توقيع وختم مركز الصيانة</div></div></div>
    </main>
  </>;
}
