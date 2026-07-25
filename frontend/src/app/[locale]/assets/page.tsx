"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getAssets, getAssetsSummary } from "@/lib/assets";
import { Icon } from "@/components/ui/Icons";

const STATUS_COLORS: Record<string, string> = {
  active: "badge-success", disposed: "badge-gray",
  scrapped: "badge-danger", under_maintenance: "badge-warning",
};
const STATUS_AR: Record<string, string> = {
  active: "نشط", disposed: "متخلص منه", scrapped: "خردة", under_maintenance: "تحت الصيانة",
};
const STATUS_EN: Record<string, string> = {
  active: "Active", disposed: "Disposed", scrapped: "Scrapped", under_maintenance: "Maintenance",
};

export default function AssetsPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [assets, setAssets] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      const [a, s] = await Promise.all([getAssets(filterStatus || undefined), getAssetsSummary()]);
      setAssets(a.data);
      setSummary(s.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const fmt = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 });

  const filtered = assets.filter(a => {
    const q = search.toLowerCase();
    return !q || a.asset_number.toLowerCase().includes(q) || a.name_ar.includes(q) || (a.name_en || "").toLowerCase().includes(q);
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الأصول الثابتة" : "Fixed Assets"}</span>
          </div>
          <h1 className="page-title">{ar ? "الأصول الثابتة" : "Fixed Assets"}</h1>
          <p className="page-subtitle">{ar ? "إدارة وتتبع الأصول الثابتة للشركة" : "Manage and track company fixed assets"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/assets/categories`} className="btn btn-secondary btn-sm">
            {ar ? "الفئات" : "Categories"}
          </Link>
          <Link href={`/${locale}/assets/depreciation`} className="btn btn-secondary btn-sm">
            {ar ? "تشغيل الاستهلاك" : "Run Depreciation"}
          </Link>
          <Link href={`/${locale}/assets/new`} className="btn btn-primary btn-sm">
            + {ar ? "أصل جديد" : "New Asset"}
          </Link>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: ar ? "إجمالي الأصول" : "Total Assets", value: summary.total_assets, color: "#2563EB", icon: <Icon name="box" size={20} /> },
            { label: ar ? "إجمالي التكلفة" : "Total Cost", value: `${fmt(summary.total_cost)} ${ar ? "ر.س" : "SAR"}`, color: "#7C3AED", icon: <Icon name="money" size={20} /> },
            { label: ar ? "مجمع الاستهلاك" : "Accum. Depreciation", value: `${fmt(summary.total_accumulated_depreciation)} ${ar ? "ر.س" : "SAR"}`, color: "#D97706", icon: <Icon name="trendingDown" size={20} /> },
            { label: ar ? "القيمة الدفترية" : "Net Book Value", value: `${fmt(summary.total_book_value)} ${ar ? "ر.س" : "SAR"}`, color: "#059669", icon: <Icon name="chart" size={20} /> },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: s.color + "18", color: s.color }}>{s.icon}</div>
              <div className="stat-content">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ fontSize: typeof s.value === "string" && s.value.length > 12 ? 16 : 22 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input className="form-input" style={{ width: 240 }}
            placeholder={ar ? "بحث برقم الأصل أو الاسم..." : "Search by number or name..."}
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-input form-select" style={{ width: 180 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">{ar ? "كل الحالات" : "All Status"}</option>
            <option value="active">{ar ? "نشط" : "Active"}</option>
            <option value="disposed">{ar ? "متخلص منه" : "Disposed"}</option>
            <option value="under_maintenance">{ar ? "تحت الصيانة" : "Maintenance"}</option>
            <option value="scrapped">{ar ? "خردة" : "Scrapped"}</option>
          </select>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {filtered.length} {ar ? "أصل" : "assets"}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border)", margin: "0 auto 12px" }} />
              <div>{ar ? "جاري التحميل..." : "Loading..."}</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}>
                <Icon name="box" size={24} />
              </div>
              <div className="empty-state-title">{ar ? "لا توجد أصول ثابتة" : "No fixed assets"}</div>
              <Link href={`/${locale}/assets/new`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                + {ar ? "إضافة أصل" : "Add Asset"}
              </Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم الأصل" : "Asset #"}</th>
                  <th>{ar ? "اسم الأصل" : "Asset Name"}</th>
                  <th>{ar ? "تاريخ الشراء" : "Purchase Date"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "تكلفة الشراء" : "Cost"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "مجمع الاستهلاك" : "Accum. Dep."}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "القيمة الدفترية" : "Book Value"}</th>
                  <th>{ar ? "طريقة الاستهلاك" : "Method"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(asset => (
                  <tr key={asset.id}>
                    <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>{asset.asset_number}</code></td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{ar ? asset.name_ar : (asset.name_en || asset.name_ar)}</div>
                      {asset.location && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{asset.location}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {new Date(asset.purchase_date).toLocaleDateString("en-SA")}
                    </td>
                    <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(Number(asset.purchase_cost))}</td>
                    <td style={{ textAlign: "end", color: "#D97706" }}>{fmt(Number(asset.accumulated_depreciation))}</td>
                    <td style={{ textAlign: "end", fontWeight: 700, color: "#059669" }}>{fmt(Number(asset.book_value))}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {asset.depreciation_method === "straight_line"
                        ? (ar ? "قسط ثابت" : "Straight Line")
                        : (ar ? "قسط متناقص" : "Declining")}
                    </td>
                    <td><span className={`badge ${STATUS_COLORS[asset.status]}`}>{ar ? STATUS_AR[asset.status] : STATUS_EN[asset.status]}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Link href={`/${locale}/assets/${asset.id}`} className="btn btn-ghost btn-sm btn-icon" title={ar ? "عرض" : "View"}>
                          <Icon name="view" size={14} />
                        </Link>
                        <Link href={`/${locale}/assets/${asset.id}/edit`} className="btn btn-ghost btn-sm btn-icon" title={ar ? "تعديل" : "Edit"}>
                          <Icon name="edit" size={14} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
