"use client";
/**
 * صفحة مسح السيريالات — مصممة لماسح الباركود
 * - الحقل دائماً في focus
 * - تمنع أي اختصار لوحة مفاتيح من الهروب
 * - تدعم QR المجمع (20 سيريال دفعة واحدة)
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getItems, addSerialsBulk, getWarehouses } from "@/lib/inventory";

const fmt = (n: any) => Number(n || 0).toFixed(0);

export default function ScanPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("product_id");
  const productName = searchParams.get("product_name") || "";

  const inputRef = useRef<HTMLInputElement>(null);
  const [buffer, setBuffer] = useState("");
  const [scanned, setScanned] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [condition, setCondition] = useState("new");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [lastAdded, setLastAdded] = useState<string>("");

  // دائماً في focus
  const keepFocus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    getWarehouses().then(({ data }) => setWarehouses(Array.isArray(data) ? data : [])).catch(() => {});
    // Focus فوراً
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // إعادة focus كل ثانية
  useEffect(() => {
    const interval = setInterval(keepFocus, 800);
    return () => clearInterval(interval);
  }, [keepFocus]);

  // منع أي اختصار من الهروب
  useEffect(() => {
    const prevent = (e: KeyboardEvent) => {
      // منع Ctrl+F, Ctrl+L, F5, إلخ
      if (e.ctrlKey || e.metaKey || e.key === "F5") {
        if (["f", "l", "t", "w", "r"].includes(e.key.toLowerCase())) {
          e.preventDefault();
        }
      }
      // إعادة focus دائماً
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", prevent, true);
    return () => window.removeEventListener("keydown", prevent, true);
  }, []);

  const processInput = (raw: string) => {
    // استخراج الأرقام من QR مجمع أو سيريال واحد
    const extracted = raw
      .split(/[\r\n\t ,;|]+/)
      .map(s => s.replace(/[^\w\-]/g, "").trim())
      .filter(s => s.length >= 8);

    if (extracted.length === 0) return;

    const toAdd = extracted.filter(s => !scanned.includes(s));
    if (toAdd.length > 0) {
      setScanned(prev => [...prev, ...toAdd]);
      setLastAdded(toAdd[toAdd.length - 1]);
      // صوت أو إشارة بصرية
      setTimeout(() => setLastAdded(""), 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (buffer.trim()) {
        processInput(buffer.trim());
        setBuffer("");
      }
    }
  };

  const handleSave = async () => {
    if (!productId) return alert(ar ? "لا يوجد منتج محدد" : "No product selected");
    if (scanned.length === 0) return alert(ar ? "لا توجد سيريالات" : "No serials scanned");

    setSaving(true);
    setErrors([]);
    try {
      const { data } = await addSerialsBulk(productId, {
        condition,
        cost_price: parseFloat(costPrice) || 0,
        sale_price: parseFloat(salePrice) || 0,
        warehouse_id: warehouseId || null,
        serials: scanned.map(sn => ({ serial_number: sn })),
      });
      setSaved(data.added || 0);
      if (data.errors?.length > 0) {
        setErrors(data.errors.map((e: any) => `${e.serial_number}: ${e.error}`));
      }
      if (data.added > 0) {
        setScanned([]);
        setTimeout(() => {
          router.push(`/${locale}/inventory/serials`);
        }, 2000);
      }
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0F172A", display: "flex", flexDirection: "column",
      padding: 0, margin: 0, color: "white",
    }}
      onClick={keepFocus}
    >
      {/* Header */}
      <div style={{ background: "#1E293B", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #334155" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>📷 {ar ? "وضع المسح" : "Scan Mode"}</div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>
            {productName || (ar ? "اختر المنتج من صفحة السيريالات" : "Select product from serials page")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ background: "#059669", borderRadius: 20, padding: "4px 14px", fontSize: 13, fontWeight: 700 }}>
            {scanned.length} {ar ? "سيريال" : "serials"}
          </div>
          <button onClick={() => router.push(`/${locale}/inventory/serials`)}
            style={{ background: "#334155", border: "none", color: "#94A3B8", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
            {ar ? "← رجوع" : "← Back"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 320px", gap: 0 }}>

        {/* ─── منطقة المسح الرئيسية ─── */}
        <div style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start" }}>

          {/* حقل المسح */}
          <div style={{ width: "100%", maxWidth: 500, marginBottom: 32 }}>
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 8, textAlign: "center" }}>
              {ar ? "🎯 وجّه الماسح نحو الباركود — يُضاف تلقائياً" : "🎯 Point scanner at barcode — adds automatically"}
            </div>
            <div style={{ position: "relative" }}>
              <input
                ref={inputRef}
                value={buffer}
                onChange={e => setBuffer(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={keepFocus}
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                style={{
                  width: "100%", padding: "16px 20px", fontSize: 18,
                  fontFamily: "monospace", fontWeight: 700,
                  background: "#1E293B", border: "2px solid #3B82F6",
                  borderRadius: 12, color: "white", outline: "none",
                  boxSizing: "border-box", caretColor: "#3B82F6",
                  boxShadow: "0 0 0 4px rgba(59,130,246,0.2)",
                }}
                placeholder={ar ? "الماسح جاهز..." : "Scanner ready..."}
              />
              {buffer && (
                <div style={{ position: "absolute", insetInlineEnd: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#94A3B8" }}>
                  Enter ↵
                </div>
              )}
            </div>

            {/* آخر مُضاف */}
            {lastAdded && (
              <div style={{ marginTop: 12, background: "#064E3B", border: "1px solid #059669", borderRadius: 10, padding: "10px 16px", textAlign: "center", animation: "fadeIn 0.3s" }}>
                <div style={{ fontSize: 11, color: "#6EE7B7" }}>{ar ? "✅ تمت الإضافة" : "✅ Added"}</div>
                <code style={{ fontSize: 16, fontWeight: 800, color: "#34D399" }}>{lastAdded}</code>
              </div>
            )}
          </div>

          {/* قائمة السيريالات المُمسوحة */}
          <div style={{ width: "100%", maxWidth: 500 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0" }}>
                {ar ? "السيريالات المُمسوحة" : "Scanned Serials"}
                <span style={{ marginInlineStart: 8, background: "#3B82F6", borderRadius: 20, padding: "2px 10px", fontSize: 12 }}>{scanned.length}</span>
              </div>
              {scanned.length > 0 && (
                <button onClick={() => { if (confirm(ar ? "مسح الكل؟" : "Clear all?")) setScanned([]); }}
                  style={{ background: "none", border: "1px solid #EF4444", color: "#EF4444", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                  {ar ? "مسح الكل" : "Clear All"}
                </button>
              )}
            </div>

            {scanned.length === 0 ? (
              <div style={{ textAlign: "center", color: "#475569", padding: "40px 0", fontSize: 14 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
                {ar ? "ابدأ المسح..." : "Start scanning..."}
              </div>
            ) : (
              <div style={{ maxHeight: 380, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {scanned.map((sn, i) => (
                  <div key={sn} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "#1E293B", border: "1px solid #334155",
                    borderRadius: 8, padding: "8px 12px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, color: "#64748B", minWidth: 20 }}>{i + 1}</span>
                      <code style={{ fontSize: 12, fontWeight: 700, color: "#E2E8F0" }}>{sn}</code>
                    </div>
                    <button onClick={() => setScanned(p => p.filter(x => x !== sn))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* نتيجة الحفظ */}
          {saved > 0 && (
            <div style={{ marginTop: 20, background: "#064E3B", border: "1px solid #059669", borderRadius: 12, padding: "16px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 32 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#34D399", marginTop: 8 }}>
                {ar ? `تم إضافة ${saved} سيريال بنجاح` : `${saved} serials added successfully`}
              </div>
              <div style={{ fontSize: 12, color: "#6EE7B7", marginTop: 4 }}>{ar ? "جاري التحويل..." : "Redirecting..."}</div>
            </div>
          )}

          {errors.length > 0 && (
            <div style={{ marginTop: 12, background: "#450A0A", border: "1px solid #EF4444", borderRadius: 10, padding: 12, width: "100%", maxWidth: 500 }}>
              <div style={{ fontSize: 12, color: "#FCA5A5", fontWeight: 700, marginBottom: 6 }}>
                {ar ? `أخطاء (${errors.length})` : `Errors (${errors.length})`}
              </div>
              {errors.slice(0, 5).map((e, i) => <div key={i} style={{ fontSize: 11, color: "#FCA5A5", fontFamily: "monospace" }}>{e}</div>)}
            </div>
          )}
        </div>

        {/* ─── الإعدادات ─── */}
        <div style={{ background: "#1E293B", borderInlineStart: "1px solid #334155", padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0" }}>{ar ? "⚙️ إعدادات الإضافة" : "⚙️ Add Settings"}</div>

          <div>
            <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 6 }}>{ar ? "الحالة" : "Condition"}</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[{ v: "new", label: ar ? "جديد" : "New" }, { v: "used", label: ar ? "مستخدم" : "Used" }, { v: "refurbished", label: ar ? "مجدد" : "Refurb" }].map(c => (
                <button key={c.v} onClick={() => setCondition(c.v)}
                  style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: "1px solid", borderColor: condition === c.v ? "#3B82F6" : "#334155", background: condition === c.v ? "#3B82F6" : "#0F172A", color: condition === c.v ? "white" : "#94A3B8", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 6 }}>{ar ? "سعر الشراء" : "Cost Price"}</label>
            <input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)}
              onFocus={() => setTimeout(keepFocus, 100)}
              style={{ width: "100%", padding: "10px 12px", background: "#0F172A", border: "1px solid #334155", borderRadius: 8, color: "white", fontSize: 14, boxSizing: "border-box" }}
              placeholder="0.00" />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 6 }}>{ar ? "سعر البيع" : "Sale Price"}</label>
            <input type="number" value={salePrice} onChange={e => setSalePrice(e.target.value)}
              onFocus={() => setTimeout(keepFocus, 100)}
              style={{ width: "100%", padding: "10px 12px", background: "#0F172A", border: "1px solid #334155", borderRadius: 8, color: "white", fontSize: 14, boxSizing: "border-box" }}
              placeholder="0.00" />
            {costPrice && salePrice && (
              <div style={{ marginTop: 6, fontSize: 12, color: parseFloat(salePrice) >= parseFloat(costPrice) ? "#34D399" : "#EF4444" }}>
                {ar ? "الربح:" : "Profit:"} {(parseFloat(salePrice) - parseFloat(costPrice)).toFixed(2)} SAR
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#94A3B8", display: "block", marginBottom: 6 }}>{ar ? "المستودع" : "Warehouse"}</label>
            <select value={warehouseId} onChange={e => { setWarehouseId(e.target.value); setTimeout(keepFocus, 50); }}
              style={{ width: "100%", padding: "10px 12px", background: "#0F172A", border: "1px solid #334155", borderRadius: 8, color: "white", fontSize: 13, boxSizing: "border-box" }}>
              <option value="">— {ar ? "اختر" : "Select"} —</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
            </select>
          </div>

          <div style={{ flex: 1 }} />

          <button onClick={handleSave} disabled={saving || scanned.length === 0}
            style={{
              background: scanned.length > 0 ? "#059669" : "#1E293B",
              border: "none", color: "white", padding: "14px", borderRadius: 12,
              fontWeight: 700, fontSize: 15, cursor: scanned.length > 0 ? "pointer" : "not-allowed",
              opacity: scanned.length === 0 ? 0.5 : 1,
            }}>
            {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? `💾 حفظ ${scanned.length} سيريال` : `💾 Save ${scanned.length} serials`)}
          </button>
        </div>
      </div>
    </div>
  );
}
