"use client";
import { useEffect, useState, use } from "react";
import { getSupervisorSummary, getSupervisorInvoices, getSupervisorReps } from "@/lib/reps";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const STATUS: Record<string, string> = {
  confirmed: "مؤكدة", paid: "مدفوعة", partial: "جزئي",
  submitted: "بانتظار المراجعة", draft: "مسودة",
};

export default function SupervisorReportsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [summary, setSummary]   = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [reps, setReps]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      getSupervisorSummary().catch(() => ({ data: null })),
      getSupervisorInvoices().catch(() => ({ data: [] })),
      getSupervisorReps().catch(() => ({ data: [] })),
    ]).then(([s, i, r]) => {
      setSummary(s.data);
      setInvoices(Array.isArray(i.data) ? i.data : []);
      setReps(Array.isArray(r.data) ? r.data : []);
    }).finally(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    const rows = [
      ["رقم الفاتورة", "العميل", "الحالة", "التاريخ", "الإجمالي", "المدفوع", "المتبقي"],
      ...invoices.map((inv: any) => [
        inv.invoice_number, inv.buyer_name_ar,
        STATUS[inv.status] || inv.status,
        inv.issue_date ? new Date(inv.issue_date).toLocaleDateString("en-US") : "",
        Number(inv.total || 0).toFixed(2),
        Number(inv.paid_amount || 0).toFixed(2),
        Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0)).toFixed(2),
      ]),
    ];
    const csv = "\uFEFF" + rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
      {ar ? "جاري التحميل..." : "Loading..."}
    </div>
  );

  const totalSales = Number(summary?.total_sales || 0);
  const totalCollected = Number(summary?.total_collected || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{ar ? "التقارير" : "Reports"}</h1>
        <button onClick={exportCSV}
          style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #BBF7D0",
            background: "#F0FDF4", color: "#059669", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          Excel
        </button>
      </div>

      {/* إحصائيات */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: ar ? "إجمالي المبيعات" : "Total Sales", value: fmt(totalSales) + " SAR", color: "#7C3AED" },
          { label: ar ? "المقبوض" : "Collected", value: fmt(totalCollected) + " SAR", color: "#059669" },
          { label: ar ? "المستحق" : "Outstanding", value: fmt(totalSales - totalCollected) + " SAR", color: "#DC2626" },
          { label: ar ? "عدد الفواتير" : "Invoices", value: String(summary?.invoice_count || 0), color: "#2563EB" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--surface)", borderRadius: 14, padding: "14px 16px", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* توزيع الفواتير حسب المندوب */}
      {reps.length > 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, border: "1px solid var(--border)" }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
            {ar ? "أداء المناديب" : "Reps Performance"}
          </div>
          {reps.map((rep: any) => {
            const repInvoices = invoices.filter((i: any) => i.rep_id === rep.id);
            const repSales = repInvoices
              .filter((i: any) => ["confirmed","paid","partial"].includes(i.status))
              .reduce((s: number, i: any) => s + Number(i.total || 0), 0);
            return (
              <div key={rep.id} style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{rep.full_name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {rep.rep_code} · {repInvoices.length} {ar ? "فاتورة" : "invoices"}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#7C3AED" }}>
                  {fmt(repSales)} SAR
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
