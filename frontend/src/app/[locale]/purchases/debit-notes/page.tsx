"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getDebitNotes, getBills } from "@/lib/purchases";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function DebitNotesPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [items, setItems] = useState<any[]>([]);
  const [billMap, setBillMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDebitNotes(),
      getBills(),
    ]).then(([dnRes, billsRes]) => {
      setItems(dnRes.data);
      const map: Record<string, string> = {};
      billsRes.data.forEach((b: any) => { map[b.id] = b.bill_number; });
      setBillMap(map);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/purchases`}>{ar ? "المشتريات" : "Purchases"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "مرتجعات المشتريات" : "Purchase Returns"}</span>
          </div>
          <h1 className="page-title">{ar ? "مرتجعات المشتريات" : "Purchase Returns"}</h1>
          <p className="page-subtitle">{ar ? "مرتجعات مرتبطة بالفواتير الواردة" : "Returns linked to purchase bills"}</p>
        </div>
        <Link href={`/${locale}/purchases/debit-notes/new`} className="btn btn-primary btn-sm">
          <Icon name="plus" size={14} /> {ar ? "+ مرتجع جديد" : "+ New Return"}
        </Link>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}>
                <Icon name="reverse" size={24} />
              </div>
              <div className="empty-state-title">{ar ? "لا توجد مرتجعات مشتريات" : "No purchase returns"}</div>
              <Link href={`/${locale}/purchases/debit-notes/new`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                {ar ? "إنشاء مرتجع جديد" : "Create New Return"}
              </Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم الإشعار" : "DN #"}</th>
                  <th>{ar ? "الفاتورة الأصلية" : "Original Bill"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "السبب" : "Reason"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((dn: any) => (
                  <tr key={dn.id}>
                    <td>
                      <Link href={`/${locale}/purchases/debit-notes/${dn.id}`} style={{ fontWeight: 700, color: "#7C3AED", textDecoration: "none" }}>
                        {dn.debit_note_number}
                      </Link>
                    </td>
                    <td>
                      {billMap[dn.original_bill_id] ? (
                        <Link href={`/${locale}/purchases/bills/${dn.original_bill_id}`} style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none", fontSize: 13 }}>
                          {billMap[dn.original_bill_id]}
                        </Link>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(dn.issue_date).toLocaleDateString("en-SA")}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{dn.reason}</td>
                    <td style={{ textAlign: "end", fontWeight: 700, color: "#7C3AED" }}>{fmt(dn.total)} SAR</td>
                    <td>
                      <span className={`badge ${dn.status === "confirmed" ? "badge-success" : "badge-warning"}`}>
                        {dn.status === "confirmed" ? (ar ? "مؤكد" : "Confirmed") : (ar ? "مسودة" : "Draft")}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Link href={`/${locale}/purchases/debit-notes/${dn.id}`} className="btn btn-ghost btn-sm btn-icon" title={ar ? "عرض" : "View"}>
                          <Icon name="view" size={14} />
                        </Link>
                        <button className="btn btn-ghost btn-sm btn-icon" title={ar ? "طباعة" : "Print"}
                          onClick={() => window.open(`/${locale}/purchases/debit-notes/${dn.id}`, "_blank")}>
                          <Icon name="print" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
