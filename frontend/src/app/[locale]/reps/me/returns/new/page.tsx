"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createRepCreditNote, getInvoice } from "@/lib/sales";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const parseSerialIds = (line: any): string[] => {
  try {
    const ids = JSON.parse(line.serial_ids_json || "[]");
    return Array.from(new Set([line.serial_item_id, ...(Array.isArray(ids) ? ids : [])].filter(Boolean).map(String)));
  } catch { return line.serial_item_id ? [String(line.serial_item_id)] : []; }
};

export default function RepReturnPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("invoice");
    if (!id) { setError(ar ? "لم يتم تحديد فاتورة للمرتجع" : "No invoice was selected"); setLoading(false); return; }
    getInvoice(id).then(({ data }) => {
      if (!["confirmed", "paid", "partial", "overdue"].includes(data.status)) throw new Error(ar ? "المرتجع متاح فقط لفاتورة مؤكدة أو مرتبطة بسند قبض" : "Returns are available only for confirmed or receipted invoices");
      setInvoice(data);
      setRows((data.lines || []).map((line: any) => {
        const original_serial_ids = parseSerialIds(line);
        return {
          ...line,
          original_serial_ids,
          return_serial_ids: [],
          return_qty: original_serial_ids.length ? 0 : Number(line.quantity || 0),
        };
      }));
    }).catch((e: any) => setError(e?.response?.data?.detail || e?.message || (ar ? "تعذر فتح الفاتورة" : "Could not load invoice")))
      .finally(() => setLoading(false));
  }, [ar]);

  const totals = useMemo(() => rows.reduce((acc, row) => {
    const qty = Math.max(0, Math.min(Number(row.return_qty || 0), Number(row.quantity || 0)));
    const unit = Number(row.unit_price || 0);
    const discount = Number(row.discount_pct || 0);
    const vatRate = Number(row.vat_rate || 0);
    const subtotal = qty * unit;
    const taxable = subtotal * (1 - discount / 100);
    const vat = taxable * vatRate / 100;
    acc.total += taxable + vat;
    acc.vat += vat;
    return acc;
  }, { total: 0, vat: 0 }), [rows]);

  const updateQty = (index: number, raw: string) => setRows(prev => prev.map((row, i) => {
    if (i !== index) return row;
    if ((row.original_serial_ids || []).length) return row;
    const max = Number(row.quantity || 0);
    const value = Math.max(0, Math.min(Number(raw || 0), max));
    return { ...row, return_qty: value };
  }));

  const toggleSerial = (index: number, serialId: string) => setRows(prev => prev.map((row, i) => {
    if (i !== index) return row;
    const selected = new Set<string>(row.return_serial_ids || []);
    selected.has(serialId) ? selected.delete(serialId) : selected.add(serialId);
    const return_serial_ids = Array.from(selected);
    return { ...row, return_serial_ids, return_qty: return_serial_ids.length };
  }));

  const submit = async () => {
    if (!invoice) return;
    const lines = rows.filter(row => Number(row.return_qty || 0) > 0).map((row, i) => ({
      original_invoice_line_id: row.id,
      description_ar: row.description_ar,
      description_en: row.description_en || null,
      quantity: Number(row.return_qty),
      unit_price: Number(row.unit_price || 0),
      discount_pct: Number(row.discount_pct || 0),
      vat_rate: Number(row.vat_rate || 0),
      vat_category: row.vat_category || "S",
      inventory_item_id: row.inventory_item_id || null,
      variant_id: row.variant_id || null,
      serial_ids: (row.original_serial_ids || []).length ? row.return_serial_ids || [] : undefined,
      line_order: i,
    }));
    if (!reason.trim()) { setError(ar ? "اكتب سبب المرتجع" : "Enter a return reason"); return; }
    if (!lines.length) { setError(ar ? "حدد صنفًا واحدًا على الأقل للمرتجع" : "Select at least one returned item"); return; }
    setSaving(true); setError("");
    try {
      await createRepCreditNote({ original_invoice_id: invoice.id, issue_date: new Date().toISOString(), reason: reason.trim(), lines });
      router.push(`/${locale}/reps/me/invoices`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || (ar ? "تعذر إنشاء المرتجع" : "Could not create return"));
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 36, textAlign: "center", color: "var(--text-muted)" }}>{ar ? "جاري تحميل الفاتورة..." : "Loading invoice..."}</div>;
  if (error && !invoice) return <div className="empty-state"><div className="empty-state-title">{error}</div><Link className="btn btn-primary" href={`/${locale}/reps/me/invoices`}>{ar ? "العودة لفواتيري" : "Back to invoices"}</Link></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 5 }}>{ar ? "فواتيري / مرتجع مبيعات" : "My invoices / Sales return"}</div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800 }}>{ar ? "مرتجع مبيعات" : "Sales Return"}</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{ar ? "إشعار دائن مرتبط بالفاتورة الأصلية" : "Credit note linked to the original invoice"}</p>
        </div>
        <Link href={`/${locale}/reps/me/invoices`} className="btn btn-secondary">{ar ? "إلغاء" : "Cancel"}</Link>
      </div>

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", padding: "10px 13px", color: "#B42318", fontSize: 13 }}>{error}</div>}

      <section className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "الفاتورة الأصلية" : "Original invoice"}</div><div style={{ fontFamily: "monospace", fontWeight: 800, color: "#425E7A" }}>{invoice?.invoice_number}</div></div>
          <div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "العميل" : "Customer"}</div><div style={{ fontWeight: 700 }}>{invoice?.buyer_name_ar}</div></div>
          <div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "إجمالي الفاتورة" : "Invoice total"}</div><div style={{ fontWeight: 800 }}>{fmt(invoice?.total)} SAR</div></div>
          <div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "المقبوض بسندات القبض" : "Receipt amount"}</div><div style={{ fontWeight: 800, color: "#425E7A" }}>{fmt(invoice?.paid_amount)} SAR</div></div>
        </div>
      </section>

      <div style={{ background: "#EDF3F8", border: "1px solid #9BBBAD", padding: "10px 13px", fontSize: 12, color: "#23463A" }}>
        {ar ? "المرتجع ينشئ إشعارًا دائنًا مرتبطًا بالفاتورة الأصلية. يظهر مبلغ سندات القبض أعلاه للمتابعة؛ أي صرف نقدي للعميل يُنفذ كسند صرف منفصل بعد اعتماد سياسة المنشأة." : "The return creates a credit note linked to the original invoice. Receipt amount is shown for reference; any customer cash refund is processed separately as a payment voucher under company policy."}
      </div>

      <section className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 12 }}>{ar ? "أصناف المرتجع" : "Return items"}</div>
        <div className="table-wrapper"><table><thead><tr><th>{ar ? "الصنف" : "Item"}</th><th>{ar ? "الكمية المفوترة" : "Invoiced qty"}</th><th>{ar ? "كمية المرتجع" : "Return qty"}</th><th>{ar ? "السيريالات المعادة" : "Returned serials"}</th><th>{ar ? "السعر" : "Price"}</th></tr></thead><tbody>
          {rows.map((row, index) => {
            const serials = row.original_serial_ids || [];
            return <tr key={row.id || index}><td>{row.description_ar}</td><td>{row.quantity}</td><td><input type="number" min="0" max={row.quantity} step="0.001" className="form-input" value={row.return_qty} disabled={serials.length > 0} onChange={e => updateQty(index, e.target.value)} /></td><td>{serials.length ? <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 170 }}>{serials.map((serialId: string) => <label key={serialId} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}><input type="checkbox" checked={(row.return_serial_ids || []).includes(serialId)} onChange={() => toggleSerial(index, serialId)} /><span style={{ fontFamily: "monospace" }}>{serialId}</span></label>)}</div> : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{ar ? "لا ينطبق" : "N/A"}</span>}</td><td>{fmt(row.unit_price)} SAR</td></tr>;
          })}
        </tbody></table></div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <label style={{ display: "block", fontWeight: 800, fontSize: 13, marginBottom: 7 }}>{ar ? "سبب المرتجع" : "Return reason"}</label>
        <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder={ar ? "مثال: استلام صنف غير مطابق أو إلغاء طلب العميل" : "Example: item not as requested or customer cancellation"} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", fontWeight: 800 }}><span>{ar ? "إجمالي المرتجع شامل الضريبة" : "Return total incl. VAT"}</span><span style={{ color: "#425E7A", fontFamily: "monospace" }}>{fmt(totals.total)} SAR</span></div>
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} disabled={saving} onClick={submit}>{saving ? (ar ? "جاري إنشاء المرتجع..." : "Creating return...") : (ar ? "إنشاء الإشعار الدائن للمرتجع" : "Create Return Credit Note")}</button>
      </section>
    </div>
  );
}
