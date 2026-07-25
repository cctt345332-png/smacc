"use client";
import { useState } from "react";
import Link from "next/link";
import { runDepreciation } from "@/lib/assets";
import { getFiscalYears } from "@/lib/accounting";
import { useEffect } from "react";

export default function DepreciationPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const now = new Date();
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [form, setForm] = useState({
    period_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
    fiscal_year_id: "",
    post_entries: false,
  });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    getFiscalYears().then(({ data }) => {
      setFiscalYears(data);
      if (data.length) setForm(f => ({ ...f, fiscal_year_id: data[0].id }));
    });
  }, []);

  const handleRun = async () => {
    if (!form.fiscal_year_id) return alert(ar ? "اختر السنة المالية" : "Select fiscal year");
    if (!confirm(ar
      ? `تشغيل الاستهلاك لشهر ${form.period_date}؟`
      : `Run depreciation for ${form.period_date}?`)) return;

    setRunning(true);
    try {
      const { data } = await runDepreciation({
        period_date: new Date(form.period_date).toISOString(),
        fiscal_year_id: form.fiscal_year_id,
        post_entries: form.post_entries,
      });
      setResult(data);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setRunning(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/assets`}>{ar ? "الأصول الثابتة" : "Fixed Assets"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "تشغيل الاستهلاك" : "Run Depreciation"}</span>
          </div>
          <h1 className="page-title">{ar ? "تشغيل الاستهلاك الشهري" : "Run Monthly Depreciation"}</h1>
          <p className="page-subtitle">{ar ? "احتساب وترحيل قيود الاستهلاك لجميع الأصول النشطة" : "Calculate and post depreciation entries for all active assets"}</p>
        </div>
      </div>

      <div style={{ maxWidth: 560 }}>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">{ar ? "إعدادات التشغيل" : "Run Settings"}</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">{ar ? "فترة الاستهلاك (الشهر)" : "Depreciation Period (Month)"} <span className="required">*</span></label>
              <input type="month" className="form-input"
                value={form.period_date.substring(0, 7)}
                onChange={e => setForm(f => ({ ...f, period_date: e.target.value + "-01" }))} />
              <p className="form-hint">{ar ? "سيتم احتساب الاستهلاك لجميع الأصول النشطة في هذا الشهر" : "Depreciation will be calculated for all active assets in this month"}</p>
            </div>
            <div className="form-group">
              <label className="form-label">{ar ? "السنة المالية" : "Fiscal Year"} <span className="required">*</span></label>
              <select className="form-input form-select" value={form.fiscal_year_id} onChange={e => setForm(f => ({ ...f, fiscal_year_id: e.target.value }))}>
                <option value="">{ar ? "اختر..." : "Select..."}</option>
                {fiscalYears.map(fy => <option key={fy.id} value={fy.id}>{fy.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                <input type="checkbox" checked={form.post_entries}
                  onChange={e => setForm(f => ({ ...f, post_entries: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }} />
                {ar ? "ترحيل قيود الاستهلاك تلقائياً" : "Auto-post depreciation journal entries"}
              </label>
              <p className="form-hint">{ar ? "يتطلب ربط حسابات الاستهلاك في فئات الأصول" : "Requires depreciation accounts linked in asset categories"}</p>
            </div>

            <div style={{ background: "#FEF9C3", border: "1px solid #FDE047", borderRadius: 8, padding: 12, fontSize: 12, color: "#854D0E", marginBottom: 16 }}>
              {ar
                ? "تنبيه: لا يمكن التراجع عن تشغيل الاستهلاك. تأكد من صحة البيانات قبل المتابعة."
                : "Warning: Depreciation run cannot be undone. Verify data before proceeding."}
            </div>

            <button className="btn btn-primary" onClick={handleRun} disabled={running} style={{ width: "100%" }}>
              {running ? (ar ? "جاري التشغيل..." : "Running...") : (ar ? "تشغيل الاستهلاك" : "Run Depreciation")}
            </button>
          </div>
        </div>

        {result && (
          <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#166534", marginBottom: 8 }}>
              {ar ? "تم تشغيل الاستهلاك بنجاح" : "Depreciation Run Completed"}
            </div>
            <div style={{ fontSize: 13, color: "#166534" }}>
              {ar ? `تم احتساب استهلاك ${result.processed} أصل` : `Processed ${result.processed} assets`}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
