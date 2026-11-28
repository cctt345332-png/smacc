"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { deleteSettlement, getSettlementBreakdown, getSettlementReport, getSettlementSources, getSettlements, createSettlement, updateSettlement } from "@/lib/settlements";
import { getTreasuries } from "@/lib/treasury";

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
  const [destinationTreasuryId, setDestinationTreasuryId] = useState("");
  const [treasuries, setTreasuries] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<"invoices" | "receipts" | "expenses">("invoices");
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
      const [sourceResponse, rowResponse, treasuryResponse] = await Promise.all([
        getSettlementSources({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
        getSettlements(),
        getTreasuries(),
      ]);
      setSources(sourceResponse.data || []);
      setRows(rowResponse.data || []);
      setTreasuries((treasuryResponse.data || []).filter((x: any) => x.is_active));
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
  useEffect(() => { setDestinationTreasuryId(""); setReceived(""); }, [selected]);

  useEffect(() => {
    let active = true;
    const loadDetail = async () => {
      if (!current) { setDetail(null); return; }
      setDetailTab("invoices");
      try {
        if (current.source_type === "pos") {
          const { data } = await getSettlementBreakdown({ source_type: "pos", source_id: current.source_id, date_from: dateFrom || undefined, date_to: dateTo || undefined });
          if (active) setDetail({ pos: true, ...data, rows: data.rows || [], totals: data.totals || {} });
          return;
        }
        const { data } = await getSettlementBreakdown({ source_type: "rep", source_id: current.source_id, date_from: dateFrom || undefined, date_to: dateTo || undefined });
        if (active) setDetail({ pos: false, ...data });
      } catch { if (active) setDetail(null); }
    };
    loadDetail();
    return () => { active = false; };
  }, [current?.source_id, current?.source_type, dateFrom, dateTo]);

  const save = async () => {
    if (!current || Number(received) < 0) return;
    setSaving(true); setMessage("");
    try {
      if (current.source_type === "pos" && Number(received || 0) > 0 && !destinationTreasuryId) {
        setMessage(ar ? "حدد الخزينة الرئيسية المستلمة للمبلغ" : "Select the destination treasury");
        return;
      }
      await createSettlement({ source_type: current.source_type, source_id: current.source_id, date_from: dateFrom || null, date_to: dateTo || null, received_amount: Number(received || 0), destination_treasury_id: current.source_type === "pos" ? (destinationTreasuryId || null) : null, notes: notes || null });
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
        {current && <div style={{ background: "#F5F3FF", padding: 16, borderRadius: 8, margin: "12px 0" }}><div style={{ fontSize: 12, color: "#6B7280" }}>{ar ? "تفصيل العهدة المطلوبة" : "Custody due breakdown"}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8, fontSize: 13 }}><div>{ar ? "تحصيل الفترة" : "Current period"}<br /><b>{money(current.period_amount)} SAR</b></div><div style={{ color: Number(current.carried_amount || 0) > 0 ? "#B45309" : "inherit" }}>{ar ? "مرحّل من السابق" : "Carried from previous"}<br /><b>{money(current.carried_amount)} SAR</b></div></div><div style={{ borderTop: "1px solid #DDD6FE", marginTop: 10, paddingTop: 8, fontSize: 12 }}>{ar ? "إجمالي المطلوب للتسوية" : "Total due for settlement"}<br /><strong style={{ fontSize: 25, color: "#5A187E" }}>{money(current.expected_amount)} SAR</strong></div><div style={{ fontSize: 12, marginTop: 6 }}>{current.source_type === "pos" && <div style={{ fontSize: 12, marginTop: 8, color: "#B45309" }}>{ar ? "المتبقي بعد الاستلام سيرحل للتسوية القادمة" : "The unpaid amount will carry to the next settlement"}</div>}{current.last_settled_at ? `${ar ? "آخر تسوية" : "Last settlement"}: ${new Date(current.last_settled_at).toLocaleString(ar ? "ar-SA" : "en-GB")}` : ar ? "لا توجد تسوية سابقة" : "No previous settlement"}</div></div>}
        {current?.source_type === "pos" && <div className="form-group">
          <label className="form-label">{ar ? "خزينة درج المصدر" : "Source drawer treasury"}</label>
          <div className="form-input" style={{ background: "#F8FAFC" }}>{current.treasury_name || (ar ? "غير مربوط — اربط الجهاز أولاً" : "Not linked — configure the POS first")}</div>
          <label className="form-label" style={{ marginTop: 10 }}>{ar ? "الخزينة الرئيسية المستلمة" : "Destination main treasury"}</label>
          <select className="form-input form-select" value={destinationTreasuryId} onChange={e => setDestinationTreasuryId(e.target.value)}>
            <option value="">{ar ? "— اختر الخزينة التي سيودع فيها النقد —" : "— Select destination treasury —"}</option>
            {treasuries.filter((t: any) => t.id !== current.treasury_id).map((t: any) => <option key={t.id} value={t.id}>{t.name_ar}{t.branch_name ? ` — ${t.branch_name}` : ""}</option>)}
          </select>
          <div className="form-hint">{ar ? "سيُنشأ تحويل خزينة فعلي بالمبلغ المستلم عند الحفظ." : "A real treasury transfer is posted for the received amount when saved."}</div>
        </div>}
        <div className="form-group"><label className="form-label">{ar ? "المبلغ المستلم فعلياً" : "Actually received"}</label><input type="number" min="0" step="0.01" className="form-input" value={received} onChange={e => setReceived(e.target.value)} placeholder="0.00" /></div><div className="form-group"><label className="form-label">{ar ? "ملاحظات" : "Notes"}</label><textarea className="form-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></div><button className="btn btn-primary" disabled={!current || saving} onClick={save}>{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التسوية" : "Save settlement")}</button>
      </div>
      <div className="card" style={{ padding: 20, minHeight: 240 }}>
        <h2 style={{ marginTop: 0 }}>{ar ? "مصادر النقد بالتفصيل" : "Detailed cash sources"}</h2>
        {!current && <div style={{ color: "var(--text-muted)", padding: "32px 0", textAlign: "center" }}>{ar ? "اختر العهدة لعرض الفواتير والسندات" : "Select a custody to view invoices and receipts"}</div>}
        {detail && <>
          <div style={{ display: "grid", gridTemplateColumns: detail.pos ? "repeat(4,1fr)" : "repeat(3,1fr)", gap: 8, fontSize: 13, marginBottom: 12 }}>
            {detail.pos ? <><div>{ar ? "مبيعات نقدية" : "Cash sales"}<br /><b>{money(detail.totals.cash_sales)} SAR</b></div><div>{ar ? "الافتتاحي" : "Opening"}<br /><b>{money(detail.totals.opening_cash)} SAR</b></div><div>{ar ? "المخرجات" : "Outflows"}<br /><b>{money(detail.totals.cash_outflows)} SAR</b></div><div>{ar ? "المتوقع" : "Expected"}<br /><b>{money(detail.totals.expected)} SAR</b></div></> : <><div>{ar ? "الفواتير" : "Invoices"}<br /><b>{money(detail.totals.invoices)} SAR</b></div><div>{ar ? "السندات النقدية" : "Cash receipts"}<br /><b>{money(detail.totals.receipts)} SAR</b></div><div>{ar ? "المصروفات" : "Expenses"}<br /><b>{money(detail.totals.expenses)} SAR</b></div></>}
          </div>
          <div style={{ display: "flex", gap: 6, borderBottom: "1px solid #E2E8F0", marginBottom: 10 }}>
            {([["invoices", ar ? "الفواتير" : "Invoices"], ["receipts", ar ? "السندات" : "Receipts"], ["expenses", ar ? "المصروفات" : "Expenses"]] as const).map(([key, label]) => <button key={key} type="button" className={detailTab === key ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"} onClick={() => setDetailTab(key)}>{label}</button>)}
          </div>
          <div className="table-wrapper" style={{ maxHeight: 300, overflowY: "auto" }}>
            {detailTab === "invoices" && <table><thead><tr><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "رقم الفاتورة" : "Invoice"}</th><th>{detail.pos && (ar ? "رقم العملية" : "Transaction")}</th><th>{ar ? "المبلغ" : "Amount"}</th></tr></thead><tbody>{(detail.invoices || []).map((x: any) => <tr key={x.invoice_id || x.transaction_id}><td>{day(x.date, ar)}</td><td>{x.invoice_number || "—"}</td><td>{detail.pos ? x.transaction_number : ""}</td><td>{money(x.amount)}</td></tr>)}</tbody><tfoot><tr><th colSpan={3}>{ar ? "إجمالي الفواتير" : "Total invoices"}</th><th>{money(detail.totals.invoices || (detail.totals.transaction_cash || 0))} SAR</th></tr></tfoot></table>}
            {detailTab === "receipts" && <table><thead><tr><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "رقم السند" : "Voucher"}</th><th>{ar ? "الفاتورة المرتبطة" : "Invoice"}</th><th>{ar ? "المبلغ" : "Amount"}</th></tr></thead><tbody>{(detail.receipts || []).map((x: any) => <tr key={x.payment_id || x.transaction_id}><td>{day(x.date, ar)}</td><td>{x.payment_number || x.transaction_number || "—"}</td><td>{x.invoice_number || "—"}</td><td>{money(x.amount)}</td></tr>)}</tbody><tfoot><tr><th colSpan={3}>{ar ? "إجمالي السندات" : "Total receipts"}</th><th>{money(detail.totals.receipts || detail.totals.transaction_cash)} SAR</th></tr></tfoot></table>}
            {detailTab === "expenses" && <table><thead><tr><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "البيان" : "Description"}</th><th>{ar ? "المبلغ" : "Amount"}</th></tr></thead><tbody>{(detail.expenses || []).map((x: any) => <tr key={x.expense_id || x.outflow_id}><td>{day(x.date, ar)}</td><td>{x.description || "—"}</td><td>{money(x.amount)}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>{ar ? "إجمالي المصروفات" : "Total expenses"}</th><th>{money(detail.totals.expenses || detail.totals.cash_outflows)} SAR</th></tr></tfoot></table>}
          </div>
        </>}
      </div>
    </div>

    <div className="card" style={{ marginTop: 16 }}><div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div className="card-title">{ar ? "تقرير استلام العهد" : "Custody collection report"}</div><Link href={`/${locale}/treasury/settlements/report`} className="btn btn-ghost btn-sm">{ar ? "فتح التقرير الكامل" : "Open full report"}</Link></div><div className="card-body" style={{ color: "var(--text-secondary)", fontSize: 13 }}>{ar ? "استخدم التقرير الموحد لتحديد الفترة والمندوب وعرض إجمالي المتوقع والمستلم والفرق بالتفصيل." : "Use the unified report to filter by period and representative and view expected, received and variance totals."}</div></div>

    <div className="card" style={{ padding: 20, marginTop: 16 }}><h2 style={{ marginTop: 0 }}>{ar ? "سجل التسويات" : "Settlement history"}</h2><div className="table-wrapper"><table><thead><tr><th>{ar ? "العهدة" : "Custody"}</th><th>{ar ? "الفترة" : "Period"}</th><th>{ar ? "تاريخ التسوية" : "Settled"}</th><th>{ar ? "المتوقع" : "Expected"}</th><th>{ar ? "المستلم" : "Received"}</th><th>{ar ? "المرحل" : "Carried"}</th><th>{ar ? "التحويل" : "Transfer"}</th><th>{ar ? "الإجراءات" : "Actions"}</th></tr></thead><tbody>{rows.map(x => <tr key={x.id}><td>{x.source_label}</td><td>{day(x.period_from, ar)} — {day(x.period_to, ar)}</td><td>{day(x.settled_at, ar)}</td><td>{money(x.expected_amount)}</td><td>{money(x.received_amount)}</td><td>{money(x.retained_amount)}</td><td>{x.transfer_voucher_id ? (ar ? "تم التحويل" : "Transferred") : "—"}</td><td>{!x.transfer_voucher_id && <button className="btn btn-secondary" style={{ marginInlineEnd: 6 }} onClick={() => setEditRow({ ...x, date_from: dateValue(x.period_from), date_to: dateValue(x.period_to) })}>{ar ? "تعديل" : "Edit"}</button>}<button className="btn btn-danger" onClick={() => remove(x)}>{ar ? "حذف" : "Delete"}</button></td></tr>)}</tbody></table></div></div>

    {editRow && <div className="modal-backdrop" onClick={() => setEditRow(null)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-header"><h2>{ar ? "تعديل تسوية العهدة" : "Edit settlement"}</h2><button className="btn btn-secondary" onClick={() => setEditRow(null)}>×</button></div><div className="modal-body"><label className="form-label">{ar ? "المبلغ المستلم" : "Received amount"}</label><input type="number" min="0" step="0.01" className="form-input" value={editRow.received_amount} onChange={e => setEditRow({ ...editRow, received_amount: e.target.value })} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}><div><label className="form-label">{ar ? "من تاريخ" : "From"}</label><input type="date" className="form-input" value={editRow.date_from} onChange={e => setEditRow({ ...editRow, date_from: e.target.value })} /></div><div><label className="form-label">{ar ? "إلى تاريخ" : "To"}</label><input type="date" className="form-input" value={editRow.date_to} onChange={e => setEditRow({ ...editRow, date_to: e.target.value })} /></div></div><label className="form-label" style={{ marginTop: 12 }}>{ar ? "ملاحظات" : "Notes"}</label><textarea className="form-input" rows={3} value={editRow.notes || ""} onChange={e => setEditRow({ ...editRow, notes: e.target.value })} /></div><div className="modal-footer"><button className="btn btn-secondary" onClick={() => setEditRow(null)}>{ar ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" disabled={saving} onClick={edit}>{ar ? "حفظ التعديل" : "Save changes"}</button></div></div></div>}
  </div>;
}
