"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getBudgets, createBudget, getFiscalYears, getAccounts } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

export default function BudgetsPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [budgets, setBudgets] = useState<any[]>([]);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", fiscal_year_id: "" });
  const [lines, setLines] = useState<any[]>([]);

  const load = async () => {
    try {
      const [b, f, a] = await Promise.all([getBudgets(), getFiscalYears(), getAccounts()]);
      setBudgets(b.data); setFiscalYears(f.data);
      setAccounts(a.data.filter((acc: any) => acc.account_type === "expense" || acc.account_type === "revenue"));
      if (f.data.length) setForm(prev => ({ ...prev, fiscal_year_id: f.data[0].id }));
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addLine = () => setLines(prev => [...prev, { account_id: "", ...Object.fromEntries(MONTH_KEYS.map(k => [k, "0"])) }]);
  const updateLine = (i: number, field: string, val: string) => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const lineTotal = (line: any) => MONTH_KEYS.reduce((s, k) => s + (parseFloat(line[k]) || 0), 0);
  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  const handleSave = async () => {
    if (!form.name || !form.fiscal_year_id) return alert(ar ? "أدخل الاسم والسنة المالية" : "Enter name and fiscal year");
    setSaving(true);
    try {
      await createBudget({
        ...form,
        lines: lines.filter(l => l.account_id).map(l => ({
          account_id: l.account_id,
          ...Object.fromEntries(MONTH_KEYS.map(k => [k, parseFloat(l[k]) || 0])),
        })),
      });
      setShowModal(false); setLines([]); load();
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الميزانيات التقديرية" : "Budgets"}</span>
          </div>
          <h1 className="page-title">{ar ? "الميزانيات التقديرية" : "Budgets"}</h1>
          <p className="page-subtitle">{ar ? "تخطيط الإيرادات والمصروفات السنوية" : "Plan annual revenues and expenses"}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ {ar ? "ميزانية جديدة" : "New Budget"}</button>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border)", margin: "0 auto 12px" }} /></div>
          ) : budgets.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}><Icon name="chart" size={24} /></div>
              <div className="empty-state-title">{ar ? "لا توجد ميزانيات" : "No budgets"}</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowModal(true)}>+ {ar ? "إنشاء ميزانية" : "Create Budget"}</button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "اسم الميزانية" : "Budget Name"}</th>
                  <th>{ar ? "السنة المالية" : "Fiscal Year"}</th>
                  <th>{ar ? "تاريخ الإنشاء" : "Created"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{b.name}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                      {fiscalYears.find(f => f.id === b.fiscal_year_id)?.name || b.fiscal_year_id}
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{new Date(b.created_at).toLocaleDateString("en-SA")}</td>
                    <td><span className={`badge ${b.is_active ? "badge-success" : "badge-gray"}`}>{b.is_active ? (ar ? "نشطة" : "Active") : (ar ? "موقوفة" : "Inactive")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 900, maxHeight: "90vh", overflow: "auto" }} className="animate-slide">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", zIndex: 1 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "ميزانية تقديرية جديدة" : "New Budget"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="grid-2" style={{ marginBottom: 20 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{ar ? "اسم الميزانية" : "Budget Name"} <span className="required">*</span></label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={ar ? "ميزانية 2026" : "Budget 2026"} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{ar ? "السنة المالية" : "Fiscal Year"} <span className="required">*</span></label>
                  <select className="form-input form-select" value={form.fiscal_year_id} onChange={e => setForm(f => ({ ...f, fiscal_year_id: e.target.value }))}>
                    {fiscalYears.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Lines */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{ar ? "بنود الميزانية" : "Budget Lines"}</span>
                <button className="btn btn-secondary btn-sm" onClick={addLine}>+ {ar ? "إضافة بند" : "Add Line"}</button>
              </div>

              {lines.length > 0 && (
                <div style={{ overflowX: "auto", marginBottom: 16 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC" }}>
                        <th style={{ padding: "8px 10px", textAlign: "start", borderBottom: "1px solid var(--border)", minWidth: 200 }}>{ar ? "الحساب" : "Account"}</th>
                        {(ar ? MONTHS_AR : MONTHS_EN).map((m, i) => (
                          <th key={i} style={{ padding: "8px 8px", textAlign: "end", borderBottom: "1px solid var(--border)", minWidth: 80 }}>{m}</th>
                        ))}
                        <th style={{ padding: "8px 10px", textAlign: "end", borderBottom: "1px solid var(--border)", minWidth: 90, fontWeight: 700 }}>{ar ? "الإجمالي" : "Total"}</th>
                        <th style={{ width: 36, borderBottom: "1px solid var(--border)" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "6px 10px" }}>
                            <select className="form-input form-select" style={{ fontSize: 12 }} value={line.account_id} onChange={e => updateLine(i, "account_id", e.target.value)}>
                              <option value="">{ar ? "اختر..." : "Select..."}</option>
                              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>)}
                            </select>
                          </td>
                          {MONTH_KEYS.map(k => (
                            <td key={k} style={{ padding: "6px 4px" }}>
                              <input type="number" style={{ width: 76, padding: "5px 6px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, textAlign: "end", outline: "none" }}
                                value={line[k]} onChange={e => updateLine(i, k, e.target.value)} min="0" step="0.01" />
                            </td>
                          ))}
                          <td style={{ padding: "6px 10px", textAlign: "end", fontWeight: 700, color: "var(--primary)" }}>
                            {lineTotal(line).toLocaleString("en-US", { minimumFractionDigits: 0 })}
                          </td>
                          <td style={{ padding: "6px 4px" }}>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeLine(i)} style={{ color: "var(--danger)" }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                        <td style={{ padding: "10px 10px" }}>{ar ? "الإجمالي" : "Total"}</td>
                        {MONTH_KEYS.map(k => (
                          <td key={k} style={{ padding: "10px 8px", textAlign: "end", color: "var(--primary)" }}>
                            {lines.reduce((s, l) => s + (parseFloat(l[k]) || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 0 })}
                          </td>
                        ))}
                        <td style={{ padding: "10px 10px", textAlign: "end", color: "var(--primary)", fontSize: 14 }}>
                          {grandTotal.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {lines.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: 13, border: "2px dashed var(--border)", borderRadius: 10, marginBottom: 16 }}>
                  {ar ? "اضغط «إضافة بند» لإضافة حسابات للميزانية" : "Click «Add Line» to add accounts to the budget"}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "..." : (ar ? "حفظ الميزانية" : "Save Budget")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
