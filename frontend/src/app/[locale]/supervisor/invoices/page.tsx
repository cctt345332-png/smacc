"use client";
import { useEffect, useState } from "react";
import { getSupervisorInvoices } from "@/lib/reps";
import api from "@/lib/api";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const STATUS: Record<string, { ar: string; color: string; bg: string }> = {
  draft:     { ar: "مسودة",            color: "#6B7280", bg: "#F3F4F6" },
  submitted: { ar: "بانتظار المراجعة", color: "#D97706", bg: "#FEF3C7" },
  approved:  { ar: "موافق عليها",      color: "#2563EB", bg: "#EFF6FF" },
  rejected:  { ar: "مرفوضة",           color: "#DC2626", bg: "#FEF2F2" },
  confirmed: { ar: "مؤكدة",            color: "#059669", bg: "#F0FDF4" },
  paid:      { ar: "مدفوعة",           color: "#059669", bg: "#F0FDF4" },
  partial:   { ar: "جزئي",             color: "#D97706", bg: "#FEF3C7" },
  cancelled: { ar: "ملغاة",            color: "#6B7280", bg: "#F3F4F6" },
};

export default function SupervisorInvoicesPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [invoices, setInvoices]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    getSupervisorInvoices()
      .then(r => setInvoices(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = invoices.filter(i => !filterStatus || i.status === filterStatus);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{ar ? "فواتير مناديبي" : "Rep Invoices"}</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            {filtered.length} {ar ? "فاتورة" : "invoices"}
          </p>
        </div>
      </div>

      {/* فلتر */}
      <div style={{ marginBottom: 14 }}>
        <select style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13 }}
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">{ar ? "كل الحالات" : "All Statuses"}</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>{ar ? v.ar : k}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          {ar ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          {ar ? "لا توجد فواتير" : "No invoices"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((inv: any) => {
            const st = STATUS[inv.status] || STATUS.draft;
            const rem = Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0));
            return (
              <div key={inv.id} onClick={() => setSelected(inv)}
                style={{ background: "var(--surface)", borderRadius: 14, padding: "14px 16px",
                  border: "1px solid var(--border)", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#7C3AED" }}>
                    {inv.invoice_number}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{fmt(inv.total)} SAR</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: st.bg, color: st.color }}>
                      {ar ? st.ar : inv.status}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{inv.buyer_name_ar}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(inv.issue_date)}</span>
                </div>
                {rem > 0.01 && (
                  <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 600, marginTop: 4 }}>
                    {ar ? "متبقي:" : "Due:"} {fmt(rem)} SAR
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal تفاصيل */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 800,
          display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setSelected(null)}>
          <div style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0",
            width: "100%", maxWidth: 580, maxHeight: "80vh", overflowY: "auto", padding: "20px 20px 32px" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 16px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 18, color: "#7C3AED" }}>
                  {selected.invoice_number}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{selected.buyer_name_ar}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => window.open(`/${locale}/sales/invoices/${selected.id}?print=1`, "_blank")}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #BFDBFE",
                    background: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  PDF
                </button>
                <button onClick={() => setSelected(null)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)",
                    background: "transparent", cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { label: ar ? "الإجمالي" : "Total", value: fmt(selected.total) + " SAR", color: "#7C3AED" },
                { label: ar ? "المدفوع" : "Paid",   value: fmt(selected.paid_amount) + " SAR", color: "#059669" },
                { label: ar ? "المتبقي" : "Due",    value: fmt(Math.max(0, Number(selected.total) - Number(selected.paid_amount))) + " SAR", color: "#DC2626" },
                { label: ar ? "التاريخ" : "Date",   value: fmtDate(selected.issue_date), color: "var(--text-primary)" },
              ].map(f => (
                <div key={f.label} style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: f.color }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
