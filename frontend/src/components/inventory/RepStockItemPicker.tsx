"use client";
/**
 * RepStockItemPicker
 * مثل ItemPicker لكن يعرض فقط أصناف مخزون المندوب الحالي
 * - يدعم أصناف الكمية العادية
 * - يدعم السيريالات من مستودع المندوب
 * - نص حر كاحتياط
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { getAvailableSerials } from "@/lib/inventory";
import SerialPicker from "./SerialPicker";
import BarcodeScanner from "./BarcodeScanner";

export interface RepPickedItem {
  mode: "free" | "item" | "serial";
  description_ar: string;
  unit_price: number;
  quantity: number;
  inventory_item_id?: string;
  serial_item_id?: string;
  serial_ids?: string[];
  serial_numbers?: string[];
  item_name?: string;
  available_qty?: number;
}

interface Props {
  locale: string;
  value: RepPickedItem;
  onChange: (v: RepPickedItem) => void;
  stockItems: any[];          // نتيجة getMyStock()
  warehouseId?: string;
}

export default function RepStockItemPicker({ locale, value, onChange, stockItems, warehouseId }: Props) {
  const ar = locale === "ar";
  const [query, setQuery] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [showSerialPicker, setShowSerialPicker] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  /* معالجة نتيجة الباركود */
  const handleBarcodeResult = (text: string) => {
    // في وضع continuous لا نُغلق الكاميرا هنا — تُغلق عند ✕
    const scanned = text.trim();

    // الحالة 1: صنف serial مختار — الباركود هو رقم السيريال → أضفه للقائمة
    if (value.inventory_item_id && value.mode === "serial") {
      import("@/lib/inventory").then(({ getAvailableSerials }) => {
        getAvailableSerials(value.inventory_item_id!).then(({ data }) => {
          const serial = Array.isArray(data)
            ? data.find((s: any) =>
                s.serial_number?.toLowerCase() === scanned.toLowerCase()
              )
            : null;
          if (serial) {
            // أضف للقائمة الموجودة بدل الاستبدال
            const existingIds = value.serial_ids || [];
            const existingNums = value.serial_numbers || [];
            if (existingIds.includes(serial.id)) return; // تجنب التكرار
            onChange({
              ...value,
              serial_ids: [...existingIds, serial.id],
              serial_numbers: [...existingNums, serial.serial_number],
              quantity: existingIds.length + 1,
              description_ar: `${value.item_name} (${existingNums.length + 1} سيريال)`,
              unit_price: serial.sale_price ? Number(serial.sale_price) : value.unit_price,
            });
          } else {
            alert(ar
              ? `السيريال "${scanned}" غير موجود في مخزونك`
              : `Serial "${scanned}" not found in your stock`);
          }
        }).catch(() => {
          alert(ar ? "خطأ في جلب السيريالات" : "Error fetching serials");
        });
      });
      return;
    }

    // الحالة 2: بحث بالـ SKU
    setShowBarcode(false);
    const found = stockItems.find(s =>
      (s.item_sku || s.sku || "").toLowerCase() === scanned.toLowerCase() ||
      (s.serial_number || "").toLowerCase() === scanned.toLowerCase()
    );
    if (found) {
      const isSerial = found.item_tracking === "serial" || found.tracking_type === "serial";
      onChange({
        mode: isSerial ? "serial" : "item",
        inventory_item_id: found.item_id || found.id,
        item_name: found.item_name || found.name_ar,
        description_ar: found.item_name || found.name_ar,
        unit_price: Number(found.sale_price || 0),
        quantity: isSerial ? 0 : 1,
        available_qty: isSerial ? undefined : Number(found.quantity || found.available_qty || 0),
      });
    } else {
      setQuery(scanned);
      setShowDrop(true);
    }
  };

  const calcDropPos = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropPos({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 280) });
  }, []);

  // فلترة مخزون المندوب بالبحث
  const filtered = query.length >= 1
    ? stockItems.filter(s =>
        (s.item_name || s.name_ar || "").toLowerCase().includes(query.toLowerCase()) ||
        (s.item_sku || s.sku || "").toLowerCase().includes(query.toLowerCase())
      )
    : stockItems.slice(0, 20);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        const portal = document.getElementById("rep-picker-portal");
        if (portal && portal.contains(e.target as Node)) return;
        setShowDrop(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const pickItem = (s: any) => {
    const isSerial = s.item_tracking === "serial" || s.tracking_type === "serial";
    setQuery(""); setShowDrop(false);
    onChange({
      mode: isSerial ? "serial" : "item",
      inventory_item_id: s.item_id || s.id,
      item_name: s.item_name || s.name_ar,
      description_ar: s.item_name || s.name_ar,
      unit_price: Number(s.sale_price || 0),
      quantity: isSerial ? 0 : 1,
      available_qty: isSerial ? undefined : Number(s.quantity || s.available_qty || 0),
    });
  };
  const clear = () => {
    setQuery("");
    onChange({ mode: "free", description_ar: "", unit_price: 0, quantity: 1 });
  };

  // ── لم يُختر صنف بعد ────────────────────────────────────────────
  if (!value.inventory_item_id) {
    const dropContent = (
      <div id="rep-picker-portal" style={{
        position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width,
        zIndex: 99999, background: "white", border: "1px solid var(--border)",
        borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        maxHeight: 300, overflowY: "auto",
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>
            {ar ? "لا يوجد في مخزونك" : "Not in your stock"}
          </div>
        ) : (
          filtered.map((s: any) => {
            const isSerial = s.item_tracking === "serial" || s.tracking_type === "serial";
            const qty = Number(s.quantity || s.available_qty || 0);
            return (
              <div key={s.item_id || s.id} onMouseDown={() => pickItem(s)}
                style={{ padding: "10px 14px", cursor: qty <= 0 && !isSerial ? "not-allowed" : "pointer", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: qty <= 0 && !isSerial ? 0.4 : 1 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.item_name || s.name_ar}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, display: "flex", gap: 8 }}>
                    {s.item_sku && <span>{s.item_sku}</span>}
                    {isSerial
                      ? <span style={{ color: "#5D7E9F", fontWeight: 600 }}>{ar ? "سيريال" : "Serial"}</span>
                      : <span style={{ color: qty > 0 ? "#059669" : "#DC2626" }}>{ar ? "متاح:" : "Avail:"} {qty}</span>
                    }
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#587795" }}>
                  {Number(s.sale_price || 0).toFixed(2)} SAR
                </div>
              </div>
            );
          })
        )}
      </div>
    );

    return (
      <div ref={wrapRef} style={{ position: "relative" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <input ref={inputRef} className="form-input" style={{ flex: 1, minWidth: 0 }}
            value={query}
            onChange={e => { setQuery(e.target.value); calcDropPos(); setShowDrop(true); }}
            onFocus={() => { calcDropPos(); setShowDrop(true); }}
            placeholder={ar ? "ابحث في مخزونك..." : "Search your stock..."}
            dir="rtl" autoComplete="off" />
          {/* زر الباركود */}
          <button type="button" onClick={() => setShowBarcode(true)}
            title={ar ? "مسح باركود" : "Scan barcode"}
            style={{
              width: 40, height: 40, borderRadius: 8, border: "1px solid var(--border)",
              background: "#EFF6FF", color: "#587795", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/>
              <rect x="3" y="16" width="5" height="5"/>
              <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/>
              <path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/>
              <path d="M12 3h.01"/><path d="M12 16v.01"/>
              <path d="M16 12h1"/><path d="M21 12v.01"/>
              <path d="M12 21v-1"/>
            </svg>
          </button>
        </div>
        {showDrop && typeof document !== "undefined" && createPortal(dropContent, document.body)}
        {showBarcode && (
          <BarcodeScanner
            locale={locale}
            onResult={handleBarcodeResult}
            onClose={() => setShowBarcode(false)}
          />
        )}
      </div>
    );
  }

  // ── صنف مختار ───────────────────────────────────────────────────
  const isSerial = value.mode === "serial";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: isSerial ? "#F5F3FF" : "#F0FDF4",
        border: `1px solid ${isSerial ? "#C4B5FD" : "#86EFAC"}`,
        borderRadius: 8, padding: "8px 12px",
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          background: isSerial ? "#5D7E9F" : "#059669",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            {isSerial
              ? <><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></>
              : <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></>
            }
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: isSerial ? "#5B21B6" : "#065F46", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {value.item_name}
          </div>
          {!isSerial && value.available_qty !== undefined && (
            <div style={{ fontSize: 11, color: "#059669" }}>{ar ? "متاح:" : "Avail:"} {value.available_qty}</div>
          )}
          {isSerial && (
            <div style={{ fontSize: 11, color: "#5D7E9F" }}>
              {value.serial_ids?.length
                ? `${value.serial_ids.length} ${ar ? "سيريال محدد" : "serials selected"}`
                : (ar ? "اختر السيريالات..." : "Select serials...")}
            </div>
          )}
        </div>
        <button type="button" onClick={clear}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 18, flexShrink: 0 }}>×</button>
      </div>

      {/* تحديد السيريالات */}
      {isSerial && (
        <div>
          {value.serial_ids && value.serial_ids.length > 0 ? (
            <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>
                  {value.serial_ids.length} {ar ? "سيريال محدد" : "serials selected"}
                </span>
                <button type="button" onClick={() => setShowSerialPicker(true)}
                  style={{ border: "1px solid #059669", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#059669", background: "none", cursor: "pointer" }}>
                  {ar ? "تعديل" : "Edit"}
                </button>
              </div>
              {value.serial_numbers && (
                <div style={{ marginTop: 4, fontSize: 10, color: "#059669", fontFamily: "monospace" }}>
                  {value.serial_numbers.slice(0, 3).join(" · ")}
                  {value.serial_numbers.length > 3 && ` +${value.serial_numbers.length - 3}`}
                </div>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => setShowSerialPicker(true)}
              style={{ width: "100%", padding: "10px", borderRadius: 8, border: "2px dashed #C4B5FD", background: "#F5F3FF", color: "#5D7E9F", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              {ar ? "تحديد السيريالات" : "Select Serials"}
            </button>
          )}

          {showSerialPicker && value.inventory_item_id && (
            <SerialPicker
              locale={locale}
              productId={value.inventory_item_id}
              productName={value.item_name || ""}
              warehouseId={warehouseId}
              onConfirm={selected => {
                // 1. حاول تأخذ السعر من السيريالات المختارة مباشرة
                const prices = selected.map(s => Number((s as any).sale_price || 0)).filter(p => p > 0);
                let finalPrice = prices.length > 0
                  ? prices.reduce((a, b) => a + b, 0) / prices.length
                  : 0;

                // 2. لو ما في سعر في السيريالات، خذه من stockItems (sale_price المنتج)
                if (!finalPrice && value.inventory_item_id) {
                  const stockItem = stockItems.find(s =>
                    (s.item_id || s.id) === value.inventory_item_id
                  );
                  if (stockItem) finalPrice = Number(stockItem.sale_price || 0);
                }

                // 3. احتفظ بالسعر القديم لو ما في شيء
                if (!finalPrice) finalPrice = value.unit_price || 0;

                onChange({
                  ...value,
                  serial_ids: selected.map(s => s.id),
                  serial_numbers: selected.map(s => s.serial_number),
                  quantity: selected.length,
                  unit_price: finalPrice,
                  description_ar: value.item_name || value.description_ar,
                });
                setShowSerialPicker(false);
              }}
              onClose={() => setShowSerialPicker(false)}
            />
          )}

          {/* زر مسح باركود السيريال */}
          <button type="button" onClick={() => setShowBarcode(true)}
            style={{
              marginTop: 4, width: "100%", padding: "9px", borderRadius: 8,
              border: "1px dashed #C4B5FD", background: "#FAFAFF",
              color: "#5D7E9F", fontWeight: 600, fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/>
              <rect x="3" y="16" width="5" height="5"/>
              <path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>
              <path d="M12 3h.01"/><path d="M16 12h1"/><path d="M12 21v-1"/>
            </svg>
            {ar ? "مسح باركود السيريال بالكاميرا" : "Scan serial barcode"}
          </button>
        </div>
      )}

      {showBarcode && (
        <BarcodeScanner
          locale={locale}
          onResult={handleBarcodeResult}
          onClose={() => setShowBarcode(false)}
          continuous={!!(value.inventory_item_id && value.mode === "serial")}
        />
      )}
    </div>
  );
}
