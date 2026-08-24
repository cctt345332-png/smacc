"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { getHRSummary, getEmployees } from "@/lib/hr";

const IcUsers    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcCalendar = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcClock    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcDollar   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const IcChevron  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const IcBuilding = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h6"/><path d="M3 15h6"/><path d="M15 9h3"/><path d="M15 15h3"/></svg>;
const IcShield   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;

export default function HRPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const { plan } = useAuthStore();
  const hasHR = plan === "professional" || plan === "enterprise";

  const [summary, setSummary]   = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!hasHR) { setLoading(false); return; }
    Promise.all([getHRSummary(), getEmployees()])
      .then(([s, e]) => {
        setSummary(s.data);
        setEmployees(e.data?.slice(0, 5) || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hasHR]);

  if (!hasHR) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center", padding: "0 24px" }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #FEF9C3, #FDE68A)", display: "flex", alignItems: "center", justifyContent: "center", color: "#D97706", marginBottom: 24 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{ar ? "وحدة الموارد البشرية غير متاحة" : "HR Module Unavailable"}</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 400, lineHeight: 1.7, marginBottom: 24 }}>
          {ar ? "هذه الوحدة متاحة في الباقة الاحترافية والمؤسسية فقط." : "This module is available in Professional and Enterprise plans only."}
        </p>
        <Link href={`/${locale}/settings/subscription`} className="btn btn-primary">{ar ? "ترقية الباقة" : "Upgrade Plan"}</Link>
      </div>
    );
  }

  if (loading) return <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;

  const quickLinks = [
    { href: `/${locale}/hr/employees`,   labelAr: "الموظفون",   labelEn: "Employees",   icon: <IcUsers />,    color: "#2563EB", bg: "#EFF6FF" },
    { href: `/${locale}/hr/departments`, labelAr: "الأقسام",    labelEn: "Departments", icon: <IcBuilding />, color: "#7C3AED", bg: "#F5F3FF" },
    { href: `/${locale}/hr/attendance`,  labelAr: "الحضور",     labelEn: "Attendance",  icon: <IcClock />,    color: "#059669", bg: "#ECFDF5" },
    { href: `/${locale}/hr/leaves`,      labelAr: "الإجازات",   labelEn: "Leaves",      icon: <IcCalendar />, color: "#D97706", bg: "#FFFBEB" },
    { href: `/${locale}/hr/payroll`,     labelAr: "الرواتب",    labelEn: "Payroll",     icon: <IcDollar />,   color: "#DC2626", bg: "#FEF2F2" },
    { href: `/${locale}/hr/gosi`,        labelAr: "GOSI",       labelEn: "GOSI",        icon: <IcShield />,   color: "#0891B2", bg: "#ECFEFF" },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "الموارد البشرية" : "Human Resources"}</h1>
          <p className="page-subtitle">{ar ? "إدارة الموظفين والرواتب والحضور والإجازات" : "Manage employees, payroll, attendance and leaves"}</p>
        </div>
        <Link href={`/${locale}/hr/employees`} className="btn btn-primary">
          <IcUsers />{ar ? "إدارة الموظفين" : "Manage Employees"}
        </Link>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#EFF6FF", color: "#2563EB" }}><IcUsers /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "إجمالي الموظفين" : "Total Employees"}</div>
            <div className="stat-value">{summary?.total_employees ?? 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#ECFDF5", color: "#059669" }}><IcCalendar /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "الحضور اليوم" : "Present Today"}</div>
            <div className="stat-value">{summary?.present_today ?? 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#FFFBEB", color: "#D97706" }}><IcClock /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "طلبات الإجازة المعلقة" : "Pending Leaves"}</div>
            <div className="stat-value">{summary?.pending_leaves ?? 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#FEF2F2", color: "#DC2626" }}><IcDollar /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "الموظفون النشطون" : "Active Employees"}</div>
            <div className="stat-value">{summary?.active_employees ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><span className="card-title">{ar ? "الوصول السريع" : "Quick Access"}</span></div>
        <div className="card-body">
          <div className="grid-3">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", textDecoration: "none", color: "var(--text-primary)", transition: "all 0.15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = link.color; (e.currentTarget as HTMLElement).style.background = link.bg; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: link.bg, display: "flex", alignItems: "center", justifyContent: "center", color: link.color, flexShrink: 0 }}>{link.icon}</div>
                <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{ar ? link.labelAr : link.labelEn}</span>
                <span style={{ color: "var(--text-muted)" }}><IcChevron /></span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "آخر الموظفين المضافين" : "Recently Added Employees"}</span>
          <Link href={`/${locale}/hr/employees`} className="btn btn-secondary btn-sm">{ar ? "عرض الكل" : "View All"}</Link>
        </div>
        {employees.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 20px" }}>
            <div className="empty-state-title">{ar ? "لا يوجد موظفون بعد" : "No employees yet"}</div>
            <div className="empty-state-desc" style={{ marginBottom: 16 }}>{ar ? "ابدأ بإضافة موظفيك" : "Start by adding your employees"}</div>
            <Link href={`/${locale}/hr/employees`} className="btn btn-primary btn-sm">{ar ? "إضافة موظف" : "Add Employee"}</Link>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الموظف" : "Employee"}</th>
                  <th>{ar ? "القسم" : "Department"}</th>
                  <th>{ar ? "المسمى الوظيفي" : "Job Title"}</th>
                  <th>{ar ? "تاريخ التعيين" : "Hire Date"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp: any) => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg, #2563EB, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                          {emp.full_name_ar?.charAt(0) || "?"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.full_name_ar}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{emp.employee_number}</div>
                        </div>
                      </div>
                    </td>
                    <td>{emp.department?.name_ar || "—"}</td>
                    <td>{emp.job_title_ar}</td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{emp.hire_date}</td>
                    <td><span className={emp.status === "active" ? "badge badge-success" : "badge badge-gray"}>{emp.status === "active" ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
