"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getAssets, getAssetsSummary } from "@/lib/assets";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

export default function AssetReportsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [assets, setAssets] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState("register");

  useEffect(() => {
    Promise.all([getAssets(), getAssetsSummary()]).then(([a, s]) => {
      setAssets(a.data); setSummary(s.data);
    }).finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 });

  const reports = [
    { key: "register", ar: "سجل الأصول الثابتة", en: "Fixed Asset Register" },
    { key: "depreciation", ar: "جدول الاستهلاك السنوي", en: "Annual Depreciation Schedule" },
    { key: "bookvalue", ar: "القيمة الدفترية", en: "Net Book Value Report" },
    { key: "disposal", ar: "الأصول المتخلص منها", en: "Disposed Assets" },
  ];

  const activeAssets = assets.filter(a => a.status === "active");
  const disposedAssets = assets.filter(a => a.status === "disposed");
  const printableAssets = reportType === "disposal" ? disposedAssets : activeAssets;
  const selectedReport = reports.find(r => r.key === reportType) || reports[0];
  const includeBook = ["register", "depreciation", "bookvalue"].includes(reportType);
  const includeAnnual = reportType === "depreciation";
  const includeDisposal = reportType === "disposal";
  const assetHeaders = [ar ? "رقم الأصل" : "Asset #", ar ? "اسم الأصل" : "Asset name", ar ? "تاريخ الشراء" : "Purchase date", ar ? "التكلفة" : "Cost", ...(includeBook ? [ar ? "مجمع الاستهلاك" : "Accum. dep.", ar ? "القيمة الدفترية" : "Book value"] : []), ...(includeAnnual ? [ar ? "الاستهلاك السنوي" : "Annual dep."] : []), ...(includeDisposal ? [ar ? "تاريخ التخلص" : "Disposal date", ar ? "قيمة التخلص" : "Disposal amount"] : []), ar ? "الحالة" : "Status"];
  const assetRows = printableAssets.map((asset: any) => {
    const annual = (Number(asset.purchase_cost) - Number(asset.salvage_value || 0)) / Number(asset.useful_life_years || 1);
    return [asset.asset_number || "—", ar ? asset.name_ar : asset.name_en || asset.name_ar, asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString("en-GB") : "—", `${fmt(Number(asset.purchase_cost))} SAR`, ...(includeBook ? [`${fmt(Number(asset.accumulated_depreciation))} SAR`, `${fmt(Number(asset.book_value))} SAR`] : []), ...(includeAnnual ? [`${fmt(annual)} SAR`] : []), ...(includeDisposal ? [asset.disposal_date ? new Date(asset.disposal_date).toLocaleDateString("en-GB") : "—", asset.disposal_amount ? `${fmt(Number(asset.disposal_amount))} SAR` : "—"] : []), asset.status === "active" ? (ar ? "نشط" : "Active") : (ar ? "متخلص منه" : "Disposed")];
  });
  const assetTotals = [ar ? "الإجمالي" : "TOTAL", "", "", `${fmt(printableAssets.reduce((s, a: any) => s + Number(a.purchase_cost || 0), 0))} SAR`, ...(includeBook ? [`${fmt(activeAssets.reduce((s, a: any) => s + Number(a.accumulated_depreciation || 0), 0))} SAR`, `${fmt(activeAssets.reduce((s, a: any) => s + Number(a.book_value || 0), 0))} SAR`] : []), ...(includeAnnual ? [`${fmt(activeAssets.reduce((s, a: any) => s + ((Number(a.purchase_cost) - Number(a.salvage_value || 0)) / Number(a.useful_life_years || 1)), 0))} SAR`] : []), ...(includeDisposal ? ["", ""] : []), ""];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "تقارير الأصول الثابتة" : "Fixed Asset Reports"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقارير الأصول الثابتة" : "Fixed Asset Reports"}</h1>
        </div>
        <StructuredReportPrintButton locale={locale} title={ar ? selectedReport.ar : selectedReport.en} subtitle={ar ? "تقرير الأصول الثابتة" : "Fixed asset report"} period={ar ? "حتى تاريخ الطباعة" : "As of print date"} reportCode={`FA-${reportType.toUpperCase()}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "إجمالي الأصول" : "Total assets", value: String(summary?.total_assets || 0), tone: "blue" }, { label: ar ? "إجمالي التكلفة" : "Total cost", value: `${fmt(summary?.total_cost || 0)} SAR`, tone: "blue" }, { label: ar ? "مجمع الاستهلاك" : "Accumulated depreciation", value: `${fmt(summary?.total_accumulated_depreciation || 0)} SAR`, tone: "amber" }, { label: ar ? "القيمة الدفترية" : "Net book value", value: `${fmt(summary?.total_book_value || 0)} SAR`, tone: "green" }]} tables={[{ title: ar ? selectedReport.ar : selectedReport.en, headers: assetHeaders, rows: assetRows, totals: assetTotals }]} />
      </div>

      {/* Report selector */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {reports.map(r => (
            <button key={r.key} onClick={() => setReportType(r.key)}
              className={`btn btn-sm ${reportType === r.key ? "btn-primary" : "btn-secondary"}`}>
              {ar ? r.ar : r.en}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: ar ? "إجمالي الأصول" : "Total Assets", value: summary.total_assets, color: "#587795" },
            { label: ar ? "إجمالي التكلفة" : "Total Cost", value: `${fmt(summary.total_cost)} ${ar ? "ر.س" : "SAR"}`, color: "#5D7E9F" },
            { label: ar ? "مجمع الاستهلاك" : "Accum. Dep.", value: `${fmt(summary.total_accumulated_depreciation)} ${ar ? "ر.س" : "SAR"}`, color: "#D97706" },
            { label: ar ? "القيمة الدفترية" : "Net Book Value", value: `${fmt(summary.total_book_value)} ${ar ? "ر.س" : "SAR"}`, color: "#059669" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Report table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? reports.find(r => r.key === reportType)?.ar : reports.find(r => r.key === reportType)?.en}</span>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border)", margin: "0 auto 12px" }} /></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم الأصل" : "Asset #"}</th>
                  <th>{ar ? "اسم الأصل" : "Asset Name"}</th>
                  <th>{ar ? "تاريخ الشراء" : "Purchase Date"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "تكلفة الشراء" : "Cost"}</th>
                  {(reportType === "register" || reportType === "depreciation" || reportType === "bookvalue") && (
                    <>
                      <th style={{ textAlign: "end" }}>{ar ? "مجمع الاستهلاك" : "Accum. Dep."}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "القيمة الدفترية" : "Book Value"}</th>
                    </>
                  )}
                  {reportType === "depreciation" && (
                    <th style={{ textAlign: "end" }}>{ar ? "الاستهلاك السنوي" : "Annual Dep."}</th>
                  )}
                  {reportType === "disposal" && (
                    <>
                      <th>{ar ? "تاريخ التخلص" : "Disposal Date"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "قيمة التخلص" : "Disposal Amount"}</th>
                    </>
                  )}
                  <th>{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {(reportType === "disposal" ? disposedAssets : activeAssets).map(asset => {
                  const annualDep = reportType === "depreciation"
                    ? (Number(asset.purchase_cost) - Number(asset.salvage_value)) / asset.useful_life_years
                    : 0;
                  return (
                    <tr key={asset.id}>
                      <td><code style={{ fontSize: 12, fontWeight: 700 }}>{asset.asset_number}</code></td>
                      <td>{ar ? asset.name_ar : (asset.name_en || asset.name_ar)}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(asset.purchase_date).toLocaleDateString("en-SA")}</td>
                      <td style={{ textAlign: "end" }}>{fmt(Number(asset.purchase_cost))}</td>
                      {(reportType === "register" || reportType === "depreciation" || reportType === "bookvalue") && (
                        <>
                          <td style={{ textAlign: "end", color: "#D97706" }}>{fmt(Number(asset.accumulated_depreciation))}</td>
                          <td style={{ textAlign: "end", fontWeight: 700, color: "#059669" }}>{fmt(Number(asset.book_value))}</td>
                        </>
                      )}
                      {reportType === "depreciation" && (
                        <td style={{ textAlign: "end", color: "#5D7E9F" }}>{fmt(annualDep)}</td>
                      )}
                      {reportType === "disposal" && (
                        <>
                          <td style={{ fontSize: 12 }}>{asset.disposal_date ? new Date(asset.disposal_date).toLocaleDateString("en-SA") : "—"}</td>
                          <td style={{ textAlign: "end" }}>{asset.disposal_amount ? fmt(Number(asset.disposal_amount)) : "—"}</td>
                        </>
                      )}
                      <td>
                        <span className={`badge ${asset.status === "active" ? "badge-success" : "badge-gray"}`}>
                          {asset.status === "active" ? (ar ? "نشط" : "Active") : (ar ? "متخلص منه" : "Disposed")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {(reportType !== "disposal" ? activeAssets : disposedAssets).length > 0 && (
                <tfoot>
                  <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                    <td colSpan={3} style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                    <td style={{ textAlign: "end", padding: "12px 16px" }}>
                      {fmt((reportType === "disposal" ? disposedAssets : activeAssets).reduce((s, a) => s + Number(a.purchase_cost), 0))}
                    </td>
                    {(reportType === "register" || reportType === "depreciation" || reportType === "bookvalue") && (
                      <>
                        <td style={{ textAlign: "end", padding: "12px 16px", color: "#D97706" }}>
                          {fmt(activeAssets.reduce((s, a) => s + Number(a.accumulated_depreciation), 0))}
                        </td>
                        <td style={{ textAlign: "end", padding: "12px 16px", color: "#059669" }}>
                          {fmt(activeAssets.reduce((s, a) => s + Number(a.book_value), 0))}
                        </td>
                      </>
                    )}
                    {reportType === "depreciation" && <td />}
                    {reportType === "disposal" && <td colSpan={2} />}
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </>
  );
}
