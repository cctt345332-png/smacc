"use client";
/**
 * صفحة فاتورة جديدة للمندوب
 * - تحمّل العملاء والأصناف من مخزونه الخاص فقط
 * - تُرسل الفاتورة عبر sales API — يُرفق rep_id تلقائياً في البايكند
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCustomers, createInvoice, confirmInvoice } from "@/lib/sales";
import { getMyStock } from "@/lib/reps";

const today = () => new Date().toISOString().split("T")[0];
const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

interface Line {
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  vat_rate: number;
  max_qty: number;
}

function calcLine(l: Line) {
  const gross = l.quantity * l.unit_price;
  const disc = gross * (l.discount_pct / 100);
  const taxable = gross - disc;
  const tax = taxable * (l.vat_rate / 100);
  return { gross, disc, taxable, tax, total: taxable + tax };
}

export default function RepNewInvoicePage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const router = useRouter();

  const [customers, setCustomers] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    customer_id: "",
    issue_date: today(),
    supply_date: today(),
    due_date: "",
    notes: "",
  });

  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    Promise.all([getCustomers(), getMyStock()])
      .then(([cRes, sRes]) => {
        setCustomers(Array.isArray(cRes.data) ? cRes.data : []);
        const stockItems = Array.isArray(sRes.data) ? sRes.data : [];
        setStock(stockItems);
      })
      .catch(() => {});
  }, []);
  const addLine = (stockItem: any) => {
    if (lines.find((l) => l.item_id === stockItem.item_id)) return;
    setLines((prev) => [
      ...prev,
      {
        item_id: stockItem.item_id,
        item_name: stockItem.item_name || stockItem.name_ar,
        quantity: 1,
        unit_price: Number(stockItem.sale_price || 0),
        discount_pct: 0,
        vat_rate: 15,
        max_qty: Number(stockItem.quantity || 0),
      },
    ]);
  };

  const removeLine = (idx: number) => setLines((p) => p.filter((_, i) => i !== idx));

  const updateLine = (idx: number, key: keyof Line, val: any) => {
    setLines((p) => p.map((l, i) => (i === idx ? { ...l, [key]: val } : l)));
  };

  // ─── حساب الإجماليات ──────────────────────────────────────────────
  const totals = lines.reduce(
    (acc, l) => {
      const c = calcLine(l);
      return {
        subtotal: acc.subtotal + c.gross,
        discount: acc.discount + c.disc,
        vat: acc.vat + c.tax,
        total: acc.total + c.total,
      };
    },
    { subtotal: 0, discount: 0, vat: 0, total: 0 }
  );

  // ─── إرسال الفاتورة ───────────────────────────────────────────────
  const handleSubmit = async (confirm: boolean) => {
    if (!form.customer_id) return setError(ar ? "اختر العميل" : "Select a customer");
    if (lines.length === 0) return setError(ar ? "أضف صنفاً على الأقل" : "Add at least one item");
    for (const l of lines) {
      if (l.quantity > l.max_qty) {
        return setError(
          ar
            ? `الكمية المطلوبة (${l.quantity}) أكبر من المتاح (${l.max_qty}) للصنف: ${l.item_name}`
            : `Quantity (${l.quantity}) exceeds available stock (${l.max_qty}) for: ${l.item_name}`
        );
      }
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        customer_id: form.customer_id,
        invoice_type: "simplified",
        issue_date: new Date(form.issue_date).toISOString(),
        supply_date: new Date(form.supply_date).toISOString(),
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        notes: form.notes,
        lines: lines.map((l) => ({
          description_ar: l.item_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct,
          vat_rate: l.vat_rate,
          vat_category: "S",
          inventory_item_id: l.item_id,
        })),
      };

      const res = await createInvoice(payload as any);
      const inv = res.data;
      if (!inv?.id) throw new Error(inv?.detail || "خطأ في إنشاء الفاتورة");

      if (confirm) {
        await confirmInvoice(inv.id);
      }
      router.push(`/${locale}/reps/invoices`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "فاتورة جديدة" : "New Invoice"}</h1>
          <p className="page-subtitle">
            {ar ? "إصدار فاتورة من مخزونك الخاص" : "Issue invoice from your own stock"}
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            color: "#DC2626",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
        {/* ─── بيانات الفاتورة ─────────────────────────────── */}
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
              {ar ? "بيانات الفاتورة" : "Invoice Details"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  {ar ? "العميل *" : "Customer *"}
                </label>
                <select
                  className="input"
                  value={form.customer_id}
                  onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
                >
                  <option value="">{ar ? "اختر العميل..." : "Select customer..."}</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name_ar}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  {ar ? "تاريخ الفاتورة" : "Issue Date"}
                </label>
                <input
                  type="date"
                  className="input"
                  value={form.issue_date}
                  onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value, supply_date: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  {ar ? "تاريخ الاستحقاق" : "Due Date"}
                </label>
                <input
                  type="date"
                  className="input"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                  {ar ? "ملاحظات" : "Notes"}
                </label>
                <input
                  className="input"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={ar ? "ملاحظات اختيارية..." : "Optional notes..."}
                />
              </div>
            </div>
          </div>

          {/* ─── اختيار الأصناف من المخزون ────────────────────── */}
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
              {ar ? "اختر من مخزونك" : "Select from your stock"}
            </div>
            {stock.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "12px 0" }}>
                {ar ? "لا يوجد مخزون متاح لديك" : "No stock available"}
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {stock.map((s: any) => {
                  const already = lines.some((l) => l.item_id === s.item_id);
                  return (
                    <button
                      key={s.item_id}
                      onClick={() => addLine(s)}
                      disabled={already || Number(s.quantity) <= 0}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: `1px solid ${already ? "#059669" : "var(--border)"}`,
                        background: already ? "#F0FDF4" : "var(--bg)",
                        color: already ? "#059669" : "var(--text)",
                        cursor: already || Number(s.quantity) <= 0 ? "not-allowed" : "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        opacity: Number(s.quantity) <= 0 ? 0.4 : 1,
                      }}
                    >
                      {s.item_name || s.name_ar}
                      <span style={{ marginInlineStart: 6, opacity: 0.6 }}>({fmt(s.quantity)})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── أسطر الفاتورة ─────────────────────────────────── */}
          {lines.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "الصنف" : "Item"}</th>
                      <th style={{ width: 100 }}>{ar ? "الكمية" : "Qty"}</th>
                      <th style={{ width: 120 }}>{ar ? "السعر" : "Price"}</th>
                      <th style={{ width: 90 }}>{ar ? "خصم%" : "Disc%"}</th>
                      <th style={{ width: 90 }}>{ar ? "ضريبة%" : "VAT%"}</th>
                      <th style={{ textAlign: "end", width: 130 }}>{ar ? "الإجمالي" : "Total"}</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const c = calcLine(l);
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>
                            {l.item_name}
                            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>
                              {ar ? "متاح:" : "Avail:"} {fmt(l.max_qty)}
                            </div>
                          </td>
                          <td>
                            <input
                              type="number"
                              className="input"
                              style={{ width: 80, fontSize: 13 }}
                              min={1}
                              max={l.max_qty}
                              value={l.quantity}
                              onChange={(e) => updateLine(i, "quantity", Math.max(1, Number(e.target.value)))}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="input"
                              style={{ width: 100, fontSize: 13 }}
                              value={l.unit_price}
                              onChange={(e) => updateLine(i, "unit_price", Number(e.target.value))}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="input"
                              style={{ width: 70, fontSize: 13 }}
                              min={0}
                              max={100}
                              value={l.discount_pct}
                              onChange={(e) => updateLine(i, "discount_pct", Number(e.target.value))}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="input"
                              style={{ width: 70, fontSize: 13 }}
                              value={l.vat_rate}
                              onChange={(e) => updateLine(i, "vat_rate", Number(e.target.value))}
                            />
                          </td>
                          <td style={{ textAlign: "end", fontWeight: 700, color: "#2563EB" }}>
                            {fmt(c.total)} SAR
                          </td>
                          <td>
                            <button
                              onClick={() => removeLine(i)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#DC2626",
                                fontSize: 16,
                                padding: 4,
                              }}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ─── الملخص والأزرار ─────────────────────────────────── */}
        <div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
              {ar ? "ملخص الفاتورة" : "Invoice Summary"}
            </div>
            {[
              { label: ar ? "المبلغ قبل الخصم" : "Subtotal", value: totals.subtotal },
              { label: ar ? "الخصم" : "Discount", value: totals.discount, color: "#DC2626" },
              { label: ar ? "ضريبة القيمة المضافة" : "VAT", value: totals.vat },
            ].map((row) => (
              <div
                key={row.label}
                style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}
              >
                <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
                <span style={{ fontWeight: 600, color: row.color }}>
                  {fmt(row.value)} SAR
                </span>
              </div>
            ))}
            <div
              style={{
                borderTop: "2px solid var(--border)",
                paddingTop: 12,
                marginTop: 4,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              <span>{ar ? "الإجمالي" : "Total"}</span>
              <span style={{ color: "#2563EB" }}>{fmt(totals.total)} SAR</span>
            </div>

            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ width: "100%" }}
                onClick={() => handleSubmit(true)}
                disabled={saving}
              >
                {saving ? "..." : ar ? "حفظ وتأكيد" : "Save & Confirm"}
              </button>
              <button
                className="btn btn-secondary"
                style={{ width: "100%" }}
                onClick={() => handleSubmit(false)}
                disabled={saving}
              >
                {ar ? "حفظ كمسودة" : "Save as Draft"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
