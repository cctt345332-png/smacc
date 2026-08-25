"use client";
/**
 * ReturnSerialPicker — اختيار السيريالات المُرجَعة في مرتجعات المشتريات
 * يجلب السيريالات المرتبطة بالفاتورة الأصلية ويتيح اختيار المُرجَع منها
 */
import { useEffect, useState } from "react";
import { getBillSerials } from "@/lib/purchases";

interface Serial {
  id: string;
  serial_number: string;
  condition: string;
  status: string;
  cost_price: number;
}

interface Props {
  locale: string;
  productId: string;
  productName: string;
  billId: string;
  selectedIds: string[];
  onConfirm: (serials: { id: string; serial_number: string }[]) => void;
  onClose: () => void;
}

const conditionAr: Record<string, string> = {
  new: "جديد", used: "مستعمل", refurbished: "مجدد",
};

const statusColor: Record<string, string> = {
  in_stock: "#059669",
  sold: "#5D7E9F",
  returned: "#D97706",
};

export default function ReturnSerialPicker({ locale, productId, productName, billId, selectedIds, onConfirm, onClose }: Props) {
  const ar = locale === "ar";
  const [serials, setSerials] = useState<Serial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>(selectedIds);

  useEffect(() => {
    getBillSerials(billId, productId)
      .then(({ data }) => setSerials(Array.isArray(data) ? data : []))
      .catch(() => setSerials([]))
      .finally(() => setLoading(false));
  }, [billId, productId]);

  const handleConfirm = () => {
    const result = serials
      .filter(s => selected.includes(s.id))
      .map(s => ({ id: s.id, serial_number: s.serial_number }));
    onConfirm(result);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 580, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#DC2626" }}>
              ↩️ {ar ? "تحديد السيريالات المُرجَعة" : "Select Returned Serials"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{productName}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{
              background: selected.length > 0 ? "#DC2626" : "#F1F5F9",
              color: selected.length > 0 ? "white" : "var(--text-muted)",
              borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 700,
            }}>
              {selected.length} {ar ? "مختار" : "selected"}
            </span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-muted)" }}>✕</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>
              {ar ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : serials.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div>{ar ? "لا توجد سيريالات مرتبطة بهذه الفاتورة" : "No serials linked to this bill"}</div>
              <div style={{ fontSize: 12, marginTop: 4, color: "#9CA3AF" }}>
                {ar ? "تأكد أن الفاتورة تم تأكيدها وأن الأصناف مسرّلة" : "Make sure the bill was confirmed and items are serialized"}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {ar ? "السيريالات في هذه الفاتورة" : "Serials in this bill"}
                  <span style={{ marginInlineStart: 6, background: "#587795", color: "white", borderRadius: 20, padding: "1px 8px", fontSize: 11 }}>{serials.length}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setSelected(serials.map(s => s.id))}>
                    {ar ? "الكل" : "All"}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setSelected([])}>
                    {ar ? "إلغاء" : "Clear"}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                {serials.map(s => {
                  const checked = selected.includes(s.id);
                  const statusStr = s.status === "in_stock"
                    ? (ar ? "في المخزون" : "In Stock")
                    : s.status === "sold"
                    ? (ar ? "مباع" : "Sold")
                    : s.status;
                  return (
                    <label key={s.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px", borderRadius: 8,
                      border: `1px solid ${checked ? "#DC2626" : "var(--border)"}`,
                      background: checked ? "#FEF2F2" : "white",
                      cursor: "pointer", fontSize: 12,
                    }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => setSelected(prev =>
                          e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id)
                        )}
                        style={{ accentColor: "#DC2626" }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <code style={{ fontWeight: 700, fontSize: 12 }}>{s.serial_number}</code>
                        <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                          {s.condition && (
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                              {ar ? conditionAr[s.condition] || s.condition : s.condition}
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: statusColor[s.status] || "#6B7280", fontWeight: 600 }}>
                            {statusStr}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>
                        {s.cost_price.toFixed(0)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</button>
          <button
            className="btn btn-primary"
            style={{ background: "#DC2626", borderColor: "#DC2626" }}
            onClick={handleConfirm}
            disabled={selected.length === 0}
          >
            ↩️ {ar ? `تأكيد إرجاع ${selected.length} سيريال` : `Confirm Return ${selected.length} serials`}
          </button>
        </div>
      </div>
    </div>
  );
}
