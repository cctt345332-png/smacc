"use client";

export type MaintenanceIntakeReceiptProps = {
  ticket: any;
  company?: { name?: string; phone?: string; logo_data?: string };
  terminalName?: string;
};

const fmtDate = (value: any) => value ? new Date(value).toLocaleString("ar-SA") : "—";
const problemTypeLabels: Record<string, string> = {
  screen: "الشاشة",
  charging: "الشحن",
  battery: "البطارية",
  software: "السوفتوير",
  other: "أخرى",
};

export default function MaintenanceIntakeReceipt({ ticket, company, terminalName }: MaintenanceIntakeReceiptProps) {
  const symptoms = Array.isArray(ticket?.symptoms) ? ticket.symptoms : [];
  return (
    <div className="maintenance-intake-receipt" dir="rtl" style={{ width: "100%", maxWidth: 302, padding: "4px 8px 12px", background: "#fff", color: "#000", fontFamily: "Arial, Tahoma, sans-serif", fontSize: 11, lineHeight: 1.45 }}>
      {company?.logo_data && <img src={company.logo_data} alt="logo" style={{ display: "block", maxWidth: 120, maxHeight: 48, margin: "0 auto 5px", objectFit: "contain" }} />}
      <div style={{ textAlign: "center", fontWeight: 800, fontSize: 15 }}>{company?.name || "الشركة"}</div>
      {company?.phone && <div style={{ textAlign: "center", fontSize: 10 }}>{company.phone}</div>}
      <div style={{ textAlign: "center", fontSize: 10, direction: "ltr", marginTop: 1 }}>www.ab-tw.com</div>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <div style={{ textAlign: "center", fontWeight: 800, fontSize: 14 }}>إيصال استلام جهاز صيانة</div>
      <div style={{ textAlign: "center", fontSize: 10 }}>غير ضريبي — طلب فحص وصيانة</div>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <Row label="رقم الطلب" value={ticket?.ticket_number} />
      <Row label="التاريخ" value={fmtDate(ticket?.created_at)} />
      {terminalName && <Row label="الفرع / الكاشير" value={terminalName} />}
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <Row label="العميل" value={ticket?.customer_name} />
      <Row label="الجوال" value={ticket?.customer_phone} />
      {ticket?.customer_address && <Row label="العنوان" value={ticket.customer_address} />}
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <Row label="الجهاز" value={ticket?.device_name} />
      <Row label="اللون" value={ticket?.device_color} />
      <Row label="السعة" value={ticket?.device_capacity} />
      <Row label="السيريال" value={ticket?.device_serial} />
      <Row label="نوع المشكلة" value={problemTypeLabels[ticket?.problem_type] || ticket?.problem_type} />
      {symptoms.length > 0 && <Row label="الأعراض" value={symptoms.join("، ")} />}
      <div style={{ marginTop: 5, paddingTop: 5, borderTop: "1px solid #000" }}><b>وصف المشكلة:</b><div style={{ whiteSpace: "pre-wrap", marginTop: 3 }}>{ticket?.reported_problem || "—"}</div></div>
      <div style={{ borderTop: "1px dashed #000", margin: "8px 0 5px" }} />
      <div style={{ textAlign: "center", fontSize: 10 }}>تم استلام الجهاز للفحص أولًا، وسيتم اعتماد السعر بعد تقرير الفحص.</div>
      <div style={{ textAlign: "center", fontWeight: 800, fontSize: 11, marginTop: 8 }}>شكرًا لثقتكم بنا</div>
      <div style={{ textAlign: "center", fontSize: 9, marginTop: 2 }}>نسعد بخدمتكم دائمًا</div>
      <div style={{ textAlign: "center", marginTop: 8, fontSize: 9 }}>{ticket?.ticket_number}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: any }) {
  return <div style={{ display: "flex", gap: 5, marginBottom: 3, alignItems: "baseline" }}><span style={{ fontWeight: 700, minWidth: 72 }}>{label}:</span><span style={{ wordBreak: "break-word" }}>{value || "—"}</span></div>;
}
