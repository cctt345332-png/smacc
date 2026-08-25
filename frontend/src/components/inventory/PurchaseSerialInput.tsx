"use client";
/**
 * PurchaseSerialInput — إدخال سيريالات جديدة بالجملة للمشتريات
 * يتيح:
 *   - إدخال قائمة أرقام سيريالات (لصق / Excel) واحدة تلو الأخرى
 *   - ضبط الحالة وسعر البيع لكل الدفعة
 * عند التأكيد يُعيد قائمة: [{ serial_number, condition, sale_price }]
 */
import { useState } from "react";

export interface NewSerial {
  serial_number: string;
  condition: "new" | "used" | "refurbished";
  sale_price?: number;
}

interface Props {
  locale: string;
  productName: string;
  onConfirm: (serials: NewSerial[]) => void;
  onClose: () => void;
  initialSerials?: NewSerial[];
}

const conditionLabel: Record<string, Record<string, string>> = {
  ar: { new: "جديد", used: "مستعمل", refurbished: "مجدد" },
  en: { new: "New", used: "Used", refurbished: "Refurbished" },
};

export default function PurchaseSerialInput({ locale, productName, onConfirm, onClose, initialSerials }: Props) {
  const ar = locale === "ar";
  const [tab, setTab] = useState<"paste" | "manual">(
    initialSerials && initialSerials.length > 0 ? "manual" : "paste"
  );
  const [pasteText, setPasteText] = useState("");
  const [defaultCondition, setDefaultCondition] = useState<"new" | "used" | "refurbished">("new");
  const [defaultSalePrice, setDefaultSalePrice] = useState("");
  const [serials, setSerials] = useState<NewSerial[]>(initialSerials || []);

  // تحليل النص الملصوق وتحويله لقائمة
  const handleParsePaste = () => {
    const lines = pasteText
      .split(/[\r\n]+/)
      .map(l => l.trim())
      .filter(l => l.length >= 4);

    if (!lines.length) return;

    const parsed: NewSerial[] = lines.map(sn => ({
      serial_number: sn,
      condition: defaultCondition,
      sale_price: parseFloat(defaultSalePrice) || undefined,
    }));

    setSerials(prev => {
      // تجنب التكرار
      const existing = new Set(prev.map(s => s.serial_number));
      const unique = parsed.filter(p => !existing.has(p.serial_number));
      return [...prev, ...unique];
    });
    setPasteText("");
  };

  const updateSerial = (idx: number, field: keyof NewSerial, value: any) => {
    setSerials(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const removeSerial = (idx: number) => {
    setSerials(prev => prev.filter((_, i) => i !== idx));
  };

  const applyToAll = () => {
    setSerials(prev => prev.map(s => ({
      ...s,
      condition: defaultCondition,
      sale_price: parseFloat(defaultSalePrice) || s.sale_price,
    })));
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#75617F" }}>
              📦 {ar ? "إضافة سيريالات جديدة" : "Add New Serials"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{productName}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{
              background: serials.length > 0 ? "#75617F" : "#F1F5F9",
              color: serials.length > 0 ? "white" : "var(--text-muted)",
              borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 700,
            }}>
              {serials.length} {ar ? "سيريال" : "serials"}
            </span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-muted)" }}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "2px solid var(--border)", flexShrink: 0 }}>
          {([
            { key: "paste", label: ar ? "📄 Excel / لصق" : "📄 Excel / Paste" },
            { key: "manual", label: ar ? "✏️ تعديل القائمة" : "✏️ Edit List" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: "10px", background: "none", border: "none",
                borderBottom: tab === t.key ? "2px solid #75617F" : "2px solid transparent",
                color: tab === t.key ? "#75617F" : "var(--text-secondary)",
                fontWeight: tab === t.key ? 700 : 500, fontSize: 13, cursor: "pointer", marginBottom: -2,
              }}>
              {t.label}
              {t.key === "manual" && serials.length > 0 && (
                <span style={{ marginInlineStart: 6, background: "#75617F", color: "white", borderRadius: 10, padding: "1px 6px", fontSize: 11 }}>
                  {serials.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

          {/* الإعدادات الافتراضية — تظهر في كلا التبويبين */}
          <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#75617F", marginBottom: 8 }}>
              {ar ? "إعدادات افتراضية للدفعة" : "Batch Default Settings"}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {(["new", "used", "refurbished"] as const).map(c => (
                  <button key={c} type="button" onClick={() => setDefaultCondition(c)}
                    style={{
                      padding: "5px 10px", borderRadius: 6, fontSize: 12, border: "1px solid",
                      borderColor: defaultCondition === c ? "#75617F" : "var(--border)",
                      background: defaultCondition === c ? "#75617F" : "white",
                      color: defaultCondition === c ? "white" : "var(--text-secondary)",
                      cursor: "pointer", fontWeight: 600,
                    }}>
                    {conditionLabel[ar ? "ar" : "en"][c]}
                  </button>
                ))}
              </div>
              <input
                type="number"
                className="form-input"
                style={{ width: 130, fontSize: 12 }}
                value={defaultSalePrice}
                onChange={e => setDefaultSalePrice(e.target.value)}
                placeholder={ar ? "سعر البيع الافتراضي" : "Default Sale Price"}
                min="0"
              />
              {serials.length > 0 && (
                <button type="button" onClick={applyToAll}
                  style={{ padding: "5px 10px", borderRadius: 6, fontSize: 12, border: "1px solid #75617F", background: "white", color: "#75617F", cursor: "pointer", fontWeight: 600 }}>
                  {ar ? "تطبيق على الكل" : "Apply to All"}
                </button>
              )}
            </div>
          </div>

          {/* تبويب اللصق */}
          {tab === "paste" && (
            <div>
              <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: "#92400E" }}>
                {ar
                  ? "الصق أرقام السيريالات الجديدة (سطر لكل رقم أو من Excel — عمود واحد) ثم اضغط إضافة"
                  : "Paste new serial numbers (one per line or from Excel) then click Add"}
              </div>
              <textarea
                className="form-input"
                style={{ width: "100%", minHeight: 140, fontFamily: "monospace", fontSize: 12, direction: "ltr" }}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={"SN123456789\nSN987654321\n358743810023211\n..."}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleParsePaste();
                  }
                }}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleParsePaste}
                  disabled={!pasteText.trim()}
                >
                  ➕ {ar ? "إضافة للقائمة" : "Add to List"}
                </button>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {ar ? "أو Ctrl+Enter" : "or Ctrl+Enter"}
                </span>
                {serials.length > 0 && (
                  <span style={{ fontSize: 12, color: "#75617F", marginInlineStart: "auto", fontWeight: 700 }}>
                    ✅ {serials.length} {ar ? "سيريال في القائمة" : "serials in list"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* تبويب تعديل القائمة */}
          {tab === "manual" && (
            <div>
              {serials.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 32, fontSize: 13 }}>
                  {ar ? "القائمة فارغة — الصق أرقام السيريالات من التبويب الأول" : "List is empty — paste serial numbers from the first tab"}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {/* رأس الجدول */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 32px", gap: 6, padding: "4px 6px", fontSize: 11, color: "var(--text-muted)", fontWeight: 700 }}>
                    <span>{ar ? "رقم السيريال" : "Serial Number"}</span>
                    <span>{ar ? "الحالة" : "Condition"}</span>
                    <span>{ar ? "سعر البيع" : "Sale Price"}</span>
                    <span></span>
                  </div>
                  {serials.map((s, idx) => (
                    <div key={idx} style={{
                      display: "grid", gridTemplateColumns: "1fr 110px 110px 32px",
                      gap: 6, alignItems: "center",
                      padding: "4px 6px", borderRadius: 6,
                      background: idx % 2 === 0 ? "#FAFAFA" : "white",
                      border: "1px solid #F1F5F9",
                    }}>
                      <input
                        className="form-input"
                        style={{ fontSize: 12, fontFamily: "monospace" }}
                        value={s.serial_number}
                        onChange={e => updateSerial(idx, "serial_number", e.target.value)}
                        dir="ltr"
                      />
                      <select
                        className="form-input form-select"
                        style={{ fontSize: 11 }}
                        value={s.condition}
                        onChange={e => updateSerial(idx, "condition", e.target.value)}
                      >
                        <option value="new">{ar ? "جديد" : "New"}</option>
                        <option value="used">{ar ? "مستعمل" : "Used"}</option>
                        <option value="refurbished">{ar ? "مجدد" : "Refurbished"}</option>
                      </select>
                      <input
                        type="number"
                        className="form-input"
                        style={{ fontSize: 12 }}
                        value={s.sale_price ?? ""}
                        onChange={e => updateSerial(idx, "sale_price", parseFloat(e.target.value) || undefined)}
                        placeholder="0"
                        min="0"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => removeSerial(idx)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 16, lineHeight: 1 }}
                        title={ar ? "حذف" : "Remove"}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {serials.length > 0 ? (
              <span style={{ color: "#75617F", fontWeight: 700 }}>
                {serials.length} {ar ? "سيريال جاهز للإضافة" : "serials ready to add"}
              </span>
            ) : (
              <span>{ar ? "أضف السيريالات أولاً" : "Add serials first"}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: "#75617F", borderColor: "#75617F" }}
              onClick={() => onConfirm(serials.filter(s => s.serial_number.trim()))}
              disabled={serials.filter(s => s.serial_number.trim()).length === 0}
            >
              ✅ {ar ? `تأكيد ${serials.filter(s => s.serial_number.trim()).length} سيريال` : `Confirm ${serials.filter(s => s.serial_number.trim()).length} serials`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
