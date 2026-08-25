"use client";;
import { use } from "react";
import Link from "next/link";

// ─── أيقونات ─────────────────────────────────────────────────────────
const IcCheck = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcX     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

// ─── تعريف الأدوار ────────────────────────────────────────────────────
const ROLES = [
  {
    key: "admin",
    ar: "مدير عام",
    en: "Admin",
    color: "#DC2626",
    bg: "#FEF2F2",
    desc_ar: "مالك الشركة — وصول كامل لكل شيء بدون قيود",
    desc_en: "Company owner — full access to everything without restrictions",
  },
  {
    key: "manager",
    ar: "مدير",
    en: "Manager",
    color: "#75617F",
    bg: "#F5F3FF",
    desc_ar: "مدير تشغيلي — كل الوحدات بدون حذف السجلات",
    desc_en: "Operations manager — all modules without deleting records",
  },
  {
    key: "accountant",
    ar: "محاسب",
    en: "Accountant",
    color: "#5A187E",
    bg: "#EFF6FF",
    desc_ar: "محاسب — محاسبة، مبيعات، مشتريات، خزينة، تقارير",
    desc_en: "Accountant — accounting, sales, purchases, treasury, reports",
  },
  {
    key: "sales",
    ar: "مبيعات",
    en: "Sales",
    color: "#059669",
    bg: "#ECFDF5",
    desc_ar: "موظف مبيعات — مبيعات وعملاء وقراءة المخزون",
    desc_en: "Sales staff — sales, customers, inventory (read)",
  },
  {
    key: "purchaser",
    ar: "مشتريات",
    en: "Purchaser",
    color: "#D97706",
    bg: "#FFFBEB",
    desc_ar: "موظف مشتريات — مشتريات وموردين وقراءة المخزون",
    desc_en: "Purchasing staff — purchases, vendors, inventory (read)",
  },
  {
    key: "cashier",
    ar: "كاشير",
    en: "Cashier",
    color: "#0891B2",
    bg: "#ECFEFF",
    desc_ar: "كاشير — نقطة البيع فقط",
    desc_en: "Cashier — POS only",
  },
  {
    key: "warehouse",
    ar: "مستودع",
    en: "Warehouse",
    color: "#64748B",
    bg: "#F1F5F9",
    desc_ar: "أمين مستودع — إدارة المخزون والمستودعات",
    desc_en: "Warehouse keeper — inventory and warehouse management",
  },
  {
    key: "hr",
    ar: "موارد بشرية",
    en: "HR",
    color: "#EC4899",
    bg: "#FDF2F8",
    desc_ar: "موظف HR — الموارد البشرية والرواتب والإجازات",
    desc_en: "HR staff — human resources, payroll, leaves",
  },
  {
    key: "viewer",
    ar: "مشاهد",
    en: "Viewer",
    color: "#94A3B8",
    bg: "#F8FAFC",
    desc_ar: "مشاهد — قراءة فقط لكل الوحدات بدون تعديل",
    desc_en: "Viewer — read-only access to all modules",
  },
];

// ─── مصفوفة الصلاحيات ────────────────────────────────────────────────
// true = كامل، "r" = قراءة فقط، false = لا يوجد
type Perm = true | "r" | false;

interface ModulePerms {
  module_ar: string;
  module_en: string;
  admin: Perm; manager: Perm; accountant: Perm; sales: Perm;
  purchaser: Perm; cashier: Perm; warehouse: Perm; hr: Perm; viewer: Perm;
}

const PERMISSIONS: ModulePerms[] = [
  { module_ar: "المحاسبة",        module_en: "Accounting",    admin: true, manager: true, accountant: true, sales: false,  purchaser: false, cashier: false, warehouse: false, hr: false, viewer: "r" },
  { module_ar: "المبيعات",        module_en: "Sales",         admin: true, manager: true, accountant: "r",  sales: true,   purchaser: false, cashier: false, warehouse: false, hr: false, viewer: "r" },
  { module_ar: "المشتريات",       module_en: "Purchases",     admin: true, manager: true, accountant: "r",  sales: false,  purchaser: true,  cashier: false, warehouse: false, hr: false, viewer: "r" },
  { module_ar: "المخزون",         module_en: "Inventory",     admin: true, manager: true, accountant: "r",  sales: "r",    purchaser: "r",   cashier: "r",   warehouse: true,  hr: false, viewer: "r" },
  { module_ar: "نقطة البيع",      module_en: "POS",           admin: true, manager: true, accountant: false, sales: false, purchaser: false, cashier: true,  warehouse: false, hr: false, viewer: "r" },
  { module_ar: "الخزينة",         module_en: "Treasury",      admin: true, manager: true, accountant: true, sales: false,  purchaser: false, cashier: false, warehouse: false, hr: false, viewer: "r" },
  { module_ar: "الأصول الثابتة", module_en: "Fixed Assets",  admin: true, manager: true, accountant: true, sales: false,  purchaser: false, cashier: false, warehouse: false, hr: false, viewer: "r" },
  { module_ar: "الموارد البشرية", module_en: "HR",            admin: true, manager: true, accountant: "r",  sales: false,  purchaser: false, cashier: false, warehouse: false, hr: true,  viewer: "r" },
  { module_ar: "التقارير",        module_en: "Reports",       admin: true, manager: true, accountant: true, sales: "r",    purchaser: "r",   cashier: false, warehouse: "r",   hr: "r",   viewer: "r" },
  { module_ar: "الإعدادات",       module_en: "Settings",      admin: true, manager: "r",  accountant: false, sales: false, purchaser: false, cashier: false, warehouse: false, hr: false, viewer: false },
];

const roleKeys = ["admin","manager","accountant","sales","purchaser","cashier","warehouse","hr","viewer"] as const;

function PermCell({ perm }: { perm: Perm }) {
  if (perm === true)  return <div style={{ display: "flex", justifyContent: "center" }}><span style={{ color: "#059669" }}><IcCheck /></span></div>;
  if (perm === "r")   return <div style={{ display: "flex", justifyContent: "center" }}><span style={{ fontSize: 10, fontWeight: 700, color: "#5A187E", background: "#EFF6FF", padding: "1px 6px", borderRadius: 4 }}>R</span></div>;
  return <div style={{ display: "flex", justifyContent: "center" }}><span style={{ color: "#CBD5E1" }}><IcX /></span></div>;
}

export default function RolesPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/settings`}>{ar ? "الإعدادات" : "Settings"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الأدوار والصلاحيات" : "Roles & Permissions"}</span>
          </div>
          <h1 className="page-title">{ar ? "الأدوار والصلاحيات" : "Roles & Permissions"}</h1>
          <p className="page-subtitle">{ar ? "الأدوار ثابتة في النظام — عيّن الدور المناسب لكل مستخدم" : "Roles are fixed in the system — assign the right role to each user"}</p>
        </div>
        <Link href={`/${locale}/settings/users`} className="btn btn-primary">
          {ar ? "إدارة المستخدمين" : "Manage Users"}
        </Link>
      </div>

      {/* بطاقات الأدوار */}
      <div className="grid-3" style={{ marginBottom: 28 }}>
        {ROLES.map(role => (
          <div key={role.key} style={{ padding: "16px 18px", borderRadius: 12, border: `1px solid ${role.color}30`, background: role.bg }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: role.color, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                {(ar ? role.ar : role.en).charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: role.color }}>{ar ? role.ar : role.en}</div>
                <div style={{ fontSize: 10, color: "#64748B", fontFamily: "monospace" }}>{role.key}</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, margin: 0 }}>
              {ar ? role.desc_ar : role.desc_en}
            </p>
          </div>
        ))}
      </div>

      {/* مصفوفة الصلاحيات */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "مصفوفة الصلاحيات" : "Permissions Matrix"}</span>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-secondary)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: "#059669" }}><IcCheck /></span>{ar ? "كامل" : "Full"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 10, fontWeight: 700, color: "#5A187E", background: "#EFF6FF", padding: "1px 6px", borderRadius: 4 }}>R</span>{ar ? "قراءة" : "Read"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: "#CBD5E1" }}><IcX /></span>{ar ? "لا يوجد" : "None"}</span>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                <th style={{ padding: "10px 16px", textAlign: ar ? "right" : "left", fontWeight: 700, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", minWidth: 140 }}>
                  {ar ? "الوحدة" : "Module"}
                </th>
                {roleKeys.map(rk => {
                  const r = ROLES.find(x => x.key === rk)!;
                  return (
                    <th key={rk} style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, color: r.color, borderBottom: "1px solid var(--border)", minWidth: 80 }}>
                      {ar ? r.ar : r.en}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "white" : "#FAFBFC" }}>
                  <td style={{ padding: "10px 16px", fontWeight: 600, color: "var(--text-primary)" }}>
                    {ar ? row.module_ar : row.module_en}
                  </td>
                  {roleKeys.map(rk => (
                    <td key={rk} style={{ padding: "10px 12px" }}>
                      <PermCell perm={row[rk]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ملاحظة */}
      <div style={{ marginTop: 16, padding: "12px 16px", background: "#F8FAFC", borderRadius: 10, border: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--text-primary)" }}>{ar ? "ملاحظة: " : "Note: "}</strong>
        {ar
          ? "الأدوار ثابتة في النظام ولا يمكن تعديلها. لتغيير صلاحيات مستخدم، غيّر دوره من صفحة إدارة المستخدمين."
          : "Roles are fixed in the system and cannot be modified. To change a user's permissions, change their role from the Users management page."}
      </div>
    </div>
  );
}
