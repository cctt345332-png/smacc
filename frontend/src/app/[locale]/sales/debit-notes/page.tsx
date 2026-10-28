"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { getInvoices } from "@/lib/sales";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function SalesDebitNotesPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [items, setItems] = useState<any[]>([]);
  const [invoiceMap, setInvoiceMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/sales/debit-notes"), getInvoices()]).then(([notes, invoices]) => {
      setItems(notes.data || []);
      const map: Record<string, string> = {};
      (invoices.data || []).forEach((inv: any) => { map[inv.id] = inv.invoice_number; });
      setInvoiceMap(map);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return <>
    <div className="page-header">
      <div>
        <div className="breadcrumb"><Link href={`/${locale}/sales`}>{ar ? "المبيعات" : "Sales"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "إشعارات مدينة" : "Debit Notes"}</span></div>
        <h1 className="page-title">{ar ? "إشعارات مدينة المبيعات" : "Sales Debit Notes"}</h1>
        <p className="page-subtitle">{ar ? "إضافة مبالغ إلى فواتير العملاء واختبارها مع زاتكا" : "Add amounts to customer invoices and test them with ZATCA"}</p>
      </div>
      <Link href={`/${locale}/sales/debit-notes/new`} className="btn btn-primary btn-sm"><Icon name="plus" size={14} /> {ar ? "إشعار مدين جديد" : "New Debit Note"}</Link>
    </div>
    <div className="card">
      <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
        {loading ? <div className="empty-state">{ar ? "جاري التحميل..." : "Loading..."}</div> : items.length === 0 ? <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد إشعارات مدينة" : "No debit notes"}</div><Link href={`/${locale}/sales/debit-notes/new`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>{ar ? "إنشاء إشعار مدين" : "Create debit note"}</Link></div> :
          <table><thead><tr><th>{ar ? "رقم الإشعار" : "Note #"}</th><th>{ar ? "الفاتورة الأصلية" : "Original invoice"}</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "السبب" : "Reason"}</th><th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th><th>{ar ? "الحالة" : "Status"}</th></tr></thead>
            <tbody>{items.map(note => <tr key={note.id}><td><Link href={`/${locale}/sales/debit-notes/${note.id}`} style={{ fontWeight: 700, color: "#2563EB", textDecoration: "none" }}>{note.credit_note_number}</Link></td><td>{invoiceMap[note.original_invoice_id] || "—"}</td><td>{new Date(note.issue_date).toLocaleDateString("en-SA")}</td><td>{note.reason}</td><td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(note.total)} SAR</td><td>{note.zatca_status || (ar ? "غير مختبر" : "Not tested")}</td></tr>)}</tbody>
          </table>}
      </div>
    </div>
  </>;
}
