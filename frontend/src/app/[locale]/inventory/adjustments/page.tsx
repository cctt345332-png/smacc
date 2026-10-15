"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { getItems, getWarehouses, getSerials, validateSerials, getStockByWarehouse, createStockCount, updateSerial, getCountHistory } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const COND_AR: Record<string, string> = { new: "جديد", used: "مستخدم", refurbished: "مجدد" };
const STATUS_AR: Record<string, string> = { in_stock: "متاح", sold: "مباع", reserved: "محجوز", damaged: "تالف" };
const STATUS_BADGE: Record<string, string> = { in_stock: "badge-success", sold: "badge-gray", reserved: "badge-warning", damaged: "badge-danger" };
const TRACKING_AR: Record<string, string> = { quantity: "كمية", serial: "سيريال", batch: "تشغيلة", variant: "متغيرات", weight: "وزن" };

export default function StockCountPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [items, setItems] = useState<any[]>([]);
  const [allWarehouseStock, setAllWarehouseStock] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [quantityFilter, setQuantityFilter] = useState("all");
  const [quantitySort, setQuantitySort] = useState("none");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notes, setNotes] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // كميات الجرد — map من item_id إلى الكمية المدخلة
  const [countMap, setCountMap] = useState<Record<string, string>>({});

  // السيريالات المفتوحة
  const [openSerials, setOpenSerials] = useState<string | null>(null);
  const [serialsData, setSerialsData] = useState<any[]>([]);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [serialChanges, setSerialChanges] = useState<Record<string, string>>({});
  const [serialAudit, setSerialAudit] = useState<any | null>(null);
  const [selectedSerialProduct, setSelectedSerialProduct] = useState("");
  const [serialAuditLoading, setSerialAuditLoading] = useState(false);

  useEffect(() => {
    getWarehouses()
      .then(({ data }) => {
        setWarehouses(data);
        setSelectedWarehouse((current: string) => current || "all");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedWarehouse) return;
    setLoading(true);
    getItems(selectedWarehouse === "all" ? undefined : { warehouse_id: selectedWarehouse })
      .then(({ data }) => setItems(data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    if (selectedWarehouse === "all") {
      getStockByWarehouse()
        .then(({ data }) => setAllWarehouseStock(Array.isArray(data) ? data : []))
        .catch(() => setAllWarehouseStock([]));
    } else {
      setAllWarehouseStock([]);
    }
  }, [selectedWarehouse]);

  useEffect(() => {
    setCountMap({});
    setSerialChanges({});
    setOpenSerials(null);
    setSelectedSerialProduct("");
    setSerialAudit(null);
  }, [selectedWarehouse]);

  const visibleItems = items.filter((item: any) => {
    const q = itemSearch.trim().toLowerCase();
    const qty = Number(item.quantity_on_hand || 0);
    const reorder = Number(item.reorder_point || 0);
    const matchesSearch = !q || [item.name_ar, item.name_en, item.sku, item.barcode].some(v => String(v || "").toLowerCase().includes(q));
    const matchesQuantity = quantityFilter === "all"
      || (quantityFilter === "zero" && qty === 0)
      || (quantityFilter === "available" && qty > 0)
      || (quantityFilter === "low" && qty > 0 && qty <= reorder);
    return matchesSearch && matchesQuantity;
  }).sort((a: any, b: any) => {
    if (quantitySort === "high") return Number(b.quantity_on_hand || 0) - Number(a.quantity_on_hand || 0);
    if (quantitySort === "low") return Number(a.quantity_on_hand || 0) - Number(b.quantity_on_hand || 0);
    return 0;
  });

  const handleOpenHistory = async () => {
    setShowHistory(h => !h);
    if (!showHistory && history.length === 0) {
      setLoadingHistory(true);
      try { const { data } = await getCountHistory({ limit: 50 }); setHistory(data); }
      catch {} finally { setLoadingHistory(false); }
    }
  };

  const handleOpenSerials = async (itemId: string) => {
    if (openSerials === itemId) { setOpenSerials(null); return; }
    setOpenSerials(itemId);
    setSerialChanges({});
    setLoadingSerials(true);
    try {
      const { data } = await getSerials(itemId, "in_stock", selectedWarehouse === "all" ? undefined : selectedWarehouse);
      setSerialsData(data);
    } catch {} finally { setLoadingSerials(false); }
  };

  const normalizeSerial = (value: any) => String(value ?? "").trim().replace(/\s+/g, "");

  const handleSerialAuditFile = async (file?: File) => {
    if (!file) return;
    if (selectedWarehouse === "all" || !selectedSerialProduct) {
      alert(ar ? "اختر المستودع والمنتج أولاً لجرد السيريالات" : "Choose a warehouse and product first");
      return;
    }
    setSerialAuditLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellText: true, cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "", raw: false });
      const header = (rows[0] || []).map((v: any) => normalizeSerial(v).toLowerCase());
      const serialColumn = header.findIndex((v: string) => /serial|سيريال|imei|رقم/.test(v));
      const values = rows.slice(serialColumn >= 0 ? 1 : 0)
        .map((row: any[]) => normalizeSerial(row[serialColumn >= 0 ? serialColumn : 0]))
        .filter(Boolean);
      const unique = [...new Set(values)];
      const duplicateSerials = [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];
      if (!unique.length) throw new Error(ar ? "لم يتم العثور على أرقام سيريال في الملف" : "No serial numbers found in the file");

      const [{ data: validation }, { data: productSerials }] = await Promise.all([
        validateSerials({ serial_numbers: unique, warehouse_id: selectedWarehouse }),
        getSerials(selectedSerialProduct, "in_stock", selectedWarehouse),
      ]);
      const systemRows = Array.isArray(productSerials) ? productSerials : [];
      const uploadedSet = new Set(unique);
      const systemSet = new Set(systemRows.map((x: any) => normalizeSerial(x.serial_number)));
      const found = (validation.found || []).filter((x: any) => systemSet.has(normalizeSerial(x.serial_number)));
      const wrongProduct = (validation.found || []).filter((x: any) => !systemSet.has(normalizeSerial(x.serial_number)));
      const foundSet = new Set(found.map((x: any) => normalizeSerial(x.serial_number)));
      const missingFromFile = systemRows.filter((x: any) => !uploadedSet.has(normalizeSerial(x.serial_number)));
      setSerialAudit({
        fileName: file.name, uploaded: unique, found, wrongProduct, systemRows,
        wrongWarehouse: validation.wrong_warehouse || [], notFound: validation.not_found || [],
        missingFromFile, duplicateSerials, warehouseName: warehouses.find(w => w.id === selectedWarehouse)?.name_ar || "—",
        totalSystem: systemRows.length, checkedAt: new Date().toISOString(), foundCount: foundSet.size,
      });
    } catch (error: any) {
      alert(error?.response?.data?.detail || error?.message || (ar ? "تعذر قراءة ملف السيريالات" : "Could not read serial file"));
    } finally { setSerialAuditLoading(false); }
  };

  const exportSerialAudit = () => {
    if (!serialAudit) return;
    const rows = [
      ...serialAudit.found.map((x: any) => ({ الحالة: "موجود في المستودع", السيريال: x.serial_number, المستودع: serialAudit.warehouseName })),
      ...serialAudit.missingFromFile.map((x: any) => ({ الحالة: "موجود بالنظام ولم يظهر في الملف", السيريال: x.serial_number, الصنف: x.product_name, المستودع: serialAudit.warehouseName })),
      ...serialAudit.wrongProduct.map((x: any) => ({ الحالة: "موجود في المستودع لكنه يخص منتجاً آخر", السيريال: x.serial_number, المستودع: serialAudit.warehouseName })),
      ...serialAudit.wrongWarehouse.map((x: any) => ({ الحالة: "موجود في مستودع آخر", السيريال: x.serial_number, المستودع: x.actual_warehouse })),
      ...serialAudit.notFound.map((x: any) => ({ الحالة: "غير موجود بالنظام", السيريال: x })),
      ...serialAudit.duplicateSerials.map((x: any) => ({ الحالة: "مكرر في الملف", السيريال: x })),
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 24 }, { wch: 36 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "نتيجة الجرد");
    XLSX.writeFile(wb, `جرد-سيريالات-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportProductSerials = async (productId: string, productName: string) => {
    if (selectedWarehouse === "all") return alert(ar ? "اختر مستودعاً محدداً أولاً" : "Choose a warehouse first");
    try {
      const { data } = await getSerials(productId, "in_stock", selectedWarehouse);
      const rows = (Array.isArray(data) ? data : []).map((x: any) => ({
        السيريال: x.serial_number, الصنف: productName, المنتج_id: productId,
        الحالة: "متاح", المستودع: warehouses.find(w => w.id === selectedWarehouse)?.name_ar || "—",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "سيريالات المنتج");
      XLSX.writeFile(wb, `سيريالات-${productName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error: any) { alert(error?.response?.data?.detail || (ar ? "تعذر تحميل السيريالات" : "Could not download serials")); }
  };

  const exportSerialCountSheet = () => {
    if (!serialAudit) return;
    const foundSet = new Set(serialAudit.found.map((x: any) => normalizeSerial(x.serial_number)));
    const rows = serialAudit.systemRows.map((x: any) => ({
      السيريال: x.serial_number, الصنف: x.product_name,
      حالة_الجرد: foundSet.has(normalizeSerial(x.serial_number)) ? "موجود وتمت مطابقته" : "غير موجود في الملف",
      المستودع: serialAudit.warehouseName, ملاحظات: "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ورقة جرد السيريالات");
    XLSX.writeFile(wb, `ورقة-جرد-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportMissingSerials = () => {
    if (!serialAudit) return;
    const rows = serialAudit.notFound.length
      ? serialAudit.notFound.map((serial: string) => ({ السيريال: serial, الصنف: "المنتج الجاري جرده", الحالة: "غير موجود بالنظام", المستودع: serialAudit.warehouseName }))
      : [{ السيريال: "—", الصنف: "—", الحالة: "لا توجد سيريالات غير موجودة بالنظام", المستودع: serialAudit.warehouseName }];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 24 }, { wch: 36 }, { wch: 52 }, { wch: 34 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "السيريالات غير الموجودة");
    XLSX.writeFile(wb, `سيريالات-غير-موجودة-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleSaveCount = async () => {
    const changedItems = items.filter(item =>
      item.tracking_type !== "serial" && countMap[item.id] !== undefined && countMap[item.id] !== ""
    );
    const changedSerials = Object.entries(serialChanges);

    if (changedItems.length === 0 && changedSerials.length === 0) {
      return alert(ar ? "لم تُدخل أي تغييرات" : "No changes entered");
    }
    if (selectedWarehouse === "all") {
      return alert(ar ? "اختر مستودعًا محددًا قبل حفظ الجرد؛ خيار كل المستودعات للعرض الإجمالي فقط" : "Choose a specific warehouse before saving; All warehouses is view-only");
    }

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // حفظ الكميات العادية
      for (const item of changedItems) {
        try {
          await createStockCount({
            item_id: item.id,
            warehouse_id: selectedWarehouse,
            counted_qty: parseFloat(countMap[item.id]),
            notes: notes || null,
          });
          successCount++;
        } catch { errorCount++; }
      }

      // حفظ تغييرات السيريالات
      for (const [serialId, newStatus] of changedSerials) {
        try {
          await updateSerial(serialId, { status: newStatus });
          successCount++;
        } catch { errorCount++; }
      }

      setSaved(true);
      setCountMap({});
      setSerialChanges({});
      setOpenSerials(null);
      setTimeout(() => setSaved(false), 4000);

      // تحديث الأصناف
      const { data } = await getItems({ warehouse_id: selectedWarehouse });
      setItems(data);
    } catch {} finally { setSaving(false); }

    if (errorCount > 0) alert(ar ? `تم حفظ ${successCount} وفشل ${errorCount}` : `Saved ${successCount}, failed ${errorCount}`);
  };

  const changedCount = Object.values(countMap).filter(v => v !== "").length + Object.keys(serialChanges).length;

  // الطباعة لا تعتمد على countMap وحده؛ لأنه يُصفّر بعد حفظ الجرد.
  // نطبع كل الأصناف الظاهرة، مع استخدام الكمية المدخلة عند وجودها،
  // وإلا نعرض كمية النظام الحالية حتى لا يخرج التقرير فارغاً.
  const summaryRows = selectedWarehouse === "all"
    ? allWarehouseStock
      .filter((row: any) => {
        const q = itemSearch.trim().toLowerCase();
        const qty = Number(row.quantity || 0);
        const reorder = Number(row.reorder_point || 0);
        const matchesSearch = !q || [row.item_name, row.item_sku].some(v => String(v || "").toLowerCase().includes(q));
        const matchesQuantity = quantityFilter === "all"
          || (quantityFilter === "zero" && qty === 0)
          || (quantityFilter === "available" && qty > 0)
          || (quantityFilter === "low" && qty > 0 && qty <= reorder);
        return matchesSearch && matchesQuantity;
      })
      .map((row: any) => {
        const quantity = Number(row.quantity || 0);
        const value = quantity * Number(row.sale_price || 0);
        return { quantity, value };
      })
    : visibleItems.map((item: any) => {
      const isSerial = item.tracking_type === "serial";
      const systemQty = Number(isSerial ? (item.serial_count ?? item.quantity_on_hand ?? 0) : (item.quantity_on_hand ?? 0));
      const countedValue = countMap[item.id];
      const quantity = countedValue !== undefined && countedValue !== "" ? Number(countedValue) : systemQty;
      return { quantity, value: quantity * Number(item.sale_price || 0) };
    });

  const positiveSummary = summaryRows.reduce((acc, row) => row.quantity > 0 ? { quantity: acc.quantity + row.quantity, value: acc.value + row.value } : acc, { quantity: 0, value: 0 });
  const negativeSummary = summaryRows.reduce((acc, row) => row.quantity < 0 ? { quantity: acc.quantity + row.quantity, value: acc.value + row.value } : acc, { quantity: 0, value: 0 });
  const finalSummary = {
    quantity: positiveSummary.quantity + negativeSummary.quantity,
    value: positiveSummary.value + negativeSummary.value,
  };

  const printRows = selectedWarehouse === "all"
    ? allWarehouseStock
      .filter((row: any) => {
        const q = itemSearch.trim().toLowerCase();
        const qty = Number(row.quantity || 0);
        const reorder = Number(row.reorder_point || 0);
        const matchesSearch = !q || [row.item_name, row.item_sku].some(v => String(v || "").toLowerCase().includes(q));
        const matchesQuantity = quantityFilter === "all"
          || (quantityFilter === "zero" && qty === 0)
          || (quantityFilter === "available" && qty > 0)
          || (quantityFilter === "low" && qty > 0 && qty <= reorder);
        return matchesSearch && matchesQuantity;
      })
      .sort((a: any, b: any) => {
        const warehouseSort = String(a.warehouse_name || "").localeCompare(String(b.warehouse_name || ""), "ar");
        if (warehouseSort !== 0) return warehouseSort;
        if (quantitySort === "high") return Number(b.quantity || 0) - Number(a.quantity || 0);
        if (quantitySort === "low") return Number(a.quantity || 0) - Number(b.quantity || 0);
        return String(a.item_name || "").localeCompare(String(b.item_name || ""), "ar");
      })
      .map((row: any) => [
        String(row.warehouse_name || (ar ? "بدون مستودع" : "Unassigned warehouse")),
        String(row.item_name || "—"),
        String(TRACKING_AR[row.item_tracking] || row.item_tracking || "—"),
        fmt(row.quantity),
        fmt(row.quantity),
        fmt(Number(row.quantity || 0) * Number(row.sale_price || 0)),
      ])
    : visibleItems.map((item: any) => {
    const isSerial = item.tracking_type === "serial";
    const systemQty = Number(isSerial ? (item.serial_count ?? item.quantity_on_hand ?? 0) : (item.quantity_on_hand ?? 0));
    const countedValue = countMap[item.id];
    const countedQty = countedValue !== undefined && countedValue !== "" ? countedValue : fmt(systemQty);
    return [
      String(item.name_ar || item.name_en || "—"),
      String(TRACKING_AR[item.tracking_type] || item.tracking_type || "—"),
      fmt(systemQty),
      String(countedQty),
      fmt((countedValue !== undefined && countedValue !== "" ? Number(countedValue) : systemQty) * Number(item.sale_price || 0)),
    ];
  });

  const printHeaders = selectedWarehouse === "all"
    ? [ar ? "المستودع" : "Warehouse", ar ? "الصنف" : "Item", ar ? "نوع التتبع" : "Tracking", ar ? "الكمية الحالية" : "Current qty", ar ? "الكمية المجردة" : "Counted qty", ar ? "القيمة" : "Value"]
    : [ar ? "الصنف" : "Item", ar ? "نوع التتبع" : "Tracking", ar ? "الكمية الحالية" : "Current qty", ar ? "الكمية المجردة" : "Counted qty", ar ? "القيمة" : "Value"];

  const summaryTableRows = [
    [ar ? "مجموع الموجب" : "Positive total", fmt(positiveSummary.quantity), fmt(positiveSummary.value)],
    [ar ? "مجموع السالب" : "Negative total", fmt(negativeSummary.quantity), fmt(negativeSummary.value)],
    [ar ? "المجموع النهائي" : "Final total", fmt(finalSummary.quantity), fmt(finalSummary.value)],
  ];

  if (loading) return <div className="empty-state" style={{ minHeight: "60vh" }}><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/inventory`}>{ar ? "المخزون" : "Inventory"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "جرد المخزون" : "Stock Count"}</span>
          </div>
          <h1 className="page-title">{ar ? "جرد المخزون" : "Stock Count"}</h1>
          <p className="page-subtitle">{ar ? "عدّل الكميات لكل الأصناف دفعة واحدة ثم احفظ" : "Edit quantities for all items at once, then save"}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href={`/${locale}/inventory/movements`} className="btn btn-secondary btn-sm">
            <Icon name="ledger" size={14} /> {ar ? "سجل الحركات" : "Movement Log"}
          </Link>
          <button className="btn btn-secondary btn-sm" onClick={handleOpenHistory}>
            <Icon name="view" size={14} /> {ar ? "سجل الجرد السابق" : "Count History"}
          </button>
          <StructuredReportPrintButton locale={locale} title={ar ? "ورقة جرد وتسوية المخزون" : "Inventory Count & Adjustment Sheet"} subtitle={selectedWarehouse === "all" ? (ar ? "تفصيل كميات الأصناف حسب المستودع" : "Item quantities by warehouse") : (ar ? "كميات الأصناف الحالية والمجردة" : "Current and counted item quantities")} period={new Date().toLocaleDateString("en-SA")} reportCode={`IC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`} metrics={[{ label: ar ? "المستودع" : "Warehouse", value: selectedWarehouse === "all" ? (ar ? "كل المستودعات" : "All warehouses") : warehouses.find(w => w.id === selectedWarehouse)?.name_ar || "—", tone: "green" }, { label: ar ? "صفوف التقرير" : "Report rows", value: String(printRows.length), tone: "amber" }, { label: ar ? "المجموع النهائي" : "Final total", value: `${fmt(finalSummary.quantity)} / ${fmt(finalSummary.value)}`, tone: "neutral" }]} tables={[{ headers: printHeaders, rows: printRows, note: notes || undefined }, { title: ar ? "ملخص الإجماليات" : "Totals summary", headers: [ar ? "البيان" : "Summary", ar ? "الكميات" : "Quantities", ar ? "القيمة السعرية" : "Value"], rows: summaryTableRows }]} />
          {changedCount > 0 && (
            <button className="btn btn-primary" onClick={handleSaveCount} disabled={saving}>
              <Icon name="check" size={16} />
              {saving ? (ar ? "جاري الحفظ..." : "Saving...") : `${ar ? "حفظ الجرد" : "Save Count"} (${changedCount})`}
            </button>
          )}
        </div>
      </div>

      {saved && (
        <div style={{ background: "#F0E7F4", border: "1px solid #C8AED4", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#3E0865", fontSize: 13, fontWeight: 600 }}>
          {ar ? "تم حفظ الجرد بنجاح" : "Stock count saved successfully"}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, border: "1px solid #D8C5E2", background: "linear-gradient(135deg, #FCFAFD, #F7F1FA)" }}>
        <div className="card-body" style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="card-title" style={{ color: "#4C1768" }}>{ar ? "جرد السيريالات الذكي" : "Smart Serial Count"}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {ar ? "اختر منتجاً واحداً، ثم ارفع ملف Excel بسيريالاته لمطابقة الجرد بدقة" : "Choose one product, then upload its serial Excel file for an accurate count"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select className="form-input form-select" style={{ minWidth: 240 }} value={selectedSerialProduct} onChange={e => { setSelectedSerialProduct(e.target.value); setSerialAudit(null); }} disabled={selectedWarehouse === "all"}>
                <option value="">{ar ? "اختر المنتج المراد جرده" : "Choose product to count"}</option>
                {items.filter((item: any) => item.tracking_type === "serial").map((item: any) => <option key={item.id} value={item.id}>{item.name_ar}{item.sku ? ` — ${item.sku}` : ""}</option>)}
              </select>
              <label className="btn btn-primary btn-sm" style={{ cursor: serialAuditLoading ? "wait" : "pointer" }}>
                {serialAuditLoading ? (ar ? "جاري المطابقة..." : "Matching...") : (ar ? "رفع ملف Excel للجرد" : "Upload Count Excel")}
                <input type="file" accept=".xlsx,.xls,.csv" hidden disabled={serialAuditLoading} onChange={e => { handleSerialAuditFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />
              </label>
              {serialAudit && <button className="btn btn-secondary btn-sm" onClick={exportSerialAudit}>{ar ? "تصدير النتيجة Excel" : "Export Result Excel"}</button>}
            </div>
          </div>
          {selectedWarehouse === "all" && <div style={{ marginTop: 10, color: "#92400E", fontSize: 12, fontWeight: 600 }}>{ar ? "اختر مستودعاً محدداً ثم منتجاً واحداً قبل رفع ملف السيريالات" : "Choose a warehouse and one product before uploading serials"}</div>}
          {selectedSerialProduct && <div style={{ marginTop: 8, fontSize: 12, color: "#4C1768", fontWeight: 700 }}>{ar ? "الجرد الحالي لمنتج واحد فقط — ارفع ملف هذا المنتج" : "Current count is for one product only — upload this product's file"}</div>}
          {serialAudit && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <button className="btn btn-secondary btn-sm" onClick={exportSerialCountSheet}>{ar ? "تحميل ورقة الجرد" : "Download Count Sheet"}</button>
                <button className="btn btn-secondary btn-sm" onClick={exportMissingSerials}>{ar ? "تحميل السيريالات غير الموجودة" : "Download Missing Serials"}</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                {[
                  ["موجود في المستودع", serialAudit.found.length, "#166534"],
                  ["موجود بالنظام ولم يرد", serialAudit.missingFromFile.length, "#92400E"],
                  ["منتج آخر", serialAudit.wrongProduct.length, "#6D28D9"],
                  ["في مستودع آخر", serialAudit.wrongWarehouse.length, "#1D4ED8"],
                  ["غير موجود بالنظام", serialAudit.notFound.length, "#B91C1C"],
                  ["مكرر في الملف", serialAudit.duplicateSerials.length, "#7C2D12"],
                ].map(([label, value, color]) => <div key={String(label)} style={{ background: "white", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px" }}><div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{ar ? label : label}</div><strong style={{ color: String(color), fontSize: 20 }}>{value}</strong></div>)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>{ar ? `الملف: ${serialAudit.fileName} — المستودع: ${serialAudit.warehouseName} — إجمالي النظام: ${serialAudit.totalSystem}` : `File: ${serialAudit.fileName} — Warehouse: ${serialAudit.warehouseName} — System total: ${serialAudit.totalSystem}`}</div>
              <div className="table-wrapper" style={{ marginTop: 10, maxHeight: 260, overflow: "auto" }}>
                <table><thead><tr><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "السيريال" : "Serial"}</th><th>{ar ? "المستودع / الصنف" : "Warehouse / Item"}</th></tr></thead><tbody>
                  {[
                    ...serialAudit.found.map((x: any) => ({ status: "موجود", serial: x.serial_number, detail: serialAudit.warehouseName, color: "#166534" })),
                    ...serialAudit.missingFromFile.map((x: any) => ({ status: "موجود بالنظام ولم يرد بالملف", serial: x.serial_number, detail: x.product_name || serialAudit.warehouseName, color: "#92400E" })),
                    ...serialAudit.wrongProduct.map((x: any) => ({ status: "سيريال لمنتج آخر", serial: x.serial_number, detail: serialAudit.warehouseName, color: "#6D28D9" })),
                    ...serialAudit.wrongWarehouse.map((x: any) => ({ status: "في مستودع آخر", serial: x.serial_number, detail: x.actual_warehouse, color: "#1D4ED8" })),
                    ...serialAudit.notFound.map((x: any) => ({ status: "غير موجود", serial: x, detail: "—", color: "#B91C1C" })),
                  ].map((row: any, index) => <tr key={`${row.serial}-${index}`}><td style={{ color: row.color, fontWeight: 700 }}>{row.status}</td><td><code>{row.serial}</code></td><td>{row.detail}</td></tr>)}
                </tbody></table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* إعدادات الجرد */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "14px 16px", display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
            <label className="form-label">{ar ? "المستودع" : "Warehouse"}</label>
            <select className="form-input form-select" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
              <option value="all">{ar ? "كل المستودعات — إجمالي النظام" : "All warehouses — system total"}</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 240 }}>
            <label className="form-label">{ar ? "بحث في الأصناف" : "Search items"}</label>
            <input className="form-input" value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder={ar ? "اسم الصنف أو SKU..." : "Name or SKU..."} />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
            <label className="form-label">{ar ? "فلتر الكمية" : "Quantity filter"}</label>
            <select className="form-input form-select" value={quantityFilter} onChange={e => setQuantityFilter(e.target.value)}>
              <option value="all">{ar ? "كل الكميات" : "All quantities"}</option>
              <option value="available">{ar ? "متوفر أكبر من صفر" : "Available > 0"}</option>
              <option value="zero">{ar ? "صفر" : "Zero"}</option>
              <option value="low">{ar ? "منخفض حسب حد إعادة الطلب" : "Low / reorder point"}</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 190 }}>
            <label className="form-label">{ar ? "ترتيب الكمية" : "Quantity sort"}</label>
            <select className="form-input form-select" value={quantitySort} onChange={e => setQuantitySort(e.target.value)}>
              <option value="none">{ar ? "بدون ترتيب" : "Default order"}</option>
              <option value="high">{ar ? "الأعلى كمية أولاً" : "Highest quantity first"}</option>
              <option value="low">{ar ? "الأقل كمية أولاً" : "Lowest quantity first"}</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <label className="form-label">{ar ? "ملاحظات الجرد (اختياري)" : "Count Notes (optional)"}</label>
            <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={ar ? "سبب الجرد أو ملاحظات..." : "Reason or notes..."} />
          </div>
          {changedCount > 0 && (
            <div style={{ background: "#FEF9C3", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#92400E", fontWeight: 600 }}>
              {changedCount} {ar ? "تغيير غير محفوظ" : "unsaved changes"}
            </div>
          )}
        </div>
      </div>

      {/* سجل الجرد السابق */}
      {showHistory && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">{ar ? "سجل الجرد السابق" : "Previous Count History"}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowHistory(false)}>✕</button>
          </div>
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            {loadingHistory ? (
              <div className="empty-state" style={{ padding: 20 }}><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
            ) : history.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}><div className="empty-state-title" style={{ fontSize: 13 }}>{ar ? "لا يوجد سجل جرد سابق" : "No count history"}</div></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{ar ? "التاريخ" : "Date"}</th>
                    <th>{ar ? "الصنف" : "Item"}</th>
                    <th>{ar ? "المستودع" : "Warehouse"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الكمية السابقة" : "Previous"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الكمية الفعلية" : "Counted"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الفرق" : "Diff"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "قيمة الفرق" : "Diff Value"}</th>
                    <th>{ar ? "ملاحظات" : "Notes"}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h: any) => (
                    <tr key={h.id}>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {new Date(h.counted_at).toLocaleDateString("en-SA")}
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {new Date(h.counted_at).toLocaleTimeString("en-SA", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{h.item_name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{h.item_sku}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{h.warehouse_name}</td>
                      <td style={{ textAlign: "end" }}>{fmt(h.previous_qty)}</td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(h.counted_qty)}</td>
                      <td style={{ textAlign: "end", fontWeight: 700, color: h.diff_qty > 0 ? "#6F4A84" : h.diff_qty < 0 ? "#DC2626" : "#94A3B8" }}>
                        {h.diff_qty > 0 ? "+" : ""}{fmt(h.diff_qty)}
                      </td>
                      <td style={{ textAlign: "end", color: h.diff_value > 0 ? "#6F4A84" : h.diff_value < 0 ? "#DC2626" : "#94A3B8" }}>
                        {h.diff_value > 0 ? "+" : ""}{fmt(h.diff_value)} SAR
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{h.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* جدول الجرد */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "أصناف المخزون" : "Inventory Items"}</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{visibleItems.length} / {items.length} {ar ? "صنف" : "items"}</span>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{ar ? "الصنف" : "Item"}</th>
                <th>{ar ? "نوع التتبع" : "Tracking"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الكمية في النظام" : "System Qty"}</th>
                <th style={{ textAlign: "end", width: 160 }}>{ar ? "الكمية الفعلية" : "Actual Qty"}</th>
                <th style={{ textAlign: "end" }}>{ar ? "الفرق" : "Diff"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
                {visibleItems.map(item => {
                const isSerial = item.tracking_type === "serial";
                const systemQty = Number(isSerial ? (item.serial_count ?? item.quantity_on_hand ?? 0) : (item.quantity_on_hand ?? 0));
                const countedVal = countMap[item.id];
                const countedNum = countedVal !== undefined && countedVal !== "" ? parseFloat(countedVal) : null;
                const diff = countedNum !== null && systemQty !== null ? countedNum - systemQty : null;
                const hasChange = isSerial
                  ? serialsData.some(s => serialChanges[s.id])
                  : (countedVal !== undefined && countedVal !== "");

                return (
                  <>
                    <tr key={item.id} style={hasChange ? { background: "#FFFBEB" } : {}}>
                      <td>
                        <Link href={`/${locale}/inventory/items/${item.id}`}
                          style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "none", fontSize: 13 }}>
                          {item.name_ar}
                        </Link>
                        {item.sku && <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{item.sku}</div>}
                        {(item.color || item.storage) && (
                          <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                            {item.color && <span className="badge badge-info" style={{ fontSize: 10 }}>{item.color}</span>}
                            {item.storage && <span className="badge badge-gray" style={{ fontSize: 10 }}>{item.storage}</span>}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${isSerial ? "badge-success" : "badge-info"}`} style={{ fontSize: 11 }}>
                          {isSerial ? (ar ? "سيريال" : "Serial") : (ar ? "كمية" : "Quantity")}
                        </span>
                      </td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>
                        {isSerial ? (
                          <div>
                            <strong style={{ color: "#6F4A84" }}>{fmt(systemQty)}</strong>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{ar ? "سيريال متاح" : "serials in stock"}</div>
                          </div>
                        ) : fmt(systemQty)}
                      </td>
                      <td style={{ textAlign: "end" }}>
                        {isSerial ? (
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{ar ? "عدّل حالات السيريالات" : "Change serial statuses"}</span>
                        ) : (
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: 120, textAlign: "end", fontSize: 13, fontWeight: 600, borderColor: hasChange ? "#F59E0B" : undefined }}
                            value={countMap[item.id] ?? ""}
                            onChange={e => setCountMap(m => ({ ...m, [item.id]: e.target.value }))}
                            placeholder={fmt(systemQty)}
                            min="0" step="0.001"
                          />
                        )}
                      </td>
                      <td style={{ textAlign: "end" }}>
                        {diff !== null && diff !== 0 ? (
                          <span style={{ fontWeight: 700, color: diff > 0 ? "#6F4A84" : "#DC2626", fontSize: 13 }}>
                            {diff > 0 ? "+" : ""}{fmt(diff)}
                          </span>
                        ) : diff === 0 ? (
                          <span style={{ color: "#6F4A84", fontSize: 12 }}>✓</span>
                        ) : null}
                      </td>
                      <td>
                        {isSerial && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button
                              className={`btn btn-sm ${openSerials === item.id ? "btn-primary" : "btn-secondary"}`}
                              onClick={() => handleOpenSerials(item.id)}
                              style={{ fontSize: 12 }}>
                              {openSerials === item.id ? (ar ? "إخفاء" : "Hide") : (ar ? "عرض السيريالات" : "View Serials")}
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => exportProductSerials(item.id, item.name_ar || item.sku || "product")}
                              disabled={selectedWarehouse === "all"}
                              style={{ fontSize: 12 }}>
                              {ar ? "تحميل Excel" : "Download Excel"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* صفوف السيريالات */}
                    {isSerial && openSerials === item.id && (
                      <tr key={`${item.id}-serials`}>
                        <td colSpan={6} style={{ padding: 0, background: "#F8FAFC" }}>
                          {loadingSerials ? (
                            <div style={{ padding: "16px 24px", color: "var(--text-muted)", fontSize: 13 }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
                          ) : serialsData.length === 0 ? (
                            <div style={{ padding: "16px 24px", color: "var(--text-muted)", fontSize: 13 }}>{ar ? "لا توجد سيريالات" : "No serials"}</div>
                          ) : (
                            <div style={{ padding: "12px 24px" }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                {ar ? "السيريالات — غيّر الحالة إذا وجدت فرقاً" : "Serials — change status if there's a discrepancy"}
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 8 }}>
                                {serialsData.map((s: any) => {
                                  const currentStatus = serialChanges[s.id] || s.status;
                                  const changed = serialChanges[s.id] && serialChanges[s.id] !== s.status;
                                  return (
                                    <div key={s.id} style={{
                                      background: changed ? "#FFFBEB" : "white",
                                      border: `1px solid ${changed ? "#F59E0B" : "var(--border)"}`,
                                      borderRadius: 8, padding: "10px 12px",
                                      display: "flex", alignItems: "center", gap: 10,
                                    }}>
                                      <code style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{s.serial_number}</code>
                                      <span className={`badge ${COND_AR[s.condition] ? "badge-info" : "badge-gray"}`} style={{ fontSize: 10 }}>
                                        {COND_AR[s.condition] || s.condition}
                                      </span>
                                      <select
                                        className="form-input form-select"
                                        style={{ width: 110, height: 28, fontSize: 11, padding: "2px 6px" }}
                                        value={currentStatus}
                                        onChange={e => setSerialChanges(sc => ({ ...sc, [s.id]: e.target.value }))}>
                                        <option value="in_stock">{ar ? "متاح" : "In Stock"}</option>
                                        <option value="damaged">{ar ? "تالف" : "Damaged"}</option>
                                        <option value="reserved">{ar ? "محجوز" : "Reserved"}</option>
                                        <option value="sold">{ar ? "مباع" : "Sold"}</option>
                                      </select>
                                      {changed && <span style={{ fontSize: 10, color: "#D97706", fontWeight: 700 }}>{ar ? "تغيّر" : "Changed"}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* زر الحفظ في الأسفل */}
        {changedCount > 0 && (
          <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => { setCountMap({}); setSerialChanges({}); }}>
              {ar ? "إلغاء التغييرات" : "Discard Changes"}
            </button>
            <button className="btn btn-primary" onClick={handleSaveCount} disabled={saving}>
              <Icon name="check" size={16} />
              {saving ? (ar ? "جاري الحفظ..." : "Saving...") : `${ar ? "حفظ الجرد" : "Save Count"} (${changedCount} ${ar ? "تغيير" : "changes"})`}
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <span className="card-title">{ar ? "ملخص إجماليات الجرد" : "Stock Count Totals"}</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "الكميات والقيمة السعرية" : "Quantities and value"}</span>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead><tr>
              <th>{ar ? "البيان" : "Summary"}</th>
              <th style={{ textAlign: "end" }}>{ar ? "الكميات" : "Quantities"}</th>
              <th style={{ textAlign: "end" }}>{ar ? "القيمة السعرية" : "Value"}</th>
            </tr></thead>
            <tbody>
              <tr><td style={{ fontWeight: 700 }}>{ar ? "مجموع الموجب" : "Positive total"}</td><td style={{ textAlign: "end", color: "#6F4A84", fontWeight: 700 }}>{fmt(positiveSummary.quantity)}</td><td style={{ textAlign: "end", color: "#6F4A84", fontWeight: 700 }}>{fmt(positiveSummary.value)} SAR</td></tr>
              <tr><td style={{ fontWeight: 700 }}>{ar ? "مجموع السالب" : "Negative total"}</td><td style={{ textAlign: "end", color: negativeSummary.quantity < 0 ? "#DC2626" : "var(--text-secondary)", fontWeight: 700 }}>{fmt(negativeSummary.quantity)}</td><td style={{ textAlign: "end", color: negativeSummary.value < 0 ? "#DC2626" : "var(--text-secondary)", fontWeight: 700 }}>{fmt(negativeSummary.value)} SAR</td></tr>
              <tr style={{ background: "#F1EBF5" }}><td style={{ fontWeight: 800, color: "#3E0865" }}>{ar ? "المجموع النهائي" : "Final total"}</td><td style={{ textAlign: "end", fontWeight: 800, color: "#3E0865" }}>{fmt(finalSummary.quantity)}</td><td style={{ textAlign: "end", fontWeight: 800, color: "#3E0865" }}>{fmt(finalSummary.value)} SAR</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
