"use client";

import { useEffect, use, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { getSerialMovementsReport, getWarehouses, getItems } from "@/lib/inventory";
import { getBills } from "@/lib/purchases";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";
import SearchableSelect from "@/components/ui/SearchableSelect";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const TYPES = [
  { value: "purchase", ar: "شراء", en: "Purchase" },
  { value: "sale", ar: "بيع", en: "Sale" },
  { value: "return_in", ar: "مرتجع وارد", en: "Purchase return" },
  { value: "return_out", ar: "مرتجع صادر", en: "Sales return" },
  { value: "transfer", ar: "تحويل", en: "Transfer" },
  { value: "adjustment", ar: "جرد/تسوية", en: "Adjustment" },
  { value: "damage", ar: "تلف", en: "Damage" },
  { value: "purchase_edit_rev", ar: "عكس شراء", en: "Purchase reversal" },
];

const STATUS_OPTIONS = [
  { value: "in_stock", ar: "في المخزون", en: "In stock" },
  { value: "sold", ar: "مباع", en: "Sold" },
  { value: "reserved", ar: "محجوز", en: "Reserved" },
  { value: "damaged", ar: "تالف", en: "Damaged" },
  { value: "returned", ar: "مرتجع", en: "Returned" },
];

const statusClass: Record<string, string> = {
  in_stock: "badge-success", sold: "badge-info", reserved: "badge-warning", damaged: "badge-danger", returned: "badge-gray",
};

const statusLabel = (value: string, ar: boolean) => {
  const found = STATUS_OPTIONS.find(s => s.value === value);
  return found ? (ar ? found.ar : found.en) : value || "—";
};

const typeClass: Record<string, string> = {
  purchase: "badge-success", sale: "badge-info", return_in: "badge-warning", return_out: "badge-warning",
  transfer: "badge-info", adjustment: "badge-gray", damage: "badge-danger", purchase_edit_rev: "badge-danger",
};

const typeLabel = (value: string, ar: boolean) => {
  const found = TYPES.find(t => t.value === value);
  return found ? (ar ? found.ar : found.en) : value || "—";
};

export default function SerialMovementsReportPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState({ count: 0, total_in: 0, total_out: 0, net_value: 0, current_stock_count: 0, current_sold_count: 0, current_reserved_count: 0, current_damaged_count: 0, current_returned_count: 0 });
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [warehouseId, setWarehouseId] = useState("");
  const [billId, setBillId] = useState("");
  const [productId, setProductId] = useState("");
  const [movementType, setMovementType] = useState("");
  const [serialStatus, setSerialStatus] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 5000 };
      if (warehouseId) params.warehouse_id = warehouseId;
      if (billId) params.bill_id = billId;
      if (productId) params.product_id = productId;
      if (movementType) params.movement_type = movementType;
      if (serialStatus) params.serial_status = serialStatus;
      if (serialNumber.trim()) params.serial_number = serialNumber.trim();
      if (invoiceNumber.trim()) params.invoice_number = invoiceNumber.trim();
      if (fromDate) params.from_date = `${fromDate}T00:00:00`;
      if (toDate) params.to_date = `${toDate}T23:59:59`;
      const { data } = await getSerialMovementsReport(params);
      setRows(data?.rows || []);
      setSummary(data?.summary || { count: 0, total_in: 0, total_out: 0, net_value: 0, current_stock_count: 0, current_sold_count: 0, current_reserved_count: 0, current_damaged_count: 0, current_returned_count: 0 });
    } catch {
      setRows([]);
      setSummary({ count: 0, total_in: 0, total_out: 0, net_value: 0, current_stock_count: 0, current_sold_count: 0, current_reserved_count: 0, current_damaged_count: 0, current_returned_count: 0 });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    Promise.all([getWarehouses(), getItems({}), getBills()]).then(([w, i, b]) => {
      setWarehouses(w.data || []);
      setItems(i.data || []);
      setBills(b.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [warehouseId, billId, productId, movementType, serialStatus, serialNumber, invoiceNumber, fromDate, toDate]);

  const exportExcel = () => {
    if (!rows.length) return;
    const exportRows = rows.map((row: any, index: number) => ({
      "#": index + 1,
      [ar ? "التاريخ" : "Date"]: row.created_at ? new Date(row.created_at).toLocaleString("en-SA") : "",
      [ar ? "رقم السيريال" : "Serial Number"]: row.serial_number || "",
      [ar ? "الصنف" : "Product"]: row.product_name || "",
      [ar ? "SKU" : "SKU"]: row.product_sku || "",
      [ar ? "المستودع" : "Warehouse"]: row.warehouse_name || "",
      [ar ? "المستودع المحول إليه" : "Destination Warehouse"]: row.to_warehouse_name || "",
      [ar ? "نوع الحركة" : "Movement"]: row.movement_type_ar || typeLabel(row.movement_type, ar),
      [ar ? "الكمية" : "Quantity"]: Number(row.quantity || 0),
      [ar ? "التكلفة" : "Unit Cost"]: Number(row.unit_cost || 0),
      [ar ? "القيمة" : "Value"]: Number(row.total_value || 0),
      [ar ? "فاتورة المشتريات" : "Purchase Bill"]: row.bill_number || "",
      [ar ? "فاتورة البيع" : "Sales Invoice"]: row.invoice_number || "",
      [ar ? "المورد" : "Vendor"]: row.vendor_name || "",
      [ar ? "حالة السيريال" : "Serial Status"]: statusLabel(row.serial_status, ar),
      [ar ? "الملاحظات" : "Notes"]: row.notes || "",
    }));
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    sheet["!cols"] = [
      { wch: 6 }, { wch: 21 }, { wch: 23 }, { wch: 34 }, { wch: 15 }, { wch: 26 }, { wch: 26 },
      { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 14 },       { wch: 18 }, { wch: 20 }, { wch: 26 }, { wch: 18 }, { wch: 32 },

    ];
    XLSX.utils.book_append_sheet(workbook, sheet, "Serial Movements");
    XLSX.writeFile(workbook, `serial-movements-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const clearFilters = () => {
    setWarehouseId(""); setBillId(""); setProductId(""); setMovementType(""); setSerialStatus(""); setSerialNumber(""); setInvoiceNumber(""); setFromDate(""); setToDate("");
  };

  const printRows = rows.map((row: any) => [
    row.created_at ? new Date(row.created_at).toLocaleString("en-SA") : "—",
    row.serial_number || "—", row.product_name || "—", row.warehouse_name || "—",
    row.movement_type_ar || typeLabel(row.movement_type, ar), Number(row.quantity || 0).toLocaleString("en-US"),
    `${fmt(row.unit_cost)} SAR`, `${fmt(row.total_value)} SAR`, row.bill_number || row.invoice_number || "—", statusLabel(row.serial_status, ar),
  ]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports/inventory`}>{ar ? "تقارير المخزون" : "Inventory Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "حركة السيريالات" : "Serial Movements"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقرير حركة السيريالات" : "Serial Movement Report"}</h1>
          <p className="page-subtitle">{ar ? "سجل تفصيلي لكل حركة سيريال مع المستودع وفاتورة المشتريات والصنف" : "Detailed history of every serial movement with warehouse, purchase bill, and product"}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-sm" onClick={exportExcel} disabled={!rows.length}>{ar ? "تصدير Excel" : "Export Excel"}</button>
          <StructuredReportPrintButton locale={locale} title={ar ? "تقرير حركة السيريالات" : "Serial Movement Report"} subtitle={ar ? "حركات السيريالات حسب الفلاتر المحددة" : "Serial movements for selected filters"} period={`${fromDate || (ar ? "البداية" : "Start")} — ${toDate || (ar ? "النهاية" : "End")}`} reportCode={`SER-MOV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`} orientation="landscape" metrics={[] } tables={[{ title: ar ? "تفاصيل حركة السيريالات" : "Serial movement details", headers: [ar ? "التاريخ" : "Date", ar ? "السيريال" : "Serial", ar ? "الصنف" : "Product", ar ? "المستودع" : "Warehouse", ar ? "الحركة" : "Movement", ar ? "الكمية" : "Qty", ar ? "التكلفة" : "Cost", ar ? "القيمة" : "Value", ar ? "المستند" : "Document", ar ? "الحالة" : "Status"], rows: printRows }]} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "14px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <SearchableSelect locale={locale} style={{ width: 190 }} value={warehouseId} onChange={setWarehouseId} placeholder={ar ? "ابحث عن المستودع..." : "Search warehouse..."} options={[{ value: "", label: ar ? "كل المستودعات" : "All Warehouses" }, ...warehouses.map(w => ({ value: w.id, label: w.name_ar, searchText: `${w.name_ar || ""} ${w.name_en || ""}` }))]} />
          <SearchableSelect locale={locale} style={{ width: 230 }} value={billId} onChange={setBillId} placeholder={ar ? "ابحث عن الفاتورة..." : "Search bill..."} options={[{ value: "", label: ar ? "كل فواتير المشتريات" : "All Purchase Bills" }, ...bills.map(b => ({ value: b.id, label: `${b.bill_number}${b.vendor_name_ar ? ` — ${b.vendor_name_ar}` : ""}`, searchText: `${b.bill_number || ""} ${b.vendor_name_ar || ""}` }))]} />
          <SearchableSelect locale={locale} style={{ width: 220 }} value={productId} onChange={setProductId} placeholder={ar ? "ابحث عن الصنف..." : "Search product..."} options={[{ value: "", label: ar ? "كل الأصناف" : "All Products" }, ...items.filter(i => i.tracking_type === "serial").map(i => ({ value: i.id, label: i.name_ar, searchText: `${i.sku || ""} ${i.name_ar || ""}` }))]} />
          <select className="form-input form-select" style={{ width: 160 }} value={movementType} onChange={e => setMovementType(e.target.value)}><option value="">{ar ? "كل الحركات" : "All Movements"}</option>{TYPES.map(t => <option key={t.value} value={t.value}>{ar ? t.ar : t.en}</option>)}</select>
          <select className="form-input form-select" style={{ width: 170 }} value={serialStatus} onChange={e => setSerialStatus(e.target.value)}><option value="">{ar ? "كل حالات السيريال" : "All Serial Statuses"}</option>{STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{ar ? s.ar : s.en}</option>)}</select>
          <input className="form-input" style={{ width: 190 }} value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder={ar ? "ابحث برقم السيريال" : "Search serial number"} />
          <input className="form-input" style={{ width: 190 }} value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder={ar ? "ابحث برقم الفاتورة" : "Search invoice number"} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>{ar ? "من" : "From"}<input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} /></label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>{ar ? "إلى" : "To"}<input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} /></label>
          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>{ar ? "مسح الفلاتر" : "Clear filters"}</button>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", marginInlineStart: "auto" }}>{rows.length} {ar ? "سجل حركة" : "movement records"}</span>
        </div>
        <div style={{ padding: "0 16px 12px", fontSize: 11, color: "var(--text-muted)" }}>
          {ar ? "استخدم البحث برقم السيريال أو رقم الفاتورة لعرض حركات السيريال المطلوب فقط. الأرقام المالية لا تُعرض هنا لأنها ليست رصيد المخزون." : "Search by serial or invoice number to show only the requested serial movement. Financial totals are hidden because they are not stock balances."}
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div> : !rows.length ? <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد حركات سيريالات" : "No serial movements found"}</div><p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>{ar ? "جرّب تغيير الفلاتر أو تأكد من وجود حركات شراء أو بيع للسيريالات" : "Try changing the filters or check that serial purchase or sale movements exist"}</p></div> : (
            <table>
              <thead><tr><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "رقم السيريال" : "Serial Number"}</th><th>{ar ? "الصنف" : "Product"}</th><th>{ar ? "المستودع" : "Warehouse"}</th><th>{ar ? "نوع الحركة" : "Movement"}</th><th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th><th style={{ textAlign: "end" }}>{ar ? "التكلفة" : "Unit Cost"}</th><th style={{ textAlign: "end" }}>{ar ? "القيمة" : "Value"}</th><th>{ar ? "المستند" : "Document"}</th><th>{ar ? "حالة السيريال" : "Serial Status"}</th></tr></thead>
              <tbody>{rows.map((row: any) => <tr key={row.id}><td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{row.created_at ? new Date(row.created_at).toLocaleString("en-SA") : "—"}</td><td><code style={{ background: "#F1F5F9", padding: "3px 6px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>{row.serial_number}</code></td><td><Link href={`/${locale}/inventory/items/${row.product_id}`} style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>{row.product_name}</Link><div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>{row.product_sku || ""}</div></td><td style={{ fontSize: 12 }}>{row.warehouse_name || "—"}{row.to_warehouse_name && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{ar ? `إلى: ${row.to_warehouse_name}` : `To: ${row.to_warehouse_name}`}</div>}</td><td><span className={`badge ${typeClass[row.movement_type] || "badge-gray"}`} style={{ fontSize: 11 }}>{row.movement_type_ar || typeLabel(row.movement_type, ar)}</span></td><td style={{ textAlign: "end", fontWeight: 700, color: Number(row.quantity) >= 0 ? "#6F4A84" : "#DC2626" }}>{Number(row.quantity) >= 0 ? "+" : ""}{fmt(row.quantity)}</td><td style={{ textAlign: "end", fontFamily: "monospace" }}>{fmt(row.unit_cost)}</td><td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(row.total_value)} SAR</td><td style={{ fontSize: 12 }}>{row.bill_number || row.invoice_number || "—"}{row.bill_number && row.vendor_name && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{row.vendor_name}</div>}</td><td><span className={`badge ${statusClass[row.serial_status] || "badge-gray"}`} style={{ fontSize: 10 }}>{statusLabel(row.serial_status, ar)}</span></td></tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
