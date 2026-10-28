"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { getInvoice, submitSalesDebitNoteToZATCASimulation } from "@/lib/sales";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function SalesDebitNoteDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = use(props.params); const ar = locale === "ar";
  const [note, setNote] = useState<any>(null); const [invoice, setInvoice] = useState<any>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const load = async () => { try { const { data } = await api.get(`/sales/credit-notes/${id}`); setNote(data); if (data.original_invoice_id) setInvoice((await getInvoice(data.original_invoice_id)).data); } catch {} finally { setLoading(false); } };
  useEffect(() => { load(); }, [id]);
  const test = async () => { if (!confirm(ar ? "إرسال إشعار المدين لاختبار الامتثال في زاتكا؟" : "Send this debit note to ZATCA compliance test?")) return; setBusy(true); try { await submitSalesDebitNoteToZATCASimulation(id); await load(); alert(ar ? "تم إرسال الاختبار بنجاح" : "Compliance test submitted successfully"); } catch (e: any) { alert(e?.response?.data?.detail || (ar ? "رفضت زاتكا الاختبار" : "ZATCA rejected the test")); } finally { setBusy(false); } };
  if (loading) return <div className="empty-state" style={{ minHeight: "50vh" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>;
  if (!note) return <div className="empty-state"><div className="empty-state-title">{ar ? "إشعار المدين غير موجود" : "Debit note not found"}</div></div>;
  return <>
    <div className="page-header"><div><div className="breadcrumb"><Link href={`/${locale}/sales/debit-notes`}>{ar ? "إشعارات مدينة المبيعات" : "Sales Debit Notes"}</Link><span className="breadcrumb-sep">/</span><span>{note.credit_note_number}</span></div><h1 className="page-title">{note.credit_note_number}</h1><p className="page-subtitle">{ar ? "إشعار مدين لفاتورة مبيعات" : "Sales debit note"}</p></div><div style={{ display: "flex", gap: 8 }}><Link href={`/${locale}/sales/debit-notes`} className="btn btn-secondary btn-sm">{ar ? "عودة" : "Back"}</Link><button className="btn btn-primary btn-sm" onClick={test} disabled={busy}>{busy ? (ar ? "جاري الاختبار..." : "Testing...") : (ar ? "اختبار زاتكا" : "Test ZATCA")}</button></div></div>
    <div className="card" style={{ marginBottom: 20 }}><div className="card-body"><div className="grid-3"><div><div className="form-label">{ar ? "الفاتورة الأصلية" : "Original invoice"}</div><strong>{invoice?.invoice_number || note.original_invoice_id}</strong></div><div><div className="form-label">{ar ? "الحالة" : "Status"}</div><strong style={{ color: note.zatca_status === "compliance_passed" ? "#15803D" : "#B45309" }}>{note.zatca_status || (ar ? "غير مختبر" : "Not tested")}</strong></div><div><div className="form-label">{ar ? "سبب الإشعار" : "Reason"}</div><strong>{note.reason}</strong></div></div></div></div>
    <div className="card"><div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}><table><thead><tr><th>{ar ? "الصنف" : "Item"}</th><th>{ar ? "الكمية" : "Qty"}</th><th>{ar ? "سعر الوحدة" : "Unit price"}</th><th>{ar ? "الضريبة" : "VAT"}</th><th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th></tr></thead><tbody>{(note.lines || []).map((line: any) => <tr key={line.id}><td>{line.description_ar}</td><td>{line.quantity}</td><td>{fmt(line.unit_price)} SAR</td><td>{fmt(line.vat_amount)} SAR</td><td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(line.total)} SAR</td></tr>)}</tbody></table></div><div style={{ padding: 16, textAlign: "end", fontWeight: 800 }}>{ar ? "الإجمالي" : "Total"}: {fmt(note.total)} SAR</div></div>
  </>;
}
