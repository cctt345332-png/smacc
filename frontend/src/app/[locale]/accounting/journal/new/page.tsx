"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAccounts, getFiscalYears, getCostCenters, createJournalEntry } from "@/lib/accounting";
import SearchableAccountSelect from "@/components/accounting/SearchableAccountSelect";

interface Line { account_id: string; cost_center_id: string; description: string; debit: string; credit: string; }

const emptyLine = (): Line => ({ account_id: "", cost_center_id: "", description: "", debit: "", credit: "" });

export default function NewJournalPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split("T")[0],
    fiscal_year_id: "",
    description_ar: "",
    description_en: "",
    reference: "",
    notes: "",
  });
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);

  useEffect(() => {
    Promise.all([getAccounts(), getFiscalYears(), getCostCenters()]).then(([a, f, c]) => {
      setAccounts(a.data);
      setFiscalYears(f.data);
      setCostCenters(c.data);
      if (f.data.length > 0) setForm(prev => ({ ...prev, fiscal_year_id: f.data[0].id }));
    });
  }, []);

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const updateLine = (i: number, field: keyof Line, value: string) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (i: number) => { if (lines.length > 2) setLines(prev => prev.filter((_, idx) => idx !== i)); };

  const handleSave = async (post = false) => {
    if (!form.description_ar) return alert(ar ? "أدخل البيان" : "Enter description");
    if (!form.fiscal_year_id) return alert(ar ? "اختر السنة المالية" : "Select fiscal year");
    if (!isBalanced) return alert(ar ? "القيد غير متوازن" : "Entry is not balanced");

    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) return alert(ar ? "أضف سطرين على الأقل" : "Add at least 2 lines");

    setSaving(true);
    try {
      const { data } = await createJournalEntry({
        ...form,
        entry_date: new Date(form.entry_date).toISOString(),
        lines: validLines.map((l, i) => ({
          account_id: l.account_id,
          cost_center_id: l.cost_center_id || null,
          description: l.description || null,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          line_order: i,
        })),
      });
      if (post) {
        const { postJournalEntry } = await import("@/lib/accounting");
        await postJournalEntry(data.id);
      }
      router.push(`/${locale}/accounting/journal`);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Error");
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/accounting/journal`}>{ar ? "قيود اليومية" : "Journal Entries"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "قيد جديد" : "New Entry"}</span>
          </div>
          <h1 className="page-title">{ar ? "قيد يومية جديد" : "New Journal Entry"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/accounting/journal`} className="btn btn-secondary btn-sm">{ar ? "إلغاء" : "Cancel"}</Link>
          <button className="btn btn-secondary btn-sm" onClick={() => handleSave(false)} disabled={saving}>
            {ar ? "حفظ كمسودة" : "Save Draft"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => handleSave(true)} disabled={saving || !isBalanced}>
            {ar ? "حفظ وترحيل" : "Save & Post"}
          </button>
        </div>
      </div>

      {/* Header info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">{ar ? "بيانات القيد" : "Entry Details"}</span></div>
        <div className="card-body">
          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">{ar ? "تاريخ القيد" : "Entry Date"} <span className="required">*</span></label>
              <input type="date" className="form-input" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "السنة المالية" : "Fiscal Year"} <span className="required">*</span></label>
              <select className="form-input form-select" value={form.fiscal_year_id} onChange={e => setForm(f => ({ ...f, fiscal_year_id: e.target.value }))}>
                <option value="">{ar ? "اختر..." : "Select..."}</option>
                {fiscalYears.map(fy => <option key={fy.id} value={fy.id}>{fy.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "المرجع" : "Reference"}</label>
              <input className="form-input" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="INV-001" />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{ar ? "البيان (عربي)" : "Description (Arabic)"} <span className="required">*</span></label>
              <input className="form-input" value={form.description_ar} onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))} placeholder={ar ? "وصف القيد..." : "Entry description..."} />
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "البيان (إنجليزي)" : "Description (English)"}</label>
              <input className="form-input" value={form.description_en} onChange={e => setForm(f => ({ ...f, description_en: e.target.value }))} />
            </div>
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">{ar ? "سطور القيد" : "Entry Lines"}</span>
          <button className="btn btn-secondary btn-sm" onClick={addLine}>+ {ar ? "إضافة سطر" : "Add Line"}</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                <th style={{ padding: "10px 12px", textAlign: "start", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", minWidth: 220 }}>{ar ? "الحساب" : "Account"}</th>
                <th style={{ padding: "10px 12px", textAlign: "start", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", minWidth: 140 }}>{ar ? "مركز التكلفة" : "Cost Center"}</th>
                <th style={{ padding: "10px 12px", textAlign: "start", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", minWidth: 160 }}>{ar ? "البيان" : "Description"}</th>
                <th style={{ padding: "10px 12px", textAlign: "end", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", minWidth: 120 }}>{ar ? "مدين" : "Debit"}</th>
                <th style={{ padding: "10px 12px", textAlign: "end", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", minWidth: 120 }}>{ar ? "دائن" : "Credit"}</th>
                <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "8px 12px" }}>
                    <SearchableAccountSelect
                      accounts={accounts}
                      value={line.account_id}
                      onChange={(accountId) => updateLine(i, "account_id", accountId)}
                      locale={locale}
                      style={{ fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <select className="form-input form-select" style={{ fontSize: 12 }} value={line.cost_center_id} onChange={e => updateLine(i, "cost_center_id", e.target.value)}>
                      <option value="">{ar ? "— اختياري —" : "— Optional —"}</option>
                      {costCenters.map(c => <option key={c.id} value={c.id}>{c.code} - {ar ? c.name_ar : c.name_en}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <input className="form-input" style={{ fontSize: 12 }} value={line.description} onChange={e => updateLine(i, "description", e.target.value)} placeholder={ar ? "بيان..." : "Description..."} />
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <input type="number" className="form-input" style={{ fontSize: 12, textAlign: "end" }} value={line.debit}
                      onChange={e => { updateLine(i, "debit", e.target.value); if (e.target.value) updateLine(i, "credit", ""); }}
                      placeholder="0.00" min="0" step="0.01" />
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <input type="number" className="form-input" style={{ fontSize: 12, textAlign: "end" }} value={line.credit}
                      onChange={e => { updateLine(i, "credit", e.target.value); if (e.target.value) updateLine(i, "debit", ""); }}
                      placeholder="0.00" min="0" step="0.01" />
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeLine(i)} style={{ color: "var(--danger)" }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#F8FAFC", borderTop: "2px solid var(--border)" }}>
                <td colSpan={3} style={{ padding: "12px 16px", fontWeight: 700, fontSize: 13 }}>{ar ? "الإجمالي" : "Total"}</td>
                <td style={{ padding: "12px 16px", textAlign: "end", fontWeight: 700, fontSize: 14, color: "#5A187E" }}>
                  {totalDebit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "end", fontWeight: 700, fontSize: 14, color: "#6F4A84" }}>
                  {totalCredit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Balance indicator */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          {isBalanced ? (
            <span style={{ color: "#6F4A84", fontWeight: 600, fontSize: 13 }}>✅ {ar ? "القيد متوازن" : "Entry is balanced"}</span>
          ) : (
            <span style={{ color: "#DC2626", fontWeight: 600, fontSize: 13 }}>
              ⚠️ {ar ? "الفرق:" : "Difference:"} {Math.abs(totalDebit - totalCredit).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
