"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createDebitNote, getBills, getBill } from "@/lib/purchases";
import { Icon } from "@/components/ui/Icons";
import ItemPicker, { PickedItem } from "@/components/inventory/ItemPicker";
import ReturnSerialPicker from "@/components/inventory/ReturnSerialPicker";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const today = () => new Date().toISOString().split("T")[0];

interface Line {
  picked: PickedItem;
  vat_rate: string;
  // للسيريالات المُرجَعة
  return_serial_ids?: string[];
  return_serial_numbers?: string[];
  original_bill_line_id?: string;
  tracking_type?: string;
}

const emptyLine = (): Line => ({
  picked: { mode: "free", description_ar: "", unit_price: 0, quantity: 1 },
  vat_rate: "15",
});

function calcLine(l: Line) {
  const qty = (l.return_serial_ids && l.return_serial_ids.length > 0)
    ? l.return_serial_ids.length
    : (l.picked.quantity || 0);
  const price = l.picked.unit_price || 0;
  const vat = parseFloat(l.vat_rate) || 0;
  const taxable = qty * price;
  const vatAmt = taxable * vat / 100;
  return { taxable, vatAmt, total: taxable + vatAmt, qty };
}

export default function NewDebitNotePage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [bills, setBills] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [form, setForm] = useState({ original_bill_id: "", issue_date: today(), reason: "" });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  // modal اختيار السيريالات المُرجَعة
  const [serialPickerLine, setSerialPickerLine] = useState<number | null>(null);

  useEffect(() => {
    getBills({ status: "confirmed" }).then(({ data }) => setBills(data)).catch(() => {});
  }, []);

  // عند اختيار الفاتورة الواردة — جلب أسطرها تلقائياً
  const handleBillSelect = async (billId: string) => {
    setForm(f => ({ ...f, original_bill_id: billId }));
    if (!billId) { setLines([emptyLine()]); return; }
    setLoadingLines(true);
    try {
      const { data: bill } = await getBill(billId);
      if (bill.lines && bill.lines.length > 0) {
        setLines(bill.lines.map((l: any) => {
          const isSerial = l.new_serial_number || l.new_serial_numbers_json;
          return {
            picked: {
              mode: isSerial ? "serial" : (l.inventory_item_id ? "item" : "free"),
              description_ar: l.description_ar,
              unit_price: Number(l.unit_price),
              quantity: Number(l.quantity),
              inventory_item_id: l.inventory_item_id || undefined,
              item_name: l.description_ar,
            },
            vat_rate: String(l.vat_rate || 15),
            original_bill_line_id: l.id,
            tracking_type: isSerial ? "serial" : undefined,
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

  const totals = lines.reduce((acc, l) => {
    const c = calcLine(l);
    return { taxable: acc.taxable + c.taxable, vat: acc.vat + c.vatAmt, total: acc.total + c.total };
  }, { taxable: 0, vat: 0, total: 0 });

  const selectedBill = form.original_bill_id ? bills.find(b => b.id === form.original_bill_id) : null;

  const handleSave = async () => {
    if (!form.original_bill_id) return alert(ar ? "اختر الفاتورة الأصلية" : "Select original bill");
    if (!form.reason) return alert(ar ? "أدخل سبب الإشعار" : "Enter reason");
    if (lines.some(l => !l.picked.description_ar)) return alert(ar ? "أدخل وصف لكل الأسطر" : "Enter description for all lines");

    // التحقق من السيريالات المُرجَعة
    for (const l of lines) {
      if (l.tracking_type === "serial" && (!l.return_serial_ids || l.return_serial_ids.length === 0)) {
        alert(ar ? "يرجى تحديد السيريالات المُرجَعة لكل صنف مسرّل" : "Please select returned serials for each serial item");
        return;
      }
    }

    setSaving(true);
    try {
      await createDebitNote({
        ...form,
        issue_date: new Date(form.issue_date).toISOString(),
        lines: lines.map((l, i) => {
          const c = calcLine(l);
          return {
            description_ar: l.picked.description_ar,
            line_order: i,
            quantity: c.qty,
            unit_price: l.picked.unit_price || 0,
            vat_rate: parseFloat(l.vat_rate) || 15,
            inventory_item_id: l.picked.inventory_item_id || null,
            // السيريالات المُرجَعة
            serial_ids: (l.return_serial_ids && l.return_serial_ids.length > 0) ? l.return_serial_ids : null,
          };
        }),
      });
      router.push(`/${locale}/purchases/debit-notes`);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/purchases/debit-notes`}>{ar ? "مرتجعات المشتريات" : "Purchase Returns"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "مرتجع جديد" : "New Return"}</span>
          </div>
          <h1 className="page-title">{ar ? "مرتجع مشتريات جديد" : "New Purchase Return"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/purchases/debit-notes`} className="btn btn-secondary btn-sm">{ar ? "إلغاء" : "Cancel"}</Link>
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
              <label className="form-label">{ar ? "الفاتورة الواردة الأصلية" : "Original Bill"} <span className="required">*</span></label>
              <select className="form-input form-select" value={form.original_bill_id}
                onChange={e => handleBillSelect(e.target.value)}>
                <option value="">{ar ? "— اختر الفاتورة —" : "— Select Bill —"}</option>
                {bills.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bill_number} — {b.vendor_name_ar || b.vendor?.name_ar} ({fmt(b.total)} SAR)
                  </option>
                ))}
              </select>
              {loadingLines && <p className="form-hint">{ar ? "جاري جلب أسطر الفاتورة..." : "Loading bill lines..."}</p>}
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "تاريخ الإشعار" : "Issue Date"}</label>
              <input type="date" className="form-input" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "سبب الإرجاع" : "Return Reason"} <span className="required">*</span></label>
              <input className="form-input" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={ar ? "سبب إرجاع البضاعة..." : "Reason for return..."} />
            </div>
          </div>
        </div>
      </div>

      {form.original_bill_id && (
        <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 12, color: "#5B21B6" }}>
          {ar ? "تم جلب أسطر الفاتورة الواردة — للأصناف المسرّلة اختر السيريالات المُرجَعة، وللأصناف العادية عدّل الكميات أو احذف الأسطر غير المُرجَعة." : "Bill lines loaded — for serial items select returned serials, for regular items adjust quantities or remove lines not being returned."}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "أسطر المرتجع" : "Return Lines"}</span>
          <button className="btn btn-secondary btn-sm" onClick={addLine}>
            <Icon name="plus" size={14} /> {ar ? "إضافة سطر" : "Add Line"}
          </button>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: 240 }}>{ar ? "الصنف / الوصف" : "Item / Description"} <span style={{ color: "var(--danger)" }}>*</span></th>
                <th style={{ width: 90 }}>{ar ? "الكمية" : "Qty"}</th>
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
                const isSerialLine = line.tracking_type === "serial" || line.picked.mode === "serial";
                return (
                  <tr key={i}>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <ItemPicker locale={locale} value={line.picked} onChange={p => setPicked(i, p)} purchaseMode={false} />

                      {/* اختيار السيريالات المُرجَعة */}
                      {isSerialLine && line.picked.inventory_item_id && (
                        <div style={{ marginTop: 6 }}>
                          {line.return_serial_ids && line.return_serial_ids.length > 0 ? (
                            <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "6px 10px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>
                                  ↩️ {line.return_serial_ids.length} {ar ? "سيريال مُرجَع" : "returned serials"}
                                </span>
                                <button type="button" onClick={() => setSerialPickerLine(i)}
                                  style={{ background: "none", border: "1px solid #D97706", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#D97706", cursor: "pointer" }}>
                                  {ar ? "تعديل" : "Edit"}
                                </button>
                              </div>
                              {line.return_serial_numbers && (
                                <div style={{ marginTop: 4, fontSize: 10, color: "#92400E", fontFamily: "monospace" }}>
                                  {line.return_serial_numbers.slice(0, 3).join(" · ")}
                                  {line.return_serial_numbers.length > 3 && ` +${line.return_serial_numbers.length - 3}`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button type="button" onClick={() => setSerialPickerLine(i)}
                              style={{
                                width: "100%", padding: "8px", borderRadius: 8, border: "2px dashed #FCA5A5",
                                background: "#FEF2F2", color: "#DC2626", fontWeight: 600, fontSize: 12,
                                cursor: "pointer", textAlign: "center",
                              }}>
                              ↩️ {ar ? "تحديد السيريالات المُرجَعة" : "Select Returned Serials"}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                      <input
                        type="number" className="form-input" style={{ width: 70 }}
                        value={c.qty} min="0"
                        disabled={isSerialLine}
                        readOnly={isSerialLine}
                        onChange={e => !isSerialLine && setPicked(i, { ...line.picked, quantity: parseFloat(e.target.value) || 1 })}
                      />
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
                    <td style={{ textAlign: "end", fontWeight: 700, color: "#7C3AED", verticalAlign: "top", paddingTop: 12 }}>{fmt(c.total)}</td>
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
              <span>{ar ? "إجمالي الإشعار" : "Debit Note Total"}</span>
              <span style={{ color: "#7C3AED" }}>{fmt(totals.total)} SAR</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal اختيار السيريالات المُرجَعة */}
      {serialPickerLine !== null && lines[serialPickerLine]?.picked.inventory_item_id && (
        <ReturnSerialPicker
          locale={locale}
          productId={lines[serialPickerLine].picked.inventory_item_id!}
          productName={lines[serialPickerLine].picked.item_name || lines[serialPickerLine].picked.description_ar}
          billId={form.original_bill_id}
          selectedIds={lines[serialPickerLine].return_serial_ids || []}
          onConfirm={(selected) => {
            setLines(prev => prev.map((l, idx) => idx === serialPickerLine ? {
              ...l,
              return_serial_ids: selected.map(s => s.id),
              return_serial_numbers: selected.map(s => s.serial_number),
            } : l));
            setSerialPickerLine(null);
          }}
          onClose={() => setSerialPickerLine(null)}
        />
      )}
    </>
  );
}
