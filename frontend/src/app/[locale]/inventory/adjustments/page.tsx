"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getItems, getWarehouses, getSerials, createStockCount, updateSerial, getCountHistory } from "@/lib/inventory";
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
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
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

  useEffect(() => {
    Promise.all([getItems(), getWarehouses()])
      .then(([i, w]) => {
        setItems(i.data);
        setWarehouses(w.data);
        if (w.data.length > 0) setSelectedWarehouse(w.data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      const { data } = await getSerials(itemId);
      setSerialsData(data);
    } catch {} finally { setLoadingSerials(false); }
  };

  const handleSaveCount = async () => {
    const changedItems = items.filter(item =>
      item.tracking_type !== "serial" && countMap[item.id] !== undefined && countMap[item.id] !== ""
    );
    const changedSerials = Object.entries(serialChanges);

    if (changedItems.length === 0 && changedSerials.length === 0) {
      return alert(ar ? "لم تُدخل أي تغييرات" : "No changes entered");
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
      const { data } = await getItems();
      setItems(data);
    } catch {} finally { setSaving(false); }

    if (errorCount > 0) alert(ar ? `تم حفظ ${successCount} وفشل ${errorCount}` : `Saved ${successCount}, failed ${errorCount}`);
  };

  const changedCount = Object.values(countMap).filter(v => v !== "").length + Object.keys(serialChanges).length;

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
          <StructuredReportPrintButton locale={locale} title={ar ? "ورقة جرد وتسوية المخزون" : "Inventory Count & Adjustment Sheet"} subtitle={ar ? "الكميات المدخلة قبل الحفظ" : "Entered counts before posting"} period={new Date().toLocaleDateString("en-SA")} reportCode={`IC-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`} metrics={[{ label: ar ? "المستودع" : "Warehouse", value: warehouses.find(w => w.id === selectedWarehouse)?.name_ar || "—", tone: "green" }, { label: ar ? "الأصناف المعدلة" : "Adjusted items", value: String(changedCount), tone: "amber" }]} tables={[{ headers: [ar ? "الصنف" : "Item", ar ? "نوع التتبع" : "Tracking", ar ? "الكمية الحالية" : "Current qty", ar ? "الكمية المجردة" : "Counted qty"], rows: items.filter(item => countMap[item.id] !== undefined && countMap[item.id] !== "").map(item => [String(item.name_ar), String(TRACKING_AR[item.tracking_type] || item.tracking_type), fmt(item.quantity_on_hand), String(countMap[item.id])]), note: notes || undefined }]} />
          {changedCount > 0 && (
            <button className="btn btn-primary" onClick={handleSaveCount} disabled={saving}>
              <Icon name="check" size={16} />
              {saving ? (ar ? "جاري الحفظ..." : "Saving...") : `${ar ? "حفظ الجرد" : "Save Count"} (${changedCount})`}
            </button>
          )}
        </div>
      </div>

      {saved && (
        <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#166534", fontSize: 13, fontWeight: 600 }}>
          {ar ? "تم حفظ الجرد بنجاح" : "Stock count saved successfully"}
        </div>
      )}

      {/* إعدادات الجرد */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "14px 16px", display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
            <label className="form-label">{ar ? "المستودع" : "Warehouse"}</label>
            <select className="form-input form-select" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
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
                      <td style={{ textAlign: "end", fontWeight: 700, color: h.diff_qty > 0 ? "#059669" : h.diff_qty < 0 ? "#DC2626" : "#94A3B8" }}>
                        {h.diff_qty > 0 ? "+" : ""}{fmt(h.diff_qty)}
                      </td>
                      <td style={{ textAlign: "end", color: h.diff_value > 0 ? "#059669" : h.diff_value < 0 ? "#DC2626" : "#94A3B8" }}>
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
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{items.length} {ar ? "صنف" : "items"}</span>
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
              {items.map(item => {
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
                            <strong style={{ color: "#059669" }}>{fmt(systemQty)}</strong>
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
                          <span style={{ fontWeight: 700, color: diff > 0 ? "#059669" : "#DC2626", fontSize: 13 }}>
                            {diff > 0 ? "+" : ""}{fmt(diff)}
                          </span>
                        ) : diff === 0 ? (
                          <span style={{ color: "#059669", fontSize: 12 }}>✓</span>
                        ) : null}
                      </td>
                      <td>
                        {isSerial && (
                          <button
                            className={`btn btn-sm ${openSerials === item.id ? "btn-primary" : "btn-secondary"}`}
                            onClick={() => handleOpenSerials(item.id)}
                            style={{ fontSize: 12 }}>
                            {openSerials === item.id ? (ar ? "إخفاء" : "Hide") : (ar ? "عرض السيريالات" : "View Serials")}
                          </button>
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
    </>
  );
}
