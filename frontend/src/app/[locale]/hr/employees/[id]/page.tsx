"use client";
import { useEffect, useState, use } from "react";
import { getEmployeeProfile } from "@/lib/hr";

export default function EmployeeProfile(props: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = use(props.params); const ar = locale === "ar";
  const [p, setP] = useState<any>(null);
  useEffect(() => { getEmployeeProfile(id).then(x => setP(x.data)).catch(() => {}); }, [id]);
  if (!p) return <div className="empty-state">جاري التحميل...</div>;
  const e = p.employee;
  const payroll = p.payroll || [];
  const advances = p.advances || [];
  const totalNet = payroll.reduce((s: number, x: any) => s + Number(x.net_salary || 0), 0);
  const totalPaid = payroll.reduce((s: number, x: any) => s + Number(x.paid_amount || 0), 0);
  const totalRemaining = payroll.reduce((s: number, x: any) => s + Math.max(0, Number(x.net_salary || 0) - Number(x.paid_amount || 0)), 0);
  return <div>
    <div className="page-header"><div><h1 className="page-title">كشف الموظف: {e.full_name_ar}</h1><p className="page-subtitle">{e.employee_number} — {e.job_title_ar}</p></div><div style={{ display: "flex", gap: 8 }}><a className="btn btn-primary" href={`/${locale}/hr/advances`}>تسجيل سلفة / سحبة</a><a className="btn btn-secondary" href={`/${locale}/hr/employees`}>رجوع</a></div></div>
    <div className="grid-4">
      <div className="stat-card"><div className="stat-label">الراتب الأساسي</div><div className="stat-value">{Number(e.basic_salary || 0).toLocaleString()} ر.س</div></div>
      <div className="stat-card"><div className="stat-label">إجمالي صافي الرواتب</div><div className="stat-value">{totalNet.toLocaleString()} ر.س</div></div>
      <div className="stat-card"><div className="stat-label">إجمالي المدفوع</div><div className="stat-value" style={{ color: "#15803D" }}>{totalPaid.toLocaleString()} ر.س</div></div>
      <div className="stat-card"><div className="stat-label">إجمالي المتبقي</div><div className="stat-value" style={{ color: "#B45309" }}>{totalRemaining.toLocaleString()} ر.س</div></div>
    </div>
    <div className="card" style={{ marginTop: 20 }}><div className="card-header"><b>البيانات والمرفقات</b></div><div className="card-body"><p>الهوية: {e.national_id || "—"}</p><p>الهاتف: {e.phone || "—"}</p><p>البريد: {e.email || "—"}</p><p>رصيد الإجازة: {e.leave_balance} يوم</p>{e.national_id_file_data && <a href={e.national_id_file_data} target="_blank">فتح مرفق الهوية: {e.national_id_file_name}</a>}</div></div>
    <div className="card" style={{ marginTop: 20 }}><div className="card-header"><b>كشف الرواتب والخصومات والسحبيات</b><span style={{ fontSize: 12, color: "var(--text-muted)" }}>المبلغ المتبقي = صافي الراتب − المدفوع</span></div><div className="table-wrapper"><table><thead><tr><th>الفترة</th><th>الإجمالي</th><th>خصم الغياب</th><th>خصومات أخرى</th><th>إجمالي الخصومات</th><th>الصافي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr></thead><tbody>{payroll.map((x: any) => { const remaining = Math.max(0, Number(x.net_salary || 0) - Number(x.paid_amount || 0)); return <tr key={x.id}><td>{x.month}/{x.year}</td><td>{Number(x.gross_salary || 0).toLocaleString()}</td><td>{Number(x.absence_deduction || 0).toLocaleString()}</td><td>{Number(x.other_deductions || 0).toLocaleString()}</td><td style={{ color: "#DC2626" }}>{Number(x.total_deductions || 0).toLocaleString()}</td><td>{Number(x.net_salary || 0).toLocaleString()}</td><td style={{ color: "#15803D" }}>{Number(x.paid_amount || 0).toLocaleString()}</td><td style={{ color: "#B45309" }}>{remaining.toLocaleString()}</td><td>{x.status === "paid" ? "مدفوع بالكامل" : x.status === "partial" ? "مدفوع جزئيًا" : x.status === "approved" ? "معتمد" : "مسودة"}</td></tr>; })}</tbody></table></div></div>
    <div className="card" style={{ marginTop: 20 }}><div className="card-header"><b>السلف والسحبيات</b><a className="btn btn-secondary" href={`/${locale}/hr/advances`}>إضافة سلفة / سحبة</a></div><div className="table-wrapper"><table><thead><tr><th>السبب</th><th>الإجمالي</th><th>المسدد من الأقساط</th><th>المتبقي</th><th>الحالة</th></tr></thead><tbody>{advances.map((x: any) => <tr key={x.id}><td>{x.reason || "سلفة موظف"}</td><td>{Number(x.total_amount || 0).toLocaleString()}</td><td>{Number(x.paid_amount || 0).toLocaleString()}</td><td>{Math.max(0, Number(x.total_amount || 0) - Number(x.paid_amount || 0)).toLocaleString()}</td><td>{x.status === "active" ? "معتمدة" : x.status === "completed" ? "مكتملة" : x.status === "rejected" ? "مرفوضة" : "بانتظار الاعتماد"}</td></tr>)}</tbody></table></div></div>
  </div>;
}
