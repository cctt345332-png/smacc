"use client";
/**
 * صفحة تحميل مخزون للمندوب
 * المدير يختار أصناف وكميات → تُنقل من المستودع الرئيسي لمستودع المندوب
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRep, getRepStock, allocateStockToRep } from "@/lib/reps";
import api from "@/lib/api";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function AllocateStockPage({
  params: { locale, rep_id },
}: {
  params: { locale: string; rep_id: string };
}) {
  const ar = locale === "ar";
  const router = useRouter();

  const [rep, setRep] = useState<any>(null);
  const [mainStock, setMainStock] = useState<any[]>([]);
  const [selected, setSelected] = useState<{ item_id: string; item_name: string; quantity: number; available: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    Promise.all([getRep(rep_id), getRepStock(rep_id)])
      .then(([repRes, _stockRes]) => {
        setRep(repRes.data);
        // جلب المخزون الرئيسي من API المخزون
        return api.get("/inventory/stock")
          .then((r) => setMainStock(Array.isArray(r.data) ? r.data : []));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rep_id]);

  const toggleItem = (item: any) => {
    const exists = selected.find((s) => s.item_id === item.item_id);
    if (exists) {
      setSelected((p) => p.filter((s) => s.item_id !== item.item_id));
    } else {
      setSelected((p) => [
        ...p,
        {
          item_id: item.item_id,
          item_name: item.item_name || item.name_ar,
          quantity: 1,
          available: Number(item.quantity || 0),
        },
      ]);
    }
  };

  const updateQty = (item_id: string, qty: number) => {
    setSelected((p) =>
      p.map((s) =>
        s.item_id === item_id ? { ...s, quantity: Math.max(1, Math.min(qty, s.available)) } : s
      )
    );
  };

  const handleAllocate = async () => {
    if (selected.length === 0)
      return setError(ar ? "اختر صنفاً على الأقل" : "Select at least one item");

    setSaving(true);
    setError("");
    try {
      const res = await allocateStockToRep(
        rep_id,
        selected.map((s) => ({ item_id: s.item_id, quantity: s.quantity }))
      );
      const data = res.data;
      if (!data) throw new Error("خطأ");
      setSuccess(ar ? "تم تحميل البضاعة بنجاح" : "Stock allocated successfully");
      setSelected([]);
      setTimeout(() => router.push(`/${locale}/reps/manage`), 1500);
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        {ar ? "جاري التحميل..." : "Loading..."}
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {ar ? `تحميل بضاعة — ${rep?.full_name}` : `Allocate Stock — ${rep?.full_name}`}
          </h1>
          <p className="page-subtitle">
            {ar
              ? `${rep?.rep_code} | ${rep?.warehouse_name}`
              : `${rep?.rep_code} | ${rep?.warehouse_name}`}
          </p>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", marginBottom: 12, color: "#DC2626", fontSize: 13 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "12px 16px", marginBottom: 12, color: "#059669", fontSize: 13 }}>
          {success}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        {/* ─── المخزون الرئيسي ─────────────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 13 }}>
            {ar ? "المخزون الرئيسي (المتاح للتحميل)" : "Main Stock (Available to Allocate)"}
          </div>
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>{ar ? "الصنف" : "Item"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المتاح" : "Available"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "سعر التكلفة" : "Cost"}</th>
                </tr>
              </thead>
              <tbody>
                {mainStock.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                      {ar ? "لا يوجد مخزون في المستودع الرئيسي" : "No stock in main warehouse"}
                    </td>
                  </tr>
                ) : (
                  mainStock.map((item: any) => {
                    const isSelected = selected.some((s) => s.item_id === item.item_id);
                    return (
                      <tr
                        key={item.item_id}
                        style={{ cursor: "pointer", background: isSelected ? "#EDE9FE" : undefined }}
                        onClick={() => toggleItem(item)}
                      >
                        <td>
                          <input type="checkbox" checked={isSelected} readOnly />
                        </td>
                        <td style={{ fontWeight: 600 }}>{item.item_name || item.name_ar}</td>
                        <td style={{ textAlign: "end", fontWeight: 700, color: Number(item.quantity) > 0 ? "#059669" : "#DC2626" }}>
                          {fmt(item.quantity)}
                        </td>
                        <td style={{ textAlign: "end", color: "var(--text-secondary)" }}>
                          {fmt(item.cost_price)} SAR
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── الأصناف المختارة ────────────────────────────── */}
        <div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>
              {ar ? "الأصناف المختارة للتحميل" : "Selected Items to Allocate"}
            </div>
            {selected.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "12px 0" }}>
                {ar ? "اختر أصنافاً من الجدول" : "Select items from the table"}
              </div>
            ) : (
              selected.map((s) => (
                <div
                  key={s.item_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.item_name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number"
                      className="input"
                      style={{ width: 70, fontSize: 13 }}
                      min={1}
                      max={s.available}
                      value={s.quantity}
                      onChange={(e) => updateQty(s.item_id, Number(e.target.value))}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>/ {fmt(s.available)}</span>
                  </div>
                </div>
              ))
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 16 }}
              onClick={handleAllocate}
              disabled={saving || selected.length === 0}
            >
              {saving ? "..." : ar ? "تحميل البضاعة" : "Allocate Stock"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
