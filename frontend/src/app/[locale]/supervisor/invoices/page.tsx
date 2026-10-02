"use client";
import { useEffect, useState, use } from "react";
import { getSupervisorInvoices, getSupervisorInvoiceDetail, getSupervisorReps } from "@/lib/reps";
import SearchableSelect from "@/components/ui/SearchableSelect";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const STATUS: Record<string, { ar: string; color: string; bg: string }> = {
  draft:     { ar: "مسودة",            color: "#6B7280", bg: "#F3F4F6" },
  submitted: { ar: "بانتظار المراجعة", color: "#D97706", bg: "#FEF3C7" },
  approved:  { ar: "موافق عليها",      color: "#5A187E", bg: "#EFF6FF" },
  rejected:  { ar: "مرفوضة",           color: "#DC2626", bg: "#FEF2F2" },
  confirmed: { ar: "مؤكدة",            color: "#6F4A84", bg: "#F7F2F8" },
  paid:      { ar: "مدفوعة",           color: "#6F4A84", bg: "#F7F2F8" },
  partial:   { ar: "جزئي",             color: "#D97706", bg: "#FEF3C7" },
  cancelled: { ar: "ملغاة",            color: "#6B7280", bg: "#F3F4F6" },
};

export default function SupervisorInvoicesPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [invoices, setInvoices]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reps, setReps] = useState<any[]>([]);
  const [filterRep, setFilterRep] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    Promise.all([getSupervisorInvoices(), getSupervisorReps()])
      .then(([r, repsRes]) => { setInvoices(Array.isArray(r.data) ? r.data : []); setReps(Array.isArray(repsRes.data) ? repsRes.data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = invoices.filter(i => (!filterStatus || i.status === filterStatus) && (!filterRep || i.rep_id === filterRep));
  const openInvoice = async (invoice: any) => {
    setSelected(invoice); setDetail(null); setDetailLoading(true);
    try { const result = await getSupervisorInvoiceDetail(invoice.id); setDetail(result.data); }
    catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <SearchableSelect locale={locale} options={reps.map(rep => ({ value: rep.id, label: `${rep.full_name} · ${rep.rep_code}`, searchText: rep.phone || "" }))} value={filterRep} onChange={setFilterRep} placeholder={ar ? "ابحث واختر المندوب" : "Search and choose rep"} style={{ padding: "10px 14px", borderRadius: 10, fontSize: 13 }} />
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
              <div key={inv.id} onClick={() => openInvoice(inv)}
                style={{ background: "var(--surface)", borderRadius: 14, padding: "14px 16px",
                  border: "1px solid var(--border)", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#75617F" }}>
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
                <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 18, color: "#75617F" }}>
                  {selected.invoice_number}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{selected.buyer_name_ar}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => window.open(`/${locale}/sales/invoices/${selected.id}?print=1`, "_blank")}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #BFDBFE",
                    background: "#EFF6FF", color: "#5A187E", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  PDF
                </button>
                <button onClick={() => setSelected(null)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)",
                    background: "transparent", cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
            </div>
            {detailLoading && <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>{ar ? "جاري تحميل تفاصيل الفاتورة..." : "Loading invoice details..."}</div>}
            {detail && (
              <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { label: ar ? "الإجمالي" : "Total", value: fmt(detail.total) + " SAR", color: "#75617F" },
                { label: ar ? "المدفوع" : "Paid",   value: fmt(detail.paid_amount) + " SAR", color: "#6F4A84" },
                { label: ar ? "المتبقي" : "Due",    value: fmt(Math.max(0, Number(detail.total) - Number(detail.paid_amount))) + " SAR", color: "#DC2626" },
                { label: ar ? "المندوب" : "Rep",    value: detail.rep_name || "—", color: "#5A187E" },
              ].map(f => (
                <div key={f.label} style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: f.color }}>{f.value}</div>
                </div>
              ))}
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflowX: "auto" }}>
              <div style={{ padding: "10px 12px", fontWeight: 800, fontSize: 13 }}>{ar ? "تفاصيل الأصناف" : "Line items"}</div>
              <table style={{ width: "100%", minWidth: 430, borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr><th style={{ padding: 8, textAlign: "start" }}>{ar ? "الصنف" : "Item"}</th><th style={{ padding: 8 }}>{ar ? "الكمية" : "Qty"}</th><th style={{ padding: 8 }}>{ar ? "سعر الوحدة" : "Unit price"}</th><th style={{ padding: 8 }}>{ar ? "الإجمالي" : "Total"}</th></tr></thead>
                <tbody>{(detail.lines || []).map((line: any) => <tr key={line.id} style={{ borderTop: "1px solid var(--border)" }}><td style={{ padding: 8 }}>{line.description_ar || line.description_en || "—"}</td><td style={{ padding: 8, textAlign: "center" }}>{fmt(line.quantity)}</td><td style={{ padding: 8, textAlign: "center" }}>{fmt(line.unit_price)}</td><td style={{ padding: 8, textAlign: "center", fontWeight: 700 }}>{fmt(line.total)}</td></tr>)}</tbody>
              </table>
            </div>
            {detail.payments?.length > 0 && <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "السندات المرتبطة: " : "Linked receipts: "}{detail.payments.map((p: any) => `${p.payment_number} (${fmt(p.amount)} SAR)`).join("، ")}</div>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
