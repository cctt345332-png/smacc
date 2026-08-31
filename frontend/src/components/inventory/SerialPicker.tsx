"use client";
/**
 * SerialPicker — يُفتح عند اختيار صنف serial في الفاتورة
 * يتيح تحديد عدة سيريالات: من قائمة المخزون أو رفع Excel/لصق
 * يتحقق من وجودها في المخزون
 */
import { useEffect, useState } from "react";
import api from "@/lib/api";

interface Props {
  locale: string;
  productId: string;
  productName: string;
  warehouseId?: string;   // مستودع المندوب أو null للعام
  maxQty?: number;
  onConfirm: (serials: { id: string; serial_number: string; sale_price?: number | null }[]) => void;
  onClose: () => void;
}

export default function SerialPicker({ locale, productId, productName, warehouseId, onConfirm, onClose }: Props) {
  const ar = locale === "ar";
  const [tab, setTab] = useState<"list" | "paste">("list");
  const [available, setAvailable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);   // IDs
  const [pasteText, setPasteText] = useState("");
  const [validating, setValidating] = useState(false);
  const [validResult, setValidResult] = useState<any>(null);

  // جلب السيريالات المتاحة
  useEffect(() => {
    const params: any = { product_id: productId };
    if (warehouseId) params.warehouse_id = warehouseId;
    // إذا لا يوجد مستودع محدد — نجلب كل السيريالات المتاحة للمنتج
    const url = warehouseId
      ? `/inventory/serials/by-warehouse`
      : `/inventory/items/${productId}/available-serials`;

    api.get(url, { params: warehouseId ? params : {} })
      .then(({ data }) => setAvailable(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId, warehouseId]);

  // التحقق من السيريالات الملصوقة
  const handleValidate = async () => {
    const sns = pasteText.split(/[\r\n\t,;]+/).map(s => s.trim()).filter(s => s.length >= 8);
    if (!sns.length) return;
    setValidating(true);
    try {
      if (warehouseId) {
        const { data } = await api.post("/inventory/stock/validate-serials", {
          serial_numbers: sns, warehouse_id: warehouseId,
        });
        setValidResult(data);
        if (data.found?.length) setSelected(data.found.map((f: any) => f.serial_id));
      } else {
        // بدون مستودع — نبحث مباشرة
        const { data } = await api.get("/inventory/serials/search", { params: { q: sns[0] } });
        // للبساطة: نبحث كل سيريال
        const found: any[] = [];
        const notFound: string[] = [];
        for (const sn of sns) {
          const match = available.find((a: any) => a.serial_number === sn);
          if (match) found.push({ serial_number: sn, serial_id: match.id });
          else notFound.push(sn);
        }
        setValidResult({ found, not_found: notFound, wrong_warehouse: [] });
        setSelected(found.map((f: any) => f.serial_id));
      }
    } catch {} finally { setValidating(false); }
  };

  const selectedSerials = available.filter((s: any) => selected.includes(s.id || s.serial_id));

  const handleConfirm = () => {
    const serials = available
      .filter((s: any) => selected.includes(s.id))
      .map((s: any) => ({ id: s.id, serial_number: s.serial_number, sale_price: s.sale_price ?? null }));
    onConfirm(serials);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{ar ? "تحديد السيريالات" : "Select Serials"}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{productName}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ background: selected.length > 0 ? "#6F4A84" : "#F1F5F9", color: selected.length > 0 ? "white" : "var(--text-muted)", borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 700 }}>
              {selected.length} {ar ? "مختار" : "selected"}
            </span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-muted)" }}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "2px solid var(--border)", flexShrink: 0 }}>
          {([
            { key: "list", label: ar ? "📋 من القائمة" : "📋 From List" },
            { key: "paste", label: ar ? "📄 Excel / لصق" : "📄 Excel / Paste" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ flex: 1, padding: "10px", background: "none", border: "none", borderBottom: tab === t.key ? "2px solid var(--primary)" : "2px solid transparent", color: tab === t.key ? "var(--primary)" : "var(--text-secondary)", fontWeight: tab === t.key ? 700 : 500, fontSize: 13, cursor: "pointer", marginBottom: -2 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

          {/* قائمة */}
          {tab === "list" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {ar ? "المتاح في المخزون" : "Available in stock"}
                  <span style={{ marginInlineStart: 6, background: "#5A187E", color: "white", borderRadius: 20, padding: "1px 8px", fontSize: 11 }}>{available.length}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setSelected(available.map((s: any) => s.id))}>
                    {ar ? "الكل" : "All"}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setSelected([])}>
                    {ar ? "إلغاء" : "Clear"}
                  </button>
                </div>
              </div>
              {loading ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
              ) : available.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>{ar ? "لا توجد سيريالات متاحة" : "No serials available"}</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                  {available.map((s: any) => {
                    const checked = selected.includes(s.id);
                    return (
                      <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: `1px solid ${checked ? "var(--primary)" : "var(--border)"}`, background: checked ? "#EFF6FF" : "white", cursor: "pointer", fontSize: 12 }}>
                        <input type="checkbox" checked={checked} onChange={e => setSelected(prev => e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id))} />
                        <div>
                          <code style={{ fontWeight: 700, fontSize: 12 }}>{s.serial_number}</code>
                          {s.condition && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{s.condition}</div>}
                        </div>
                        {s.sale_price && <span style={{ marginInlineStart: "auto", fontSize: 11, color: "#6F4A84" }}>{Number(s.sale_price).toFixed(0)}</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Excel/Paste */}
          {tab === "paste" && (
            <>
              <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: "#92400E" }}>
                {ar ? "الصق أرقام السيريالات (سطر لكل رقم أو من Excel) ثم اضغط تحقق" : "Paste serial numbers (one per line or from Excel) then click Validate"}
              </div>
              <textarea className="form-input" style={{ width: "100%", minHeight: 120, fontFamily: "monospace", fontSize: 12, direction: "ltr" }}
                value={pasteText} onChange={e => setPasteText(e.target.value)}
                placeholder={"358743810023211\n358743810020951\n..."} />
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={handleValidate} disabled={validating || !pasteText.trim()}>
                  {validating ? "..." : (ar ? "🔍 تحقق من المخزون" : "🔍 Validate")}
                </button>
                {validResult && (
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: "#6F4A84", fontWeight: 700 }}>✅ {validResult.found?.length}</span>
                    {validResult.not_found?.length > 0 && <span style={{ color: "#DC2626", marginInlineStart: 8 }}>❌ {validResult.not_found.length} {ar ? "غير موجود" : "not found"}</span>}
                    {validResult.wrong_warehouse?.length > 0 && <span style={{ color: "#D97706", marginInlineStart: 8 }}>⚠️ {validResult.wrong_warehouse.length} {ar ? "مستودع آخر" : "wrong wh"}</span>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={selected.length === 0}>
            {ar ? `✅ تأكيد ${selected.length} سيريال` : `✅ Confirm ${selected.length} serials`}
          </button>
        </div>
      </div>
    </div>
  );
}
