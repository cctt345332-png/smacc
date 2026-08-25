"use client";
/**
 * ItemPicker — مكوّن اختيار الصنف من المخزون
 * أوضاع:
 *   free   — نص حر
 *   item   — صنف بكمية
 *   serial — صنف بسيريالات متعددة (يفتح SerialPicker للبيع، PurchaseSerialInput للشراء)
 *   batch  — صيدلية
 *   variant— ملابس
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { getItemsForPicker, getAvailableSerials } from "@/lib/inventory";
import SerialPicker from "./SerialPicker";
import PurchaseSerialInput, { NewSerial } from "./PurchaseSerialInput";

// جلب متغيرات الصنف (للملابس)
async function getItemVariants(productId: string) {
  const { default: api } = await import("@/lib/api");
  return api.get(`/inventory/items/${productId}/variants`);
}

export type LineMode = "free" | "item" | "serial" | "batch" | "variant";

export interface PickedItem {
  mode: LineMode;
  description_ar: string;
  unit_price: number;
  quantity: number;
  inventory_item_id?: string;
  serial_item_id?: string;
  serial_ids?: string[];            // للبيع — قائمة IDs
  serial_numbers?: string[];        // للبيع — للعرض
  item_name?: string;
  serial_number?: string;
  available_qty?: number;
  condition?: string;
  // للشراء: سيريال واحد legacy
  new_serial_number?: string;
  new_serial_condition?: string;
  new_serial_sale_price?: number;
  // للشراء: سيريالات جماعية (الجديد)
  new_serials?: { serial_number: string; condition: string; sale_price?: number }[];
  // للصيدلية: تشغيلة جديدة
  batch_number?: string;
  batch_expiry_date?: string;
  // للملابس: متغير
  variant_id?: string;
  variant_label?: string;
}

interface Props {
  locale: string;
  value: PickedItem;
  onChange: (v: PickedItem) => void;
  purchaseMode?: boolean;
  warehouseId?: string;
}

const conditionAr: Record<string, string> = {
  new: "جديد", used: "مستعمل", refurbished: "مجدد",
};

export default function ItemPicker({ locale, value, onChange, purchaseMode = false, warehouseId }: Props) {
  const ar = locale === "ar";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [serials, setSerials] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [showSerialPicker, setShowSerialPicker] = useState(false);
  const [showPurchaseSerialInput, setShowPurchaseSerialInput] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  // حساب موضع الـ dropdown — position:fixed يعمل بالنسبة للـ viewport (بدون scrollY)
  const calcDropPos = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropPos({
      top: rect.bottom + 2,          // fixed = viewport coords, لا نضيف scrollY
      left: rect.left,
      width: Math.max(rect.width, 280),
    });
  }, []);

  // بحث في المخزون
  useEffect(() => {
    if (query.length < 1) { setResults([]); setShowDrop(false); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await getItemsForPicker({ search: query });
        setResults(data);
        calcDropPos();
        setShowDrop(true);
      } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [query, calcDropPos]);

  // جلب السيريالات عند اختيار صنف serial
  useEffect(() => {
    if (value.mode === "serial" && value.inventory_item_id) {
      setLoadingSerials(true);
      getAvailableSerials(value.inventory_item_id)
        .then(({ data }) => setSerials(data))
        .catch(() => setSerials([]))
        .finally(() => setLoadingSerials(false));
    }
  }, [value.inventory_item_id, value.mode]);

  // إغلاق dropdown عند الضغط خارجه أو عند الـ scroll
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        const portal = document.getElementById("item-picker-portal");
        if (portal && portal.contains(e.target as Node)) return;
        setShowDrop(false);
      }
    };
    const onScroll = () => {
      if (showDrop) calcDropPos();
    };
    document.addEventListener("mousedown", fn);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", calcDropPos);
    return () => {
      document.removeEventListener("mousedown", fn);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", calcDropPos);
    };
  }, [showDrop, calcDropPos]);

  // اختيار صنف من نتائج البحث
  const pickItem = (item: any) => {
    const isSerial  = item.tracking_type === "serial";
    const isBatch   = item.tracking_type === "batch";
    const isVariant = item.tracking_type === "variant";
    setQuery("");
    setShowDrop(false);
    setSerials([]);
    setVariants([]);
    // جلب المتغيرات للملابس
    if (isVariant) {
      getItemVariants(item.id).then(({ data }) => setVariants(data)).catch(() => setVariants([]));
    }
    onChange({
      mode: isSerial ? "serial" : isBatch ? "batch" : isVariant ? "variant" : "item",
      inventory_item_id: item.id,
      serial_item_id: undefined,
      variant_id: undefined,
      item_name: item.name_ar,
      description_ar: item.name_ar,
      // للسيريال في المشتريات: unit_price = cost_price (تكلفة الشراء للوحدة)
      // sale_price لكل سيريال يُدخل منفصلاً داخل PurchaseSerialInput
      // للسيريال في البيع: unit_price = 0 (يتحدد عند اختيار السيريال الموجود)
      unit_price: purchaseMode
        ? Number(item.cost_price || 0)
        : (isSerial ? 0 : Number(item.sale_price || 0)),
      quantity: 1,
      available_qty: (isSerial || isBatch || isVariant) ? undefined : Number(item.quantity_on_hand ?? 0),
    });
  };

  // اختيار سيريال
  const pickSerial = (s: any) => {
    const price = purchaseMode
      ? Number(s.cost_price)
      : (s.sale_price != null ? Number(s.sale_price) : 0);
    onChange({
      ...value,
      serial_item_id: s.id,
      serial_number: s.serial_number,
      condition: s.condition,
      unit_price: price,
      quantity: 1,
      description_ar: [
        value.item_name,
        s.serial_number,
        s.condition ? conditionAr[s.condition] || s.condition : null,
      ].filter(Boolean).join(" — "),
    });
  };

  // مسح الاختيار والعودة لنص حر
  const clear = () => {
    setQuery("");
    setSerials([]);
    onChange({ mode: "free", description_ar: "", unit_price: 0, quantity: 1 });
  };

  // ─── لم يُختر صنف بعد → حقل بحث ─────────────────────────────────
  if (!value.inventory_item_id) {
    const dropContent = (
      <div
        id="item-picker-portal"
        style={{
          position: "fixed",
          top: dropPos.top,
          left: dropPos.left,
          width: dropPos.width,
          zIndex: 99999,
          background: "white",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          maxHeight: 320,
          overflowY: "auto",
        }}
      >
        {results.length === 0 && query.length > 0 ? (
          <div
            style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}
            onMouseDown={() => {
              onChange({ ...value, mode: "free", description_ar: query });
              setShowDrop(false);
            }}
          >
            {ar ? `استخدام "${query}" كوصف حر` : `Use "${query}" as free text`}
          </div>
        ) : (
          results.map(item => (
            <div
              key={item.id}
              onMouseDown={() => pickItem(item)}
              style={{
                padding: "10px 14px", cursor: "pointer",
                borderBottom: "1px solid #F1F5F9",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
              onMouseLeave={e => (e.currentTarget.style.background = "white")}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
                  {item.name_ar}
                  {item.color ? <span style={{ fontSize: 11, color: "#6B7280", marginRight: 6 }}>({item.color})</span> : null}
                  {item.storage ? <span style={{ fontSize: 11, color: "#6B7280", marginRight: 4 }}>{item.storage}</span> : null}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, display: "flex", gap: 8 }}>
                  <span>{item.sku}</span>
                  {item.tracking_type === "serial" && (
                    <span style={{ color: "#65707E", fontWeight: 600 }}>سيريال</span>
                  )}
                  {item.tracking_type === "quantity" && (
                    <span style={{ color: item.quantity_on_hand > 0 ? "#059669" : "#DC2626" }}>
                      متاح: {item.quantity_on_hand ?? 0}
                    </span>
                  )}
                  {item.category?.name_ar && (
                    <span style={{ color: "#9CA3AF" }}>{item.category.name_ar}</span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", whiteSpace: "nowrap", marginRight: 8 }}>
                {Number(purchaseMode ? item.cost_price : item.sale_price).toFixed(2)} SAR
              </div>
            </div>
          ))
        )}
      </div>
    );

    return (
      <div ref={wrapRef} style={{ position: "relative" }}>
        <input
          ref={inputRef}
          className="form-input"
          style={{ width: "100%", minWidth: 180 }}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            if (!e.target.value) onChange({ ...value, description_ar: "" });
          }}
          onFocus={() => {
            calcDropPos();
            if (query.length >= 1) setShowDrop(true);
          }}
          onKeyDown={() => calcDropPos()}
          placeholder={ar ? "ابحث عن صنف من المخزون..." : "Search inventory item..."}
          dir="rtl"
          autoComplete="off"
        />
        {showDrop && typeof document !== "undefined" && createPortal(dropContent, document.body)}
      </div>
    );
  }

  // ─── صنف مختار ───────────────────────────────────────────────────
  const isSerial = value.mode === "serial";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* بطاقة الصنف المختار */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: isSerial ? "#F5F3FF" : "#F0FDF4",
        border: `1px solid ${isSerial ? "#C4B5FD" : "#86EFAC"}`,
        borderRadius: 8, padding: "8px 12px",
      }}>
        {/* أيقونة النوع */}
        <div style={{
          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          background: isSerial ? "#65707E" : "#059669",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            {isSerial
              ? <><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></>
              : <><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="2"/></>
            }
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: isSerial ? "#5B21B6" : "#065F46", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {value.item_name}
          </div>
          <div style={{ fontSize: 11, color: isSerial ? "#65707E" : "#059669", marginTop: 1 }}>
            {isSerial
              ? (value.serial_number
                  ? `${value.serial_number}${value.condition ? ` — ${conditionAr[value.condition] || value.condition}` : ""}`
                  : (ar ? "اختر سيريال..." : "Select serial..."))
              : (value.available_qty !== undefined
                  ? `متاح: ${value.available_qty} وحدة`
                  : "")
            }
          </div>
        </div>

        <button
          type="button" onClick={clear}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#9CA3AF", fontSize: 18, lineHeight: 1, padding: "0 2px",
            flexShrink: 0,
          }}
          title={ar ? "تغيير الصنف" : "Change item"}
        >×</button>
      </div>

      {/* حقول التشغيلة — للصيدلية في وضع الشراء فقط */}
      {value.mode === "batch" && purchaseMode && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {ar ? "بيانات التشغيلة" : "Batch Details"}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 2 }}>
              <input
                className="form-input"
                style={{ fontSize: 12, width: "100%" }}
                value={value.batch_number || ""}
                onChange={e => onChange({ ...value, batch_number: e.target.value })}
                placeholder={ar ? "رقم التشغيلة (LOT) *" : "Batch/LOT Number *"}
                dir="ltr"
              />
            </div>
            <div style={{ flex: 2 }}>
              <input
                type="date"
                className="form-input"
                style={{ fontSize: 12, width: "100%" }}
                value={value.batch_expiry_date || ""}
                onChange={e => onChange({ ...value, batch_expiry_date: e.target.value })}
                title={ar ? "تاريخ الانتهاء *" : "Expiry Date *"}
              />
            </div>
          </div>
          {(!value.batch_number || !value.batch_expiry_date) && (
            <div style={{ fontSize: 11, color: "#DC2626" }}>
              {ar ? "رقم التشغيلة وتاريخ الانتهاء مطلوبان" : "Batch number and expiry date are required"}
            </div>
          )}
        </div>
      )}

      {/* في وضع البيع — التشغيلة تُخصم تلقائياً FEFO */}
      {value.mode === "batch" && !purchaseMode && (
        <div style={{ fontSize: 11, color: "#059669", padding: "4px 8px", background: "#F0FDF4", borderRadius: 6, border: "1px solid #BBF7D0" }}>
          {ar ? "سيُخصم تلقائياً من الأقرب للانتهاء (FEFO)" : "Auto-deducted from nearest expiry (FEFO)"}
        </div>
      )}
      {isSerial && (
        <div>
          {purchaseMode ? (
            /* ── وضع الشراء: إدخال سيريالات جديدة بالجملة ── */
            <div>
              {value.new_serials && value.new_serials.length > 0 ? (
                /* عرض السيريالات المدخلة */
                <div style={{ background: "#F5F3FF", border: "1px solid #C4B5FD", borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#65707E" }}>
                      📦 {value.new_serials.length} {ar ? "سيريال جديد" : "new serials"}
                    </span>
                    <button type="button" onClick={() => setShowPurchaseSerialInput(true)}
                      style={{ background: "none", border: "1px solid #65707E", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#65707E", cursor: "pointer" }}>
                      {ar ? "تعديل" : "Edit"}
                    </button>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, color: "#65707E", fontFamily: "monospace" }}>
                    {value.new_serials.slice(0, 3).map(s => s.serial_number).join(" · ")}
                    {value.new_serials.length > 3 && ` +${value.new_serials.length - 3}`}
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setShowPurchaseSerialInput(true)}
                  style={{
                    width: "100%", padding: "10px", borderRadius: 8, border: "2px dashed #C4B5FD",
                    background: "#F5F3FF", color: "#65707E", fontWeight: 600, fontSize: 13,
                    cursor: "pointer", textAlign: "center",
                  }}>
                  📦 {ar ? "إضافة أرقام السيريالات الجديدة" : "Add New Serial Numbers"}
                </button>
              )}

              {/* PurchaseSerialInput Modal */}
              {showPurchaseSerialInput && (
                <PurchaseSerialInput
                  locale={locale}
                  productName={value.item_name || ""}
                  initialSerials={value.new_serials as NewSerial[] | undefined}
                  onConfirm={(newSerials) => {
                    onChange({
                      ...value,
                      new_serials: newSerials,
                      quantity: newSerials.length,
                      description_ar: value.item_name || value.description_ar,
                    });
                    setShowPurchaseSerialInput(false);
                  }}
                  onClose={() => setShowPurchaseSerialInput(false)}
                />
              )}

              {(!value.new_serials || value.new_serials.length === 0) && (
                <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>
                  {ar ? "أضف أرقام السيريالات لتسجيلها في المخزون عند التأكيد" : "Add serial numbers to register them in inventory on confirm"}
                </div>
              )}
            </div>
          ) : (
            /* ── وضع البيع: تحديد سيريالات متعددة ── */
            <div>
              {/* إذا عنده سيريالات محددة → عرضها */}
              {value.serial_ids && value.serial_ids.length > 0 ? (
                <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>
                      ✅ {value.serial_ids.length} {ar ? "سيريال محدد" : "serials selected"}
                    </span>
                    <button type="button" onClick={() => setShowSerialPicker(true)}
                      style={{ background: "none", border: "1px solid #059669", borderRadius: 6, padding: "3px 8px", fontSize: 11, color: "#059669", cursor: "pointer" }}>
                      {ar ? "تعديل" : "Edit"}
                    </button>
                  </div>
                  {value.serial_numbers && value.serial_numbers.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 10, color: "#059669", fontFamily: "monospace" }}>
                      {value.serial_numbers.slice(0, 3).join(" · ")}
                      {value.serial_numbers.length > 3 && ` +${value.serial_numbers.length - 3}`}
                    </div>
                  )}
                </div>
              ) : (
                <button type="button" onClick={() => setShowSerialPicker(true)}
                  style={{
                    width: "100%", padding: "10px", borderRadius: 8, border: "2px dashed #C4B5FD",
                    background: "#F5F3FF", color: "#65707E", fontWeight: 600, fontSize: 13,
                    cursor: "pointer", textAlign: "center",
                  }}>
                  📋 {ar ? "تحديد السيريالات من المخزون" : "Select Serials from Stock"}
                </button>
              )}

              {/* SerialPicker Modal */}
              {showSerialPicker && value.inventory_item_id && (
                <SerialPicker
                  locale={locale}
                  productId={value.inventory_item_id}
                  productName={value.item_name || ""}
                  warehouseId={warehouseId}
                  onConfirm={(selected) => {
                    onChange({
                      ...value,
                      serial_ids: selected.map(s => s.id),
                      serial_numbers: selected.map(s => s.serial_number),
                      quantity: selected.length,
                      description_ar: value.item_name || value.description_ar,
                    });
                    setShowSerialPicker(false);
                  }}
                  onClose={() => setShowSerialPicker(false)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
