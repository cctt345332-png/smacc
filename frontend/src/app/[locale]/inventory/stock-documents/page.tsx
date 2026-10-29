"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createStockDocument, getItems, getStockDocument, getStockDocuments, getWarehouses } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";

const REASONS = [
  ["damage", "تالف"],
  ["external_transfer", "نقل إلى جهة خارجية"],
  ["internal_use", "استخدام داخلي"],
  ["inventory_adjustment", "جرد / تسوية"],
  ["return", "إرجاع"],
  ["other", "أخرى"],
];

const blankLine = () => ({ item_id: "", quantity: "", unit_cost: "", serialText: "" });

export default function StockDocumentsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [lines, setLines] = useState<any[]>([blankLine()]);
  const [reason, setReason] = useState("other");
  const [destinationName, setDestinationName] = useState("");
  const [notes, setNotes] = useState("");
  const [documents, setDocuments] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const loadDocuments = async () => {
    try { setDocuments((await getStockDocuments({ limit: 100 })).data || []); } catch { /* ignore */ }
  };
  useEffect(() => {
    Promise.all([getItems({ limit: 500 }), getWarehouses()]).then(([itemsRes, warehousesRes]) => {
      const itemData = itemsRes.data;
      setItems(Array.isArray(itemData) ? itemData : (itemData?.items || []));
      const warehouseData = warehousesRes.data;
      setWarehouses(Array.isArray(warehouseData) ? warehouseData : (warehouseData?.items || []));
    }).catch(() => setMessage({ ok: false, text: ar ? "تعذر تحميل الأصناف والمستودعات" : "Unable to load items and warehouses" }));
    loadDocuments();
  }, [ar]);

  const selectedWarehouse = useMemo(() => warehouses.find(w => w.id === warehouseId), [warehouses, warehouseId]);
  const updateLine = (index: number, key: string, value: string) => setLines(prev => prev.map((line, i) => i === index ? { ...line, [key]: value } : line));
  const lineSerials = (line: any) => String(line.serialText || "").split(/[\n,\t]+/).map(v => v.trim()).filter(Boolean);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!warehouseId) return setMessage({ ok: false, text: ar ? "اختر المستودع أولاً" : "Select a warehouse first" });
    const payloadLines = lines.filter(line => line.item_id).map(line => {
      const item = items.find(i => i.id === line.item_id);
      const serials = item?.tracking_type === "serial" ? lineSerials(line) : [];
      return { item_id: line.item_id, quantity: serials.length || Number(line.quantity || 0), unit_cost: Number(line.unit_cost || item?.cost_price || 0), serial_numbers: serials };
    });
    if (!payloadLines.length) return setMessage({ ok: false, text: ar ? "أضف صنفاً واحداً على الأقل" : "Add at least one item" });
    for (const line of payloadLines) {
      const item = items.find(i => i.id === line.item_id);
      if (item?.tracking_type === "serial" && !line.serial_numbers?.length) return setMessage({ ok: false, text: ar ? "أدخل سيريالات كل صنف سيريال" : "Enter serials for every serial item" });
      if (item?.tracking_type !== "serial" && line.quantity <= 0) return setMessage({ ok: false, text: ar ? "يجب أن تكون الكمية أكبر من صفر" : "Quantity must be greater than zero" });
    }
    setBusy(true);
    try {
      const { data } = await createStockDocument({ direction, warehouse_id: warehouseId, items: payloadLines, reason, destination_name: destinationName, notes });
      setMessage({ ok: true, text: ar ? `تم حفظ ${data.document_number} بنجاح` : `${data.document_number} saved successfully` });
      setLines([blankLine()]); setNotes(""); setDestinationName("");
      await loadDocuments();
      setSelected(data);
    } catch (error: any) {
      setMessage({ ok: false, text: error?.response?.data?.detail || (ar ? "تعذر حفظ سند المخزون" : "Unable to save stock document") });
    } finally { setBusy(false); }
  };

  const openDocument = async (id: string) => { try { setSelected((await getStockDocument(id)).data); } catch { setMessage({ ok: false, text: ar ? "تعذر تحميل تفاصيل السند" : "Unable to load document" }); } };
  const printDocument = (doc: any) => {
    const win = window.open("", "_blank"); if (!win) return;
    const rows = (doc.lines || []).flatMap((line: any) => {
      const serials = Array.isArray(line.serial_numbers) ? line.serial_numbers : [];
      if (!serials.length) return [`<tr><td>${escapeHtml(line.line_no)}</td><td>${escapeHtml(line.item_name)}<small>${escapeHtml(line.item_sku || "")}</small></td><td>${escapeHtml(line.quantity)}</td><td>—</td><td>${escapeHtml(Number(line.total_value || 0).toFixed(2))}</td></tr>`];
      return serials.map((serial: string, serialIndex: number) => `<tr><td>${escapeHtml(`${line.line_no}.${serialIndex + 1}`)}</td><td>${escapeHtml(line.item_name)}<small>${escapeHtml(line.item_sku || "")}</small></td><td>1</td><td>${escapeHtml(serial)}</td><td>${escapeHtml((Number(line.total_value || 0) / serials.length).toFixed(2))}</td></tr>`);
    }).join("");
    win.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(doc.document_number)}</title><style>body{font-family:Arial,Cairo,sans-serif;color:#29132f;margin:28px}header{display:flex;justify-content:space-between;border-bottom:3px solid #4b0875;padding-bottom:12px}h1{color:#4b0875;margin:0}section{margin-top:18px;background:#f6f0f8;padding:10px;border:1px solid #d8c9df}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #cdbbd4;padding:8px;text-align:right}th{background:#eee5f2;color:#4b0875}small{display:block;color:#777;margin-top:3px}footer{margin-top:28px;border-top:1px solid #ddd;padding-top:10px;color:#666}@media print{button{display:none}}</style></head><body><header><div><h1>${escapeHtml(doc.direction_ar)}</h1><div>${escapeHtml(doc.document_number)}</div></div><div>التاريخ: ${escapeHtml(formatDate(doc.created_at))}</div></header><section><b>المستودع:</b> ${escapeHtml(doc.warehouse_name)} &nbsp; <b>السبب:</b> ${escapeHtml(doc.reason_ar)} ${doc.destination_name ? `&nbsp; <b>الوجهة:</b> ${escapeHtml(doc.destination_name)}` : ""}<br/>${doc.notes ? `<b>البيان:</b> ${escapeHtml(doc.notes)}` : ""}</section><table><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السيريالات</th><th>القيمة</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="2">الإجمالي</th><th>${escapeHtml(doc.total_quantity)}</th><th></th><th>${escapeHtml(Number(doc.total_value || 0).toFixed(2))}</th></tr></tfoot></table><footer>تم إنشاء هذا المستند من نظام مسار</footer><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
    win.document.close();
  };

  return <>
    <div className="page-header"><div><div className="breadcrumb"><Link href={`/${locale}/inventory`}>{ar ? "المخزون" : "Inventory"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "سندات المخزون" : "Stock Documents"}</span></div><h1 className="page-title">{ar ? "سندات المخزون" : "Stock Documents"}</h1><p className="page-subtitle">{ar ? "مستند واحد لعدة أصناف مع سبب ووجهة وتتبع وطباعة" : "Multi-item documents with reason, destination, tracking and printing"}</p></div><Link href={`/${locale}/inventory/movements`} className="btn btn-secondary"><Icon name="trending" size={15} /> {ar ? "حركات المخزون" : "Movements"}</Link></div>
    <div className="card"><div className="card-header"><span className="card-title">{ar ? "إنشاء سند مخزون" : "Create stock document"}</span></div><div className="card-body">
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}><button type="button" className={`btn ${direction === "in" ? "btn-primary" : "btn-secondary"}`} onClick={() => setDirection("in")}>{ar ? "إدخال مخزني" : "Stock input"}</button><button type="button" className="btn" onClick={() => setDirection("out")} style={{ background: direction === "out" ? "#DC2626" : "#FEE2E2", color: direction === "out" ? "#fff" : "#B91C1C" }}>{ar ? "إخراج مخزني" : "Stock output"}</button></div>
      {message && <div className={`alert ${message.ok ? "alert-success" : "alert-danger"}`} style={{ marginBottom: 14 }}>{message.text}</div>}
      <form onSubmit={submit}><div className="grid-2"><label className="form-group"><span className="form-label">{ar ? "المستودع" : "Warehouse"} *</span><select className="form-input form-select" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}><option value="">{ar ? "اختر المستودع" : "Select warehouse"}</option>{warehouses.map(w => <option key={w.id} value={w.id}>{ar ? w.name_ar : (w.name_en || w.name_ar)}</option>)}</select></label><label className="form-group"><span className="form-label">{ar ? "سبب السند" : "Reason"} *</span><select className="form-input form-select" value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(([value, label]) => <option key={value} value={value}>{ar ? label : value}</option>)}</select></label></div>
      {direction === "out" && <label className="form-group"><span className="form-label">{ar ? "الوجهة / الجهة الخارجية" : "Destination / external party"}</span><input className="form-input" value={destinationName} onChange={e => setDestinationName(e.target.value)} placeholder={ar ? "مثال: معرض خارج النظام، فني، جهة صيانة..." : "External showroom, technician, maintenance party..."} /></label>}
      <div style={{ display: "grid", gap: 10 }}>{lines.map((line, index) => { const item = items.find(i => i.id === line.item_id); const serial = item?.tracking_type === "serial"; return <div key={index} style={{ border: "1px solid #D8C9DF", borderRadius: 8, padding: 12, background: "#FCFAFD" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><strong>{ar ? `الصنف ${index + 1}` : `Item ${index + 1}`}</strong>{lines.length > 1 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLines(prev => prev.filter((_, i) => i !== index))}>{ar ? "حذف" : "Remove"}</button>}</div><div className="grid-2" style={{ marginTop: 8 }}><label className="form-group"><span className="form-label">{ar ? "الصنف" : "Item"} *</span><select className="form-input form-select" value={line.item_id} onChange={e => updateLine(index, "item_id", e.target.value)}><option value="">{ar ? "اختر الصنف" : "Select item"}</option>{items.map(i => <option key={i.id} value={i.id}>{i.name_ar}{i.sku ? ` — ${i.sku}` : ""}</option>)}</select></label>{serial ? <label className="form-group"><span className="form-label">{ar ? "السيريالات" : "Serials"} *</span><textarea className="form-input" rows={3} value={line.serialText} onChange={e => updateLine(index, "serialText", e.target.value)} placeholder={ar ? "سيريال لكل سطر" : "One serial per line"} /></label> : <div className="grid-2"><label className="form-group"><span className="form-label">{ar ? "الكمية" : "Quantity"} *</span><input className="form-input" type="number" min="0.001" step="0.001" value={line.quantity} onChange={e => updateLine(index, "quantity", e.target.value)} /></label><label className="form-group"><span className="form-label">{ar ? "تكلفة الوحدة" : "Unit cost"}</span><input className="form-input" type="number" min="0" step="0.0001" value={line.unit_cost} onChange={e => updateLine(index, "unit_cost", e.target.value)} placeholder={String(item?.cost_price || 0)} /></label></div>}</div></div>; })}</div><button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setLines(prev => [...prev, blankLine()])}>+ {ar ? "إضافة صنف آخر" : "Add another item"}</button>
      <label className="form-group" style={{ marginTop: 14 }}><span className="form-label">{ar ? "البيان / الملاحظات" : "Notes"}</span><textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder={ar ? "وضح سبب الإخراج أو مكان الجهة الخارجية" : "Explain the reason or external destination"} /></label><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}><button className="btn" disabled={busy} style={{ background: direction === "in" ? "#5A187E" : "#DC2626", color: "#fff" }}>{busy ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ السند" : "Save document")}</button></div></form>
    </div></div>

    <div className="card" style={{ marginTop: 18 }}><div className="card-header"><span className="card-title">{ar ? "سجل سندات المخزون" : "Stock document history"}</span></div><div className="table-wrapper"><table><thead><tr><th>{ar ? "رقم السند" : "Document"}</th><th>{ar ? "النوع" : "Type"}</th><th>{ar ? "المستودع" : "Warehouse"}</th><th>{ar ? "السبب" : "Reason"}</th><th>{ar ? "الأصناف" : "Items"}</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "إجراءات" : "Actions"}</th></tr></thead><tbody>{documents.map(doc => <tr key={doc.id}><td><strong>{doc.document_number}</strong></td><td>{doc.direction_ar}</td><td>{doc.warehouse_name}</td><td>{doc.reason_ar}</td><td>{doc.lines?.length || 0}</td><td>{formatDate(doc.created_at)}</td><td><button className="btn btn-secondary btn-sm" onClick={() => openDocument(doc.id)}>{ar ? "عرض" : "View"}</button></td></tr>)}{!documents.length && <tr><td colSpan={7} className="empty-state">{ar ? "لا توجد سندات محفوظة" : "No saved documents"}</td></tr>}</tbody></table></div></div>

    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 1120, width: "calc(100% - 32px)", maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div className="modal-header" style={{ alignItems: "center", gap: 16, background: selected.direction === "out" ? "#FFF7F7" : "#F8F3FB", borderBottom: `3px solid ${selected.direction === "out" ? "#DC2626" : "#5A187E"}` }}><div style={{ flex: 1 }}><div style={{ color: selected.direction === "out" ? "#B91C1C" : "#5A187E", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{selected.direction_ar}</div><h2 style={{ margin: 0, fontSize: 21 }}>{selected.document_number}</h2></div><div style={{ color: "#666", fontSize: 13 }}>{formatDate(selected.created_at)}</div><button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)} aria-label={ar ? "إغلاق" : "Close"}>×</button></div>
      <div className="modal-body" style={{ overflowY: "auto", padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 18 }}>
          <div style={detailBox}><span style={detailLabel}>{ar ? "المستودع" : "Warehouse"}</span><strong>{selected.warehouse_name || "—"}</strong></div>
          <div style={detailBox}><span style={detailLabel}>{ar ? "السبب" : "Reason"}</span><strong>{selected.reason_ar || "—"}</strong></div>
          {selected.destination_name && <div style={detailBox}><span style={detailLabel}>{ar ? "الوجهة / الجهة" : "Destination"}</span><strong>{selected.destination_name}</strong></div>}
          <div style={detailBox}><span style={detailLabel}>{ar ? "إجمالي الكمية" : "Total quantity"}</span><strong>{selected.total_quantity ?? "—"}</strong></div>
        </div>
        {selected.notes && <div style={{ background: "#FFFBEB", border: "1px solid #F3D58A", borderRadius: 8, padding: "10px 13px", marginBottom: 18 }}><span style={{ ...detailLabel, display: "block", marginBottom: 4 }}>{ar ? "البيان / الملاحظات" : "Notes"}</span><div style={{ whiteSpace: "pre-wrap" }}>{selected.notes}</div></div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}><h3 style={{ margin: 0, color: "#4B0875", fontSize: 16 }}>{ar ? "تفاصيل الأصناف" : "Item details"}</h3><span style={{ color: "#666", fontSize: 12 }}>{selected.lines?.length || 0} {ar ? "أصناف" : "items"}</span></div>
        <div className="table-wrapper" style={{ overflowX: "auto", border: "1px solid #D8C9DF", borderRadius: 8 }}><table style={{ minWidth: 760, tableLayout: "fixed" }}><thead><tr><th style={{ width: 48 }}>#</th><th style={{ width: "25%" }}>{ar ? "الصنف" : "Item"}</th><th style={{ width: 86 }}>{ar ? "الكمية" : "Quantity"}</th><th>{ar ? "السيريالات" : "Serials"}</th><th style={{ width: 110 }}>{ar ? "القيمة" : "Value"}</th></tr></thead><tbody>{selected.lines?.map((line: any) => <tr key={line.id} style={{ verticalAlign: "top" }}><td style={{ textAlign: "center", fontWeight: 700 }}>{line.line_no}</td><td><strong>{line.item_name}</strong><small style={{ display: "block", color: "#777", marginTop: 4 }}>{line.item_sku}</small></td><td style={{ textAlign: "center", fontWeight: 700 }}>{line.quantity}</td><td>{line.serial_numbers?.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6 }}>{line.serial_numbers.map((serial: string, index: number) => <div key={`${serial}-${index}`} style={{ background: "#F8F3FB", border: "1px solid #E5D8EB", borderRadius: 5, padding: "6px 8px", fontFamily: "monospace", fontSize: 12, direction: "ltr", textAlign: "left", overflowWrap: "anywhere" }}><span style={{ color: "#80618A", marginRight: 6 }}>{index + 1}.</span>{serial}</div>)}</div> : <span style={{ color: "#999" }}>—</span>}</td><td style={{ textAlign: "center" }}>{Number(line.total_value || 0).toFixed(2)}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>{ar ? "الإجمالي" : "Total"}</th><th style={{ textAlign: "center" }}>{selected.total_quantity ?? "—"}</th><th></th><th style={{ textAlign: "center" }}>{Number(selected.total_value || 0).toFixed(2)}</th></tr></tfoot></table></div>
      </div>
      <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><span style={{ color: "#777", fontSize: 12 }}>{ar ? "يمكن طباعة السند بالتنسيق الكامل" : "Print the document with full details"}</span><button className="btn btn-primary" onClick={() => printDocument(selected)}>🖨️ {ar ? "طباعة السند" : "Print document"}</button></div>
    </div></div>}
  </>;
}

const detailBox: React.CSSProperties = { background: "#FAF7FC", border: "1px solid #E5D8EB", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5, minWidth: 0 };
const detailLabel: React.CSSProperties = { color: "#80618A", fontSize: 11, fontWeight: 700 };
function escapeHtml(value: unknown) { return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c)); }
function formatDate(value: string) { return value ? new Date(value).toLocaleString("ar-SA") : "—"; }
