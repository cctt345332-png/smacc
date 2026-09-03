"use client";

import { useEffect, useState, use } from "react";
import { getSupervisorPayments } from "@/lib/reps";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

export default function SupervisorPaymentsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);
  const ar = params.locale === "ar";
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRep, setFilterRep] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  useEffect(() => {
    getSupervisorPayments()
      .then(r => setPayments(Array.isArray(r.data) ? r.data : []))
      .catch(() => setPayments([]))
      .finally(() => setLoading(false));
  }, []);

  const reps = Array.from(new Map(
    payments.map(p => [p.rep_id || p.rep_code || p.rep_name, p.rep_name || p.rep_code || "—"])
  ).entries());
  const filtered = payments.filter(payment => {
    const matchesRep = !filterRep || String(payment.rep_id || payment.rep_code || payment.rep_name) === filterRep;
    const matchesMonth = !filterMonth || String(payment.payment_date || "").slice(0, 7) === filterMonth;
    return matchesRep && matchesMonth;
  });
  const total = filtered.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{ar ? "سندات قبض المناديب" : "Rep Receipt Vouchers"}</h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
          {ar ? "السندات في صفحة مستقلة حتى تبقى الرئيسية مختصرة." : "Receipts are kept separate so the dashboard stays focused."}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <select value={filterRep} onChange={e => setFilterRep(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 12 }}>
          <option value="">{ar ? "كل المناديب" : "All reps"}</option>
          {reps.map(([id, name]) => <option key={String(id)} value={String(id)}>{String(name)}</option>)}
        </select>
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 12 }} />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "عدد السندات" : "Receipts"}</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#75617F" }}>{filtered.length}</div>
        </div>
        <div style={{ textAlign: "end" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "إجمالي المحصل" : "Total collected"}</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#166534" }}>{fmt(total)} SAR</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>{ar ? "لا توجد سندات قبض" : "No receipt vouchers"}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(payment => (
            <article key={payment.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "13px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13, color: "#166534" }}>{payment.payment_number || "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{fmtDate(payment.payment_date)}</div>
                </div>
                <div style={{ color: "#166534", fontWeight: 800, fontSize: 15 }}>{fmt(payment.amount)} SAR</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10, fontSize: 11 }}>
                <div><span style={{ color: "var(--text-muted)" }}>{ar ? "العميل: " : "Customer: "}</span>{payment.customer_name || "—"}</div>
                <div><span style={{ color: "var(--text-muted)" }}>{ar ? "المندوب: " : "Rep: "}</span><strong>{payment.rep_name || payment.rep_code || "—"}</strong></div>
                <div><span style={{ color: "var(--text-muted)" }}>{ar ? "المصدر: " : "Source: "}</span>{payment.invoice_number || (ar ? "رصيد العميل" : "Customer balance")}</div>
                <div><span style={{ color: "var(--text-muted)" }}>{ar ? "الطريقة: " : "Method: "}</span>{payment.payment_method || "—"}</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

