"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { getReps } from "@/lib/reps";

const fmt  = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtD = (d: any) => d ? new Date(d).toLocaleDateString("en-US") : "—";

const PAY_METHOD: Record<string, { ar: string; color: string }> = {
  cash:     { ar: "نقد",       color: "#059669" },
  credit:   { ar: "آجل",       color: "#D97706" },
  cheque:   { ar: "شيك",       color: "#7C3AED" },
  transfer: { ar: "تحويل",     color: "#2563EB" },
};

export default function ReviewPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [invoices, setInvoices]   = useState<any[]>([]);
  const [reps, setReps]           = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterRep, setFilterRep] = useState("");
  const [filterPay, setFilterPay] = useState("");
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [actionLoad, setActionLoad] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<any>(null);
  const [rejectNote, setRejectNote]   = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [invRes, repsRes] = await Promise.all([
        api.get("/sales/invoices-pending"),
        getReps(),
      ]);
      setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
      setReps(Array.isArray(repsRes.data) ? repsRes.data : []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const notify = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const doApprove = async (id: string) => {
    setActionLoad(id);
    try {
      await api.post(`/sales/invoices/${id}/approve`);
      notify("ok", ar ? "تمت الموافقة على الفاتورة" : "Invoice approved");
      load();
    } catch (e: any) { notify("err", e.response?.data?.detail || "خطأ"); }
    finally { setActionLoad(null); }
  };

  const doReject = async () => {
    if (!rejectModal || !rejectNote.trim()) return;
    setActionLoad(rejectModal.id);
    try {
      await api.post(`/sales/invoices/${rejectModal.id}/reject`, { rejection_note: rejectNote });
      notify("ok", ar ? "تم رفض الفاتورة" : "Invoice rejected");
      setRejectModal(null); setRejectNote(""); load();
    } catch (e: any) { notify("err", e.response?.data?.detail || "خطأ"); }
    finally { setActionLoad(null); }
  };

  const doApproveSelected = async () => {
    if (selected.size === 0) return;
    setActionLoad("bulk");
    let ok = 0; let fail = 0;
    for (const id of selected) {
      try { await api.post(`/sales/invoices/${id}/approve`); ok++; }
      catch { fail++; }
    }
    notify(fail === 0 ? "ok" : "err", ar ? `تمت الموافقة على ${ok} فاتورة${fail > 0 ? ` — فشل ${fail}` : ""}` : `Approved ${ok}${fail > 0 ? `, failed ${fail}` : ""}`);
    setSelected(new Set()); setActionLoad(null); load();
  };

  const toggleSelect = (id: string) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((i: any) => i.id)));
  };

  const repMap: Record<string, string> = {};
  reps.forEach((r: any) => { repMap[r.id] = r.full_name; });

  const filtered = invoices.filter((inv: any) => {
    const q = search.toLowerCase();
    const matchS = !q || inv.invoice_number?.toLowerCase().includes(q) || inv.buyer_name_ar?.toLowerCase().includes(q);
    const matchR = !filterRep || inv.rep_id === filterRep;
    const matchP = !filterPay || inv.invoice_payment_method === filterPay;
    return matchS && matchR && matchP;
  });

  const totalAmount = filtered.reduce((s: number, i: any) => s + Number(i.total || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reps/manage`}>{ar ? "المناديب" : "Sales Reps"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "مراجعة الفواتير" : "Invoice Review"}</span>
          </div>
          <h1 className="page-title">{ar ? "مراجعة فواتير المناديب" : "Rep Invoice Review"}</h1>
          <p className="page-subtitle">{ar ? "مراجعة الفواتير المقدّمة من المناديب والموافقة عليها أو ردّها" : "Review, approve or reject invoices submitted by sales reps"}</p>
        </div>
        {selected.size > 0 && (
          <button className="btn btn-primary" onClick={doApproveSelected} disabled={actionLoad === "bulk"}>
            {actionLoad === "bulk" ? (ar ? "جاري المعالجة..." : "Processing...") : `${ar ? "موافقة على" : "Approve"} ${selected.size} ${ar ? "فاتورة" : "invoices"}`}
          </button>
        )}
      </div>

      {/* ملخص */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: ar ? "إجمالي الفواتير المعلّقة" : "Pending Invoices", value: invoices.length, color: "#D97706" },
          { label: ar ? "الفواتير المعروضة" : "Filtered", value: filtered.length, color: "#2563EB" },
          { label: ar ? "إجمالي المبالغ المعلّقة" : "Pending Amount", value: fmt(invoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0)) + " SAR", color: "#7C3AED" },
          { label: ar ? "مبالغ الفواتير المعروضة" : "Filtered Amount", value: fmt(totalAmount) + " SAR", color: "#059669" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{ background: msg.type === "ok" ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${msg.type === "ok" ? "#BBF7D0" : "#FECACA"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: msg.type === "ok" ? "#059669" : "#DC2626", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}>x</button>
        </div>
      )}

      {/* فلاتر */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input className="form-input" style={{ width: 240 }}
            placeholder={ar ? "بحث برقم الفاتورة أو اسم العميل..." : "Search by invoice or customer..."}
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-input form-select" style={{ width: 180 }} value={filterRep} onChange={e => setFilterRep(e.target.value)}>
            <option value="">{ar ? "كل المناديب" : "All Reps"}</option>
            {reps.map((r: any) => <option key={r.id} value={r.id}>{r.full_name} ({r.rep_code})</option>)}
          </select>
          <select className="form-input form-select" style={{ width: 150 }} value={filterPay} onChange={e => setFilterPay(e.target.value)}>
            <option value="">{ar ? "كل طرق الدفع" : "All Payment"}</option>
            <option value="cash">{ar ? "نقد" : "Cash"}</option>
            <option value="credit">{ar ? "آجل" : "Credit"}</option>
            <option value="cheque">{ar ? "شيك" : "Cheque"}</option>
            <option value="transfer">{ar ? "تحويل" : "Transfer"}</option>
          </select>
          {(search || filterRep || filterPay) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(""); setFilterRep(""); setFilterPay(""); }}>
              {ar ? "مسح الفلاتر" : "Clear"}
            </button>
          )}
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {filtered.length} {ar ? "فاتورة" : "invoices"}
          </span>
        </div>
      </div>

      {/* الجدول */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 40, marginBottom: 8 }}>&#10003;</div>
              <div className="empty-state-title">{ar ? "لا توجد فواتير بانتظار المراجعة" : "No invoices pending review"}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{ar ? "جميع الفواتير تمت معالجتها" : "All invoices have been processed"}</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll} />
                  </th>
                  <th>{ar ? "رقم الفاتورة" : "Invoice"}</th>
                  <th>{ar ? "المندوب" : "Rep"}</th>
                  <th>{ar ? "العميل" : "Customer"}</th>
                  <th>{ar ? "طريقة الدفع" : "Payment"}</th>
                  <th>{ar ? "تاريخ التقديم" : "Submitted"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv: any) => {
                  const pm = PAY_METHOD[inv.invoice_payment_method];
                  return (
                    <tr key={inv.id} style={selected.has(inv.id) ? { background: "#EFF6FF" } : {}}>
                      <td>
                        <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleSelect(inv.id)} />
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--primary)", fontFamily: "monospace" }}>
                        {inv.invoice_number}
                      </td>
                      <td>
                        <Link href={`/${locale}/reps/${inv.rep_id}`} style={{ color: "var(--primary)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                          {repMap[inv.rep_id] || "—"}
                        </Link>
                      </td>
                      <td style={{ fontSize: 13 }}>{inv.buyer_name_ar}</td>
                      <td>
                        {pm ? (
                          <span style={{ background: "#F3F4F6", color: pm.color, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{pm.ar}</span>
                        ) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                        {inv.invoice_payment_method === "credit" && inv.credit_days && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{inv.credit_days} {ar ? "يوم" : "days"}</div>
                        )}
                        {inv.invoice_payment_method === "cheque" && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                            {inv.cheque_number || ""}
                            {inv.bank_name ? ` · ${inv.bank_name}` : ""}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtD(inv.submitted_at)}</td>
                      <td style={{ textAlign: "end", fontWeight: 700, fontSize: 15 }}>{fmt(inv.total)} SAR</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-primary btn-sm" disabled={actionLoad === inv.id}
                            onClick={() => doApprove(inv.id)}>
                            {actionLoad === inv.id ? "..." : (ar ? "موافقة" : "Approve")}
                          </button>
                          <button className="btn btn-secondary btn-sm" style={{ color: "#DC2626" }}
                            disabled={actionLoad === inv.id}
                            onClick={() => { setRejectModal(inv); setRejectNote(""); }}>
                            {ar ? "رفض" : "Reject"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--secondary)", fontWeight: 700 }}>
                  <td colSpan={6} style={{ padding: "10px 16px", textAlign: ar ? "right" : "left", fontSize: 13 }}>
                    {ar ? "الإجمالي" : "Total"} ({filtered.length} {ar ? "فاتورة" : "invoices"})
                  </td>
                  <td style={{ textAlign: "end", padding: "10px 16px", fontSize: 15 }}>{fmt(totalAmount)} SAR</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Modal الرفض */}
      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 460, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{ar ? "رفض الفاتورة" : "Reject Invoice"}</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              {ar ? "الفاتورة" : "Invoice"} <strong>{rejectModal.invoice_number}</strong> — {rejectModal.buyer_name_ar}
            </p>
            <div className="form-group">
              <label className="form-label">{ar ? "سبب الرفض" : "Rejection Reason"} <span className="required">*</span></label>
              <textarea className="form-input" rows={3} value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder={ar ? "أدخل سبب الرفض بوضوح ليصل للمندوب..." : "Enter clear rejection reason for the rep..."} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setRejectModal(null)}>{ar ? "إلغاء" : "Cancel"}</button>
              <button onClick={doReject} disabled={!rejectNote.trim() || actionLoad === rejectModal.id}
                style={{ background: "#DC2626", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, cursor: "pointer", opacity: (!rejectNote.trim() || actionLoad === rejectModal.id) ? 0.6 : 1 }}>
                {actionLoad === rejectModal.id ? "..." : (ar ? "تأكيد الرفض" : "Confirm Reject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
