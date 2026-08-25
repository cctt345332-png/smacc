"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getDebitNote, getBill, getVendor } from "@/lib/purchases";
import { getCompany } from "@/lib/settings";
import { Icon } from "@/components/ui/Icons";
import SellerBlock from "@/components/documents/SellerBlock";
import CustomerBlock from "@/components/documents/CustomerBlock";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const STATUS_MAP: Record<string, { ar: string; badge: string }> = {
  draft:     { ar: "مسودة", badge: "badge-warning" },
  confirmed: { ar: "مؤكد",  badge: "badge-success" },
  cancelled: { ar: "ملغى",  badge: "badge-danger" },
};

export default function DebitNoteDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const ar = locale === "ar";
  const [note, setNote] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [noteRes, compRes] = await Promise.all([getDebitNote(id), getCompany()]);
        setNote(noteRes.data);
        setCompany(compRes.data);
        if (noteRes.data?.original_bill_id) {
          const billRes = await getBill(noteRes.data.original_bill_id);
          if (billRes.data?.vendor_id) {
            const vendorRes = await getVendor(billRes.data.vendor_id);
            setVendor(vendorRes.data);
          }
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [id]);

  if (loading) return <div className="empty-state" style={{ minHeight: "60vh" }}><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;
  if (!note) return (
    <div className="empty-state" style={{ minHeight: "60vh" }}>
      <div className="empty-state-title">{ar ? "الإشعار غير موجود" : "Debit note not found"}</div>
      <Link href={`/${locale}/purchases/debit-notes`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>{ar ? "العودة" : "Back"}</Link>
    </div>
  );

  const status = STATUS_MAP[note.status] || { ar: note.status, badge: "badge-gray" };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/purchases`}>{ar ? "المشتريات" : "Purchases"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/purchases/debit-notes`}>{ar ? "مرتجعات المشتريات" : "Purchase Returns"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{note.debit_note_number}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <h1 className="page-title">{note.debit_note_number}</h1>
            <span className={`badge ${status.badge}`}>{status.ar}</span>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => window.open(`/${locale}/purchases/debit-notes/${id}/print`, "_blank")}>
          <Icon name="print" size={14} /> {ar ? "طباعة" : "Print"}
        </button>
      </div>

      <div className="card">
        {/* Header */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border)", background: "#F8FAFC" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              {company?.logo_data && <img src={company.logo_data} alt="Logo" style={{ height: 52, objectFit: "contain", borderRadius: 6 }} />}
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#5D7E9F" }}>
                  {ar ? "مرتجع مشتريات" : "Purchase Return — مرتجع مشتريات"}
                </div>
                <span className={`badge ${status.badge}`} style={{ marginTop: 4 }}>{status.ar}</span>
              </div>
            </div>
            <div style={{ textAlign: "end" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{note.debit_note_number}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {ar ? "التاريخ:" : "Date:"} {note.issue_date ? new Date(note.issue_date).toLocaleDateString("en-SA") : "—"}
              </div>
              {note.original_bill_id && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {ar ? "الفاتورة المرجعية:" : "Ref. Bill:"}{" "}
                  <Link href={`/${locale}/purchases/bills/${note.original_bill_id}`} style={{ color: "var(--primary)" }}>
                    {note.original_bill_id}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Buyer & Vendor */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--border)" }}>
          <div style={{ padding: "18px 28px", borderInlineEnd: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.08em" }}>
              {ar ? "المشتري / Buyer" : "Buyer / المشتري"}
            </div>
            <SellerBlock company={company} ar={ar} />
          </div>
          <div style={{ padding: "18px 28px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.08em" }}>
              {ar ? "المورد / Vendor" : "Vendor / المورد"}
            </div>
            <CustomerBlock customer={vendor} ar={ar} />
          </div>
        </div>

        {/* Lines */}
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{ar ? "الوصف" : "Description"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "سعر الوحدة" : "Unit Price"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "ضريبة%" : "VAT%"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "قبل الضريبة" : "Taxable"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الضريبة" : "VAT"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
              </tr>
            </thead>
            <tbody>
              {(note.lines || []).map((line: any, i: number) => (
                <tr key={i}>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{i + 1}</td>
                  <td><div style={{ fontWeight: 500 }}>{line.description_ar}</div></td>
                  <td style={{ textAlign: "end" }}>{fmt(line.quantity)}</td>
                  <td style={{ textAlign: "end" }}>{fmt(line.unit_price)}</td>
                  <td style={{ textAlign: "end", color: "var(--text-secondary)" }}>{Number(line.vat_rate ?? 15)}%</td>
                  <td style={{ textAlign: "end" }}>{fmt(line.subtotal)}</td>
                  <td style={{ textAlign: "end", color: "#D97706" }}>{fmt(line.vat_amount)}</td>
                  <td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(line.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ padding: "20px 28px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 300, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{ar ? "المجموع قبل الضريبة" : "Subtotal"}</span>
              <span>{fmt(note.subtotal)} SAR</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#D97706", fontWeight: 600 }}>
              <span>{ar ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)"}</span>
              <span>{fmt(note.vat_amount)} SAR</span>
            </div>
            <div style={{ height: 1, background: "var(--border)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800 }}>
              <span>{ar ? "الإجمالي شامل الضريبة" : "TOTAL (incl. VAT)"}</span>
              <span style={{ color: "#5D7E9F" }}>{fmt(note.total)} SAR</span>
            </div>
          </div>
        </div>

        {/* Reason */}
        {note.reason && (
          <div style={{ padding: "16px 28px", borderTop: "1px solid var(--border)", background: "#FAFAFA" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.06em" }}>
              {ar ? "سبب الإرجاع" : "Return Reason"}
            </div>
            <div style={{ fontSize: 14 }}>{note.reason}</div>
          </div>
        )}
      </div>
    </>
  );
}
