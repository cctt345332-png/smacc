"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";

const STATUS: Record<string, string> = { new: "جديد", received: "تم الاستلام", inspecting: "قيد الفحص", waiting_customer: "بانتظار موافقة العميل", in_repair: "قيد الصيانة", waiting_part: "بانتظار قطعة", ready: "جاهز للتسليم", delivered: "تم التسليم", closed: "مغلق", rejected: "مرفوض", cancelled: "ملغي" };

export default function MaintenancePrintPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = use(params);
  const query = useSearchParams();
  const copy = query.get("copy") === "maintenance" ? "maintenance" : "rep";
  const ar = locale === "ar";
  const [row, setRow] = useState<any>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/maintenance/${id}`),
      copy === "maintenance" ? api.get(`/maintenance/${id}/secret`).catch(() => ({ data: { lock_secret: null } })) : Promise.resolve({ data: { lock_secret: null } }),
    ]).then(([request, secretRes]) => { setRow(request.data); setSecret(secretRes.data?.lock_secret || null); }).catch(() => setRow(null)).finally(() => setLoading(false));
  }, [id, copy]);
  useEffect(() => { if (row) { const timer = window.setTimeout(() => window.print(), 350); return () => window.clearTimeout(timer); } }, [row]);

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>;
  if (!row) return <div style={{ padding: 40, textAlign: "center" }}>{ar ? "طلب الصيانة غير موجود" : "Maintenance request not found"}</div>;

  const title = copy === "maintenance" ? (ar ? "نسخة عامل الصيانة" : "Maintenance Technician Copy") : (ar ? "نسخة المندوب" : "Sales Rep Copy");
  return <main dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#fff", color: "#172033", fontFamily: "Arial, sans-serif", padding: 32 }}>
    <div className="no-print" style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 18 }}><button onClick={() => window.print()} style={{ border: 0, borderRadius: 6, padding: "9px 24px", background: "#3E0865", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{ar ? "طباعة" : "Print"}</button></div>
    <section style={{ maxWidth: 820, margin: "0 auto", border: "1px solid #D5C8DD" }}>
      <header style={{ display: "flex", justifyContent: "space-between", padding: "24px 28px", borderBottom: "2px solid #6F4A84" }}><div><div style={{ fontSize: 25, fontWeight: 800, color: "#6F4A84" }}>{ar ? "طلب صيانة جوال" : "Mobile Maintenance Request"}</div><div style={{ fontSize: 13, marginTop: 6, color: "#667085" }}>{title}</div></div><div style={{ textAlign: ar ? "left" : "right" }}><div style={{ fontSize: 18, fontWeight: 800 }}>{row.request_number}</div><div style={{ fontSize: 12, color: "#667085", marginTop: 6 }}>{new Date(row.created_at).toLocaleDateString(ar ? "ar-SA" : "en-SA")}</div></div></header>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #E5E7EB" }}><div style={{ padding: "18px 24px", borderInlineEnd: "1px solid #E5E7EB" }}><div style={{ fontSize: 11, color: "#667085" }}>{ar ? "العميل" : "Customer"}</div><div style={{ fontWeight: 800, marginTop: 6 }}>{row.customer_id}</div></div><div style={{ padding: "18px 24px" }}><div style={{ fontSize: 11, color: "#667085" }}>{ar ? "الحالة" : "Status"}</div><div style={{ fontWeight: 800, marginTop: 6 }}>{STATUS[row.status] || row.status}</div></div></div>
      <div style={{ padding: 24 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><tbody>
        <tr><td style={{ padding: "8px 0", color: "#667085", width: "35%" }}>{ar ? "الجهاز" : "Device"}</td><td style={{ padding: "8px 0", fontWeight: 700 }}>{row.device_name || "—"}</td></tr>
        <tr><td style={{ padding: "8px 0", color: "#667085" }}>{ar ? "السيريال" : "Serial"}</td><td style={{ padding: "8px 0", fontWeight: 700 }}>{row.serial_number || "—"}</td></tr>
        <tr><td style={{ padding: "8px 0", color: "#667085" }}>IMEI</td><td style={{ padding: "8px 0", fontWeight: 700 }}>{[row.imei_1, row.imei_2].filter(Boolean).join(" / ") || "—"}</td></tr>
        <tr><td style={{ padding: "8px 0", color: "#667085" }}>{ar ? "المشكلة" : "Problem"}</td><td style={{ padding: "8px 0", fontWeight: 700 }}>{row.reported_problem}</td></tr>
        <tr><td style={{ padding: "8px 0", color: "#667085" }}>{ar ? "الملحقات" : "Accessories"}</td><td style={{ padding: "8px 0", fontWeight: 700 }}>{row.accessories_received || "—"}</td></tr>
        {copy === "maintenance" && <><tr><td style={{ padding: "8px 0", color: "#667085" }}>{ar ? "ملاحظات الفحص" : "Inspection notes"}</td><td style={{ padding: "8px 0", fontWeight: 700 }}>{row.inspection_notes || "—"}</td></tr><tr><td style={{ padding: "8px 0", color: "#667085" }}>{ar ? "الإصلاح" : "Repair"}</td><td style={{ padding: "8px 0", fontWeight: 700 }}>{row.repair_notes || "—"}</td></tr><tr><td style={{ padding: "8px 0", color: "#667085" }}>{ar ? "كلمة المرور / الرمز" : "Password / lock"}</td><td style={{ padding: "8px 0", fontWeight: 700 }}>{secret || (row.lock_secret_provided ? (ar ? "موجودة — اطلب عرضها من الصلاحية" : "Provided — permission required") : "—")}</td></tr><tr><td style={{ padding: "8px 0", color: "#667085" }}>{ar ? "الاستبدال" : "Replacement"}</td><td style={{ padding: "8px 0", fontWeight: 700 }}>{row.replacement_approved ? `${row.replacement_serial_number || "—"} — ${ar ? "معتمد" : "Approved"}` : (ar ? "غير معتمد" : "Not approved")}</td></tr></>}
      </tbody></table><div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 50, fontSize: 12 }}><div style={{ borderTop: "1px solid #98A2B3", paddingTop: 8 }}>{ar ? "توقيع المندوب" : "Rep signature"}</div><div style={{ borderTop: "1px solid #98A2B3", paddingTop: 8 }}>{ar ? "توقيع العميل / عامل الصيانة" : "Customer / technician signature"}</div></div></div>
      <footer style={{ padding: "14px 24px", borderTop: "1px solid #E5E7EB", color: "#667085", fontSize: 11 }}>{ar ? "يتم خصم السيريال البديل من المخزون بعد اعتماد الاستبدال فقط" : "Replacement serial is deducted only after approval"}</footer>
    </section><style jsx global>{`@media print { .no-print { display:none!important; } body { margin:0; } main { padding:0!important; } }`}</style>
  </main>;
}
