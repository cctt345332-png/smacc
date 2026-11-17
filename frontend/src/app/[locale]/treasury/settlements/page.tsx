"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { deleteSettlement, getSettlementBreakdown, getSettlementReport, getSettlementSources, getSettlements, createSettlement, updateSettlement } from "@/lib/settlements";
import { getPayments } from "@/lib/sales";
import { getExpenses } from "@/lib/expenses";

const money = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (value: any, ar: boolean) => value ? new Date(value).toLocaleDateString(ar ? "ar-SA" : "en-GB") : "—";
const dateValue = (value: any) => value ? String(value).slice(0, 10) : "";

export default function SettlementsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [sources, setSources] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [received, setReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [editRow, setEditRow] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportSource, setReportSource] = useState("");
  const [report, setReport] = useState<any>({ rows: [], totals: {} });
  const [reportLoading, setReportLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [sourceResponse, rowResponse] = await Promise.all([
        getSettlementSources({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
        getSettlements(),
      ]);
      setSources(sourceResponse.data || []);
      setRows(rowResponse.data || []);
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async () => {
    setReportLoading(true);
    try {
      const response = await getSettlementReport({
        date_from: reportFrom || undefined,
        date_to: reportTo || undefined,
        source_id: reportSource || undefined,
        source_type: reportSource ? (sources.find(x => `${x.source_type}:${x.source_id}` === reportSource)?.source_type || undefined) : undefined,
      });
      setReport(response.data || { rows: [], totals: {} });
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => { load(); }, [dateFrom, dateTo]);
  useEffect(() => { loadReport(); }, [reportFrom, reportTo, reportSource]);

  const current = useMemo(() => sources.find(x => `${x.source_type}:${x.source_id}` === selected), [sources, selected]);

  useEffect(() => {
    let active = true;
    const loadDetail = async () => {
      if (!current) { setDetail(null); return; }
      try {
        if (current.source_type === "pos") {
          const { data } = await getSettlementBreakdown({ source_type: "pos", source_id: current.source_id, date_from: dateFrom || undefined, date_to: dateTo || undefined });
          if (active) setDetail({ pos: true, rows: data.rows || [], totals: data.totals || {} });
          return;
        }
        const params = {
          rep_id: current.source_id,
          ...(dateFrom ? { date_from: `${dateFrom}T00:00:00` } : {}),
          ...(dateTo ? { date_to: `${dateTo}T23:59:59` } : {}),
        };
        const [{ data: paymentData }, { data: expenseData }] = await Promise.all([getPayments(params), getExpenses(params)]);
        const payments = (Array.isArray(paymentData) ? paymentData : []).filter((x: any) => x.payment_type !== "discount");
        const approved = (Array.isArray(expenseData) ? expenseData : []).filter((x: any) => x.status === "approved");
        const receipts: Record<string, number> = { cash: 0, bank_transfer: 0, cheque: 0, credit_card: 0, mada: 0, stc_pay: 0 };
        payments.forEach((x: any) => { const key = typeof x.payment_method === "string" ? x.payment_method : x.payment_method?.value; if (key in receipts) receipts[key] += Number(x.amount || 0); });
        let cashExpenses = 0;
        approved.forEach((x: any) => { if (["cash", "rep_advance"].includes(x.payment_method)) cashExpenses += Number(x.amount || 0); });
        if (active) setDetail({ receipts, cashExpenses, cashDue: receipts.cash - cashExpenses, payments: payments.length, expensesCount: approved.length });
      } catch { if (active) setDetail(null); }
    };
    loadDetail();
    return () => { active = false; };
  }, [current?.source_id, current?.source_type, dateFrom, dateTo]);

  const save = async () => {
    if (!current || Number(received) < 0) return;
    setSaving(true); setMessage("");
    try {
      await createSettlement({ source_type: current.source_type, source_id: current.source_id, date_from: dateFrom || null, date_to: dateTo || null, received_amount: Number(received || 0), notes: notes || null });
      setReceived(""); setNotes(""); setMessage(ar ? "تم حفظ التسوية بنجاح" : "Settlement saved successfully");
      await Promise.all([load(), loadReport()]);
    } catch (e: any) { setMessage(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const edit = async () => {
    if (!editRow || Number(editRow.received_amount) < 0) return;
    setSaving(true); setMessage("");
    try {
      await updateSettlement(editRow.id, { source_type: editRow.source_type, source_id: editRow.source_id, date_from: editRow.date_from || null, date_to: editRow.date_to || null, received_amount: Number(editRow.received_amount || 0), notes: editRow.notes || null });
      setEditRow(null); setMessage(ar ? "تم تعديل التسوية" : "Settlement updated");
      await Promise.all([load(), loadReport()]);
    } catch (e: any) { setMessage(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const remove = async (row: any) => {
    if (!window.confirm(ar ? "هل أنت متأكد من حذف سجل التسوية؟ لن تتأثر الفواتير أو المخزون." : "Delete this settlement record? Invoices and inventory will not be affected.")) return;
    try { await deleteSettlement(row.id); setMessage(ar ? "تم حذف التسوية" : "Settlement deleted"); await Promise.all([load(), loadReport()]); }
    catch (e: any) { setMessage(e?.response?.data?.detail || "Error"); }
  };

  return <div className="page-container">
    <div className="page-header"><div>
      <div className="breadcrumb"><span>{ar ? "الخزينة والمدفوعات" : "Treasury"}</span><span className="breadcrumb-sep">/</span><span>{ar ? "تسويات العهد" : "Custody settlements"}</span></div>
      <h1 className="page-title">{ar ? "تسويات العهد" : "Custody settlements"}</h1>
      <p className="page-subtitle">{ar ? "إقفال عهدة المندوب أو جهاز نقاط البيع وتسجيل المبلغ المستلم" : "Close a representative or POS custody and record the received amount"}</p>
    </div><div style={{ display: "flex", gap: 8 }}><Link href={`/${locale}/treasury/settlements/report`} className="btn btn-secondary btn-sm">{ar ? "تقرير التسويات" : "Settlement report"}</Link></div></div>
    {message && <div className="alert alert-info" style={{ marginBottom: 16 }}>{message}</div>}

    <div className="grid-2" style={{ alignItems: "start", gap: 16 }}>
      <div className="card" style={{ padding: 20 }}><h2 style={{ marginTop: 0 }}>{ar ? "تسجيل تسوية جديدة" : "New settlement"}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}><div className="form-group"><label className="form-label">{ar ? "من تاريخ" : "From date"}</label><input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div><div className="form-group"><label className="form-label">{ar ? "إلى تاريخ" : "To date"}</label><input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div></div>
        <div className="form-group"><label className="form-label">{ar ? "العهدة" : "Custody"}</label><select className="form-input form-select" value={selected} onChange={e => setSelected(e.target.value)}><option value="">{ar ? "اختر مندوباً أو جهازاً" : "Select a representative or POS"}</option>{sources.map(x => <option key={`${x.source_type}:${x.source_id}`} value={`${x.source_type}:${x.source_id}`}>{x.label} — {money(x.expected_amount)} SAR</option>)}</select></div>
        {current && <div style={{ background: "#F5F3FF", padding: 16, borderRadius: 8, margin: "12px 0" }}><div style={{ fontSize: 12, color: "#6B7280" }}>{ar ? "النقد المطلوب للفترة المحددة" : "Cash due for selected period"}</div><strong style={{ fontSize: 25, color: "#5A187E" }}>{money(current.expected_amount)} SAR</strong><div style={{ fontSize: 12, marginTop: 6 }}>{current.last_settled_at ? `${ar ? "آخر تسوية" : "Last settlement"}: ${new Date(current.last_settled_at).toLocaleString(ar ? "ar-SA" : "en-GB")}` : ar ? "لا توجد تسوية سابقة" : "No previous settlement"}</div></div>}
        {detail?.pos && <div style={{ background: "#F8FAFC", padding: 16, borderRadius: 8, margin: "12px 0", border: "1px solid #E2E8F0" }}><strong>{ar ? "تفصيل تسوية جهاز نقاط البيع" : "POS settlement breakdown"}</strong><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 10, fontSize: 13 }}><div>{ar ? "مبيعات نقدية" : "Cash sales"}<br /><b>{money(detail.totals.cash_sales)} SAR</b></div><div>{ar ? "رصيد افتتاحي" : "Opening cash"}<br /><b>{money(detail.totals.opening_cash)} SAR</b></div><div>{ar ? "مخرجات نقدية" : "Cash outflows"}<br /><b>{money(detail.totals.cash_outflows)} SAR</b></div><div>{ar ? "المتوقع" : "Expected"}<br /><b>{money(detail.totals.expected)} SAR</b></div></div><div className="table-wrapper" style={{ marginTop: 12 }}><table><thead><tr><th>الجلسة</th><th>الإغلاق</th><th>المبيعات النقدية</th><th>الافتتاحي</th><th>المخرجات</th><th>المتوقع</th></tr></thead><tbody>{detail.rows.map((x: any) => <tr key={x.session_id}><td>{String(x.session_id).slice(0, 8)}</td><td>{day(x.closed_at, ar)}</td><td>{money(x.cash_sales)}</td><td>{money(x.opening_cash)}</td><td>{money(x.cash_outflows)}</td><td style={{ fontWeight: 700 }}>{money(x.expected)}</td></tr>)}</tbody></table></div></div>}
        {detail && !detail.pos && <div style={{ background: "#F8FAFC", padding: 16, borderRadius: 8, margin: "12px 0", border: "1px solid #E2E8F0" }}><strong>{ar ? "تفاصيل الفترة" : "Period details"}</strong><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 10, fontSize: 13 }}><div>{ar ? "النقد المقبوض" : "Cash collected"}<br /><b>{money(detail.receipts.cash)} SAR</b></div><div>{ar ? "المصروف النقدي" : "Cash expenses"}<br /><b>{money(detail.cashExpenses)} SAR</b></div><div>{ar ? "المطلوب تسليمه" : "Cash to hand over"}<br /><b>{money(detail.cashDue)} SAR</b></div></div><div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>{ar ? `السندات: ${detail.payments} · المصروفات: ${detail.expensesCount}` : `Receipts: ${detail.payments} · Expenses: ${detail.expensesCount}`}</div></div>}
        <div className="form-group"><label className="form-label">{ar ? "المبلغ المستلم فعلياً" : "Actually received"}</label><input type="number" min="0" step="0.01" className="form-input" value={received} onChange={e => setReceived(e.target.value)} placeholder="0.00" /></div><div className="form-group"><label className="form-label">{ar ? "ملاحظات" : "Notes"}</label><textarea className="form-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div><button className="btn btn-primary" disabled={!current || saving} onClick={save}>{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التسوية" : "Save settlement")}</button>
      </div>
    </div>

    <div className="card" style={{ marginTop: 16 }}><div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div className="card-title">{ar ? "تقرير استلام العهد" : "Custody collection report"}</div><Link href={`/${locale}/treasury/settlements/report`} className="btn btn-ghost btn-sm">{ar ? "فتح التقرير الكامل" : "Open full report"}</Link></div><div className="card-body" style={{ color: "var(--text-secondary)", fontSize: 13 }}>{ar ? "استخدم التقرير الموحد لتحديد الفترة والمندوب وعرض إجمالي المتوقع والمستلم والفرق بالتفصيل." : "Use the unified report to filter by period and representative and view expected, received and variance totals."}</div></div>

    <div className="card" style={{ padding: 20, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>{ar ? "سجل التسويات" : "Settlement history"}</h2><div className="table-wrapper"><table><thead><tr><th>{ar ? "العهدة" : "Custody"}</th><th>{ar ? "الفترة" : "Period"}</th><th>{ar ? "تاريخ التسوية" : "Settled"}</th><th>{ar ? "المتوقع" : "Expected"}</th><th>{ar ? "المستلم" : "Received"}</th><th>{ar ? "الإجراءات" : "Actions"}</th></tr></thead><tbody>{rows.map(x => <tr key={x.id}><td>{x.source_label}</td><td>{day(x.period_from, ar)} — {day(x.period_to, ar)}</td><td>{day(x.settled_at, ar)}</td><td>{money(x.expected_amount)}</td><td>{money(x.received_amount)}</td><td><button className="btn btn-secondary" style={{ marginInlineEnd: 6 }} onClick={() => setEditRow({ ...x, date_from: dateValue(x.period_from), date_to: dateValue(x.period_to) })}>{ar ? "تعديل" : "Edit"}</button><button className="btn btn-danger" onClick={() => remove(x)}>{ar ? "حذف" : "Delete"}</button></td></tr>)}</tbody></table></div></div>

    {editRow && <div className="modal-backdrop" onClick={() => setEditRow(null)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>{ar ? "تعديل تسوية العهدة" : "Edit settlement"}</h2><button className="btn btn-secondary" onClick={() => setEditRow(null)}>×</button></div><div className="modal-body"><label className="form-label">{ar ? "المبلغ المستلم" : "Received amount"}</label><input type="number" min="0" step="0.01" className="form-input" value={editRow.received_amount} onChange={e => setEditRow({ ...editRow, received_amount: e.target.value })} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}><div><label className="form-label">{ar ? "من تاريخ" : "From"}</label><input type="date" className="form-input" value={editRow.date_from} onChange={e => setEditRow({ ...editRow, date_from: e.target.value })} /></div><div><label className="form-label">{ar ? "إلى تاريخ" : "To"}</label><input type="date" className="form-input" value={editRow.date_to} onChange={e => setEditRow({ ...editRow, date_to: e.target.value })} /></div></div><label className="form-label" style={{ marginTop: 12 }}>{ar ? "ملاحظات" : "Notes"}</label><textarea className="form-input" rows={3} value={editRow.notes || ""} onChange={e => setEditRow({ ...editRow, notes: e.target.value })} /></div><div className="modal-footer"><button className="btn btn-secondary" onClick={() => setEditRow(null)}>{ar ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" disabled={saving} onClick={edit}>{ar ? "حفظ التعديل" : "Save changes"}</button></div></div></div>}
  </div>;
}
