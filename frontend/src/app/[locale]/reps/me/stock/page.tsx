"use client";
import { useEffect, useState } from "react";
import { getMyStock } from "@/lib/reps";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function RepStockPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getMyStock()
      .then(res => setStock(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = stock.filter(s => {
    const q = search.toLowerCase();
    return !q || (s.item_name || s.name_ar || "").toLowerCase().includes(q) ||
      (s.item_sku || s.sku || "").toLowerCase().includes(q);
  });

  const totalQty = filtered.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
  const totalVal = filtered.reduce((s: number, i: any) => s + Number(i.quantity || 0) * Number(i.sale_price || 0), 0);

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{ar ? "مخزوني" : "My Stock"}</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            {filtered.length} {ar ? "صنف" : "items"}
          </p>
        </div>
      </div>

      {/* ملخص */}
      {stock.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: "14px 16px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{ar ? "إجمالي الكمية" : "Total Qty"}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#D97706" }}>{fmt(totalQty)}</div>
          </div>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: "14px 16px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{ar ? "القيمة الإجمالية" : "Total Value"}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#2563EB" }}>{fmt(totalVal)} SAR</div>
          </div>
        </div>
      )}

      {/* بحث */}
      {stock.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <input style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13, outline: "none" }}
            placeholder={ar ? "بحث باسم الصنف أو الكود..." : "Search by name or SKU..."}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {/* القائمة */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          {ar ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", display: "block" }}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {stock.length === 0
              ? (ar ? "لا يوجد مخزون مخصص لك حالياً" : "No stock assigned to you yet")
              : (ar ? "لا توجد نتائج" : "No results found")}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((s: any) => {
            const qty = Number(s.quantity || 0);
            const val = qty * Number(s.sale_price || 0);
            const isSerial = s.item_tracking === "serial" || s.tracking_type === "serial";
            const isLow = !isSerial && qty <= 3 && qty > 0;
            const isEmpty = !isSerial && qty <= 0;
            return (
              <div key={s.item_id || s.id} style={{
                background: "var(--surface)", borderRadius: 14,
                padding: "14px 16px", border: "1px solid var(--border)",
                borderInlineStart: `3px solid ${isEmpty ? "#DC2626" : isLow ? "#D97706" : "#059669"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.item_name || s.name_ar}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: 8 }}>
                      {(s.item_sku || s.sku) && <span style={{ fontFamily: "monospace" }}>{s.item_sku || s.sku}</span>}
                      {isSerial && <span style={{ color: "#7C3AED", fontWeight: 600 }}>{ar ? "سيريال" : "Serial"}</span>}
                      {isLow && <span style={{ color: "#D97706", fontWeight: 600 }}>{ar ? "منخفض" : "Low"}</span>}
                      {isEmpty && <span style={{ color: "#DC2626", fontWeight: 600 }}>{ar ? "نفد" : "Empty"}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "end", flexShrink: 0, marginInlineStart: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 18, color: isEmpty ? "#DC2626" : isLow ? "#D97706" : "#059669" }}>
                      {isSerial ? "—" : fmt(qty)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "قطعة" : "units"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{ar ? "سعر البيع" : "Sale Price"}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#2563EB" }}>{fmt(s.sale_price)} SAR</div>
                  </div>
                  {!isSerial && qty > 0 && (
                    <div style={{ textAlign: "end" }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{ar ? "القيمة" : "Value"}</div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{fmt(val)} SAR</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
