"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getInvoices, getInvoice, createCreditNote } from "@/lib/sales";
import { Icon } from "@/components/ui/Icons";
import ItemPicker, { PickedItem } from "@/components/inventory/ItemPicker";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const today = () => new Date().toISOString().split("T")[0];

interface Line {
  picked: PickedItem;
  vat_rate: string;
  original_invoice_line_id?: string;
  original_serial_ids?: string[];
  return_serial_ids?: string[];
}

const parseSerialIds = (line: any): string[] => {
  try {
    const ids = JSON.parse(line.serial_ids_json || "[]");
    return Array.from(new Set([line.serial_item_id, ...(Array.isArray(ids) ? ids : [])].filter(Boolean).map(String)));
  } catch { return line.serial_item_id ? [String(line.serial_item_id)] : []; }
};

const emptyLine = (): Line => ({
  picked: { mode: "free", description_ar: "", unit_price: 0, quantity: 1 },
  vat_rate: "15",
});

function calcLine(l: Line) {
  const qty = l.picked.quantity || 0;
  const price = l.picked.unit_price || 0;
  const vat = parseFloat(l.vat_rate) || 0;
  const taxable = qty * price;
  const vatAmt = taxable * vat / 100;
  return { taxable, vatAmt, total: taxable + vatAmt };
}

export default function NewCreditNotePage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [form, setForm] = useState({ original_invoice_id: "", issue_date: today(), reason: "" });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  useEffect(() => {
    getInvoices({ status: "confirmed" }).then(({ data }) => setInvoices(data)).catch(() => {});
  }, []);

  // عند اختيار الفاتورة الأصلية — جلب أسطرها تلقائياً
  const handleInvoiceSelect = async (invoiceId: string) => {
    setForm(f => ({ ...f, original_invoice_id: invoiceId }));
    if (!invoiceId) { setLines([emptyLine()]); return; }
    setLoadingLines(true);
    try {
      const { data: inv } = await getInvoice(invoiceId);
      if (inv.lines && inv.lines.length > 0) {
        setLines(inv.lines.map((l: any) => {
          const original_serial_ids = parseSerialIds(l);
          return {
            original_invoice_line_id: l.id,
            original_serial_ids,
            return_serial_ids: [],
            picked: {
              mode: l.inventory_item_id ? (original_serial_ids.length ? "serial" : "item") : "free",
              description_ar: l.description_ar,
              unit_price: Number(l.unit_price),
              quantity: original_serial_ids.length ? 0 : Number(l.quantity),
              inventory_item_id: l.inventory_item_id || undefined,
              serial_item_id: l.serial_item_id || undefined,
              item_name: l.description_ar,
            },
            vat_rate: String(l.vat_rate || 15),
          };
        }));
      }
    } catch { setLines([emptyLine()]); }
    finally { setLoadingLines(false); }
  };

  const setPicked = (i: number, picked: PickedItem) => setLines(p => p.map((l, idx) => idx === i ? { ...l, picked } : l));
  const setVat = (i: number, v: string) => setLines(p => p.map((l, idx) => idx === i ? { ...l, vat_rate: v } : l));
  const addLine = () => setLines(p => [...p, emptyLine()]);
  const removeLine = (i: number) => { if (lines.length > 1) setLines(p => p.filter((_, idx) => idx !== i)); };
  const toggleReturnSerial = (index: number, serialId: string) => setLines(prev => prev.map((line, i) => {
    if (i !== index) return line;
    const selected = new Set<string>(line.return_serial_ids || []);
    selected.has(serialId) ? selected.delete(serialId) : selected.add(serialId);
    const return_serial_ids = Array.from(selected);
    return { ...line, return_serial_ids, picked: { ...line.picked, quantity: return_serial_ids.length } };
  }));

  const totals = lines.reduce((acc, l) => {
    const c = calcLine(l);
    return { taxable: acc.taxable + c.taxable, vat: acc.vat + c.vatAmt, total: acc.total + c.total };
  }, { taxable: 0, vat: 0, total: 0 });

  const handleSave = async () => {
    if (!form.original_invoice_id) return alert(ar ? "اختر الفاتورة الأصلية" : "Select original invoice");
    if (!form.reason) return alert(ar ? "أدخل سبب الإشعار" : "Enter reason");
    if (lines.some(l => !l.original_invoice_line_id)) return alert(ar ? "اختر فاتورة أصلية ولا تضف أسطرًا خارجها" : "Select an original invoice and use its lines only");
    if (lines.some(l => !l.picked.description_ar || Number(l.picked.quantity || 0) <= 0)) return alert(ar ? "حدد كمية مرتجعة صحيحة لكل سطر مختار" : "Choose a valid return quantity for each selected line");
    setSaving(true);
    try {
      await createCreditNote({
        ...form,
        issue_date: new Date(form.issue_date).toISOString(),
        lines: lines.map((l, i) => ({
          original_invoice_line_id: l.original_invoice_line_id,
          description_ar: l.picked.description_ar,
          line_order: i,
          quantity: l.picked.quantity || 1,
          unit_price: l.picked.unit_price || 0,
          discount_pct: 0,
          vat_rate: parseFloat(l.vat_rate) || 15,
          inventory_item_id: l.picked.inventory_item_id || null,
          serial_item_id: l.picked.serial_item_id || null,
          serial_ids: (l.original_serial_ids || []).length ? l.return_serial_ids || [] : undefined,
        })),
      });
      router.push(`/${locale}/sales/credit-notes`);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/sales/credit-notes`}>{ar ? "مرتجعات المبيعات" : "Sales Returns"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "مرتجع جديد" : "New Return"}</span>
          </div>
          <h1 className="page-title">{ar ? "مرتجع مبيعات جديد" : "New Sales Return"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/sales/credit-notes`} className="btn btn-secondary btn-sm">{ar ? "إلغاء" : "Cancel"}</Link>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ المرتجع" : "Save Return")}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">{ar ? "بيانات المرتجع" : "Return Details"}</span></div>
        <div className="card-body">
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">{ar ? "الفاتورة الأصلية" : "Original Invoice"} <span className="required">*</span></label>
              <select className="form-input form-select" value={form.original_invoice_id}
                onChange={e => handleInvoiceSelect(e.target.value)}>
                <option value="">{ar ? "— اختر الفاتورة —" : "— Select Invoice —"}</option>
                {invoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} — {inv.buyer_name_ar} ({fmt(inv.total)} SAR)
                  </option>
                ))}
              </select>
              {loadingLines && <p className="form-hint">{ar ? "جاري جلب أسطر الفاتورة..." : "Loading invoice lines..."}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "تاريخ المرتجع" : "Return Date"}</label>
              <input type="date" className="form-input" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "سبب الإرجاع" : "Return Reason"} <span className="required">*</span></label>
              <input className="form-input" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={ar ? "سبب إرجاع البضاعة..." : "Reason for return..."} />
            </div>
          </div>
        </div>
      </div>

      {form.original_invoice_id && (
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 12, color: "#1E40AF" }}>
          {ar ? "تم جلب أسطر الفاتورة الأصلية — يمكنك تعديل الكميات أو حذف الأسطر غير المُرجَعة." : "Invoice lines loaded — you can adjust quantities or remove lines that are not being returned."}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "أسطر المرتجع" : "Return Lines"}</span>
          <button className="btn btn-secondary btn-sm" onClick={addLine} disabled={Boolean(form.original_invoice_id)} title={form.original_invoice_id ? (ar ? "المرتجع مرتبط بأسطر الفاتورة المختارة" : "Returns must use the selected invoice lines") : undefined}>
            <Icon name="plus" size={14} /> {ar ? "إضافة سطر" : "Add Line"}
          </button>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>{ar ? "الصنف / الوصف" : "Item / Description"} <span style={{ color: "var(--danger)" }}>*</span></th>
                <th style={{ width: 80 }}>{ar ? "الكمية" : "Qty"}</th>
                <th style={{ minWidth: 155 }}>{ar ? "السيريالات المعادة" : "Returned serials"}</th>
                <th style={{ width: 110 }}>{ar ? "سعر الوحدة" : "Unit Price"}</th>
                <th style={{ width: 90 }}>{ar ? "الضريبة%" : "VAT%"}</th>
                <th style={{ width: 110, textAlign: "end" }}>{ar ? "قبل الضريبة" : "Taxable"}</th>
                <th style={{ width: 100, textAlign: "end" }}>{ar ? "الضريبة" : "VAT"}</th>
                <th style={{ width: 110, textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const c = calcLine(line);
                return (
                  <tr key={i}>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <ItemPicker locale={locale} value={line.picked} onChange={p => setPicked(i, p)} purchaseMode={false} />
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input type="number" className="form-input" style={{ width: 70 }} value={line.picked.quantity} min="0"
                        disabled={(line.original_serial_ids || []).length > 0}
                        onChange={e => setPicked(i, { ...line.picked, quantity: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      {(line.original_serial_ids || []).length ? <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{line.original_serial_ids!.map(serialId => <label key={serialId} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, cursor: "pointer" }}><input type="checkbox" checked={(line.return_serial_ids || []).includes(serialId)} onChange={() => toggleReturnSerial(i, serialId)} /><span style={{ fontFamily: "monospace" }}>{serialId}</span></label>)}</div> : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{ar ? "لا ينطبق" : "N/A"}</span>}
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input type="number" className="form-input" style={{ width: 100 }} value={line.picked.unit_price} min="0"
                        onChange={e => setPicked(i, { ...line.picked, unit_price: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input type="number" className="form-input" style={{ width: 70 }} value={line.vat_rate} min="0" max="100" onChange={e => setVat(i, e.target.value)} />
                    </td>
                    <td style={{ textAlign: "end", fontWeight: 500, verticalAlign: "top", paddingTop: 12 }}>{fmt(c.taxable)}</td>
                    <td style={{ textAlign: "end", color: "var(--warning)", fontWeight: 500, verticalAlign: "top", paddingTop: 12 }}>{fmt(c.vatAmt)}</td>
                    <td style={{ textAlign: "end", fontWeight: 700, color: "#DC2626", verticalAlign: "top", paddingTop: 12 }}>{fmt(c.total)}</td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      {lines.length > 1 && <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => removeLine(i)}><Icon name="trash" size={14} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{ar ? "قبل الضريبة" : "Taxable"}</span>
              <span>{fmt(totals.taxable)} SAR</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--warning)" }}>
              <span>{ar ? "ضريبة القيمة المضافة 15%" : "VAT 15%"}</span>
              <span>{fmt(totals.vat)} SAR</span>
            </div>
            <div style={{ height: 1, background: "var(--border)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}>
              <span>{ar ? "إجمالي المرتجع" : "Return Total"}</span>
              <span style={{ color: "#DC2626" }}>{fmt(totals.total)} SAR</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
