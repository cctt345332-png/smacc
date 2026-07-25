"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PLANS, type PlanKey } from "@/lib/activityConfig";

const IcBuilding = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h6"/><path d="M3 15h6"/><path d="M15 9h3"/><path d="M15 15h3"/></svg>;
const IcWarehouse= () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcInfo     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;

export default function BranchesPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const { plan: storePlan } = useAuthStore();

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  const planCfg    = PLANS[storePlan as PlanKey] || PLANS.trial;
  const branchLimit = planCfg.limits.branches;

  useEffect(() => {
    api.get("/inventory/warehouses")
      .then(({ data }) => setWarehouses(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // تجميع المستودعات حسب الفرع
  const branchMap: Record<string, any[]> = {};
  warehouses.forEach(w => {
    const branch = w.branch_name || (ar ? "الفرع الرئيسي" : "Main Branch");
    if (!branchMap[branch]) branchMap[branch] = [];
    branchMap[branch].push(w);
  });
  const branches = Object.entries(branchMap);
  const atLimit = branchLimit !== null && branches.length >= branchLimit;

  if (loading) return <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/settings`}>{ar ? "الإعدادات" : "Settings"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الفروع" : "Branches"}</span>
          </div>
          <h1 className="page-title">{ar ? "الفروع" : "Branches"}</h1>
          <p className="page-subtitle">
            {ar
              ? `${branches.length} فرع${branchLimit !== null ? ` من أصل ${branchLimit}` : ""}`
              : `${branches.length} branch${branches.length !== 1 ? "es" : ""}${branchLimit !== null ? ` of ${branchLimit}` : ""}`}
          </p>
        </div>
        <Link href={`/${locale}/inventory/warehouses`} className="btn btn-primary">
          {ar ? "إدارة المستودعات" : "Manage Warehouses"}
        </Link>
      </div>

      {/* تنبيه حد الباقة */}
      {atLimit && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#D97706", flexShrink: 0 }}><IcInfo /></span>
          <span style={{ fontWeight: 600, fontSize: 13, color: "#92400E", flex: 1 }}>
            {ar ? `وصلت للحد الأقصى (${branchLimit} فروع) في باقتك الحالية` : `You've reached the limit (${branchLimit} branches) in your current plan`}
          </span>
          <Link href={`/${locale}/settings/subscription`} className="btn btn-sm" style={{ background: "#D97706", color: "white" }}>
            {ar ? "ترقية الباقة" : "Upgrade Plan"}
          </Link>
        </div>
      )}

      {/* شريط الاستخدام */}
      {branchLimit !== null && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#2563EB" }}><IcBuilding /></span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{ar ? "استخدام الفروع" : "Branch Usage"}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: atLimit ? "#DC2626" : "var(--text-secondary)" }}>
                {branches.length} / {branchLimit}
              </span>
            </div>
            <div style={{ height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min((branches.length / branchLimit) * 100, 100)}%`,
                background: atLimit ? "#DC2626" : branches.length / branchLimit >= 0.8 ? "#D97706" : "#2563EB",
                borderRadius: 4,
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ملاحظة */}
      <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 8, fontSize: 13, color: "#1E40AF" }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}><IcInfo /></span>
        <span>
          {ar
            ? "الفروع تُدار عبر المستودعات — كل مستودع يمكن ربطه بفرع. لإضافة فرع جديد، أضف مستودعاً وحدد اسم الفرع."
            : "Branches are managed through warehouses — each warehouse can be linked to a branch. To add a new branch, add a warehouse and specify the branch name."}
        </span>
      </div>

      {/* قائمة الفروع */}
      {branches.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div style={{ color: "#2563EB", marginBottom: 12 }}><IcBuilding /></div>
            <div className="empty-state-title">{ar ? "لا توجد فروع بعد" : "No branches yet"}</div>
            <div className="empty-state-desc" style={{ marginBottom: 16 }}>
              {ar ? "أضف مستودعاً لإنشاء فرع" : "Add a warehouse to create a branch"}
            </div>
            <Link href={`/${locale}/inventory/warehouses`} className="btn btn-primary btn-sm">
              {ar ? "إضافة مستودع" : "Add Warehouse"}
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {branches.map(([branchName, branchWarehouses]) => (
            <div key={branchName} className="card">
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB" }}>
                    <IcBuilding />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{branchName}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {branchWarehouses.length} {ar ? "مستودع" : "warehouse(s)"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="card-body" style={{ padding: "12px 20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {branchWarehouses.map((w: any) => (
                    <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)" }}>
                      <span style={{ color: "#64748B" }}><IcWarehouse /></span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{w.name_ar}</div>
                        {w.name_en && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{w.name_en}</div>}
                      </div>
                      <span className={w.is_active ? "badge badge-success" : "badge badge-gray"}>
                        {w.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
                      </span>
                      {w.is_default && (
                        <span className="badge badge-info">{ar ? "افتراضي" : "Default"}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
