"use client";
import { useEffect, useState, use } from "react";
import { getEmployees, getDepartments, createEmployee } from "@/lib/hr";

const IcPlus   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcSearch = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcEye    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcClose  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

export default function EmployeesPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [employees, setEmployees]   = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  const [form, setForm] = useState({
    full_name_ar: "", full_name_en: "", national_id: "", gender: "male",
    phone: "", email: "", job_title_ar: "", job_title_en: "",
    department_id: "", contract_type: "full_time", hire_date: "",
    basic_salary: "", housing_allowance: "", transport_allowance: "",
  });
  const upd = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const load = async () => {
    try {
      const [emp, dept] = await Promise.all([
        getEmployees({ search: search || undefined, department_id: deptFilter || undefined, status: statusFilter || undefined }),
        getDepartments(),
      ]);
      setEmployees(emp.data || []);
      setDepartments(dept.data || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = () => { setLoading(true); load(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await createEmployee({
        ...form,
        basic_salary: parseFloat(form.basic_salary) || 0,
        housing_allowance: parseFloat(form.housing_allowance) || 0,
        transport_allowance: parseFloat(form.transport_allowance) || 0,
      });
      setShowModal(false);
      setLoading(true);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || (ar ? "حدث خطأ" : "An error occurred"));
    } finally { setSaving(false); }
  };

  if (loading) return <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "الموظفون" : "Employees"}</h1>
          <p className="page-subtitle">{ar ? `${employees.length} موظف` : `${employees.length} employees`}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ full_name_ar: "", full_name_en: "", national_id: "", gender: "male", phone: "", email: "", job_title_ar: "", job_title_en: "", department_id: "", contract_type: "full_time", hire_date: new Date().toISOString().split("T")[0], basic_salary: "", housing_allowance: "", transport_allowance: "" }); setError(""); setShowModal(true); }}>
          <IcPlus />{ar ? "إضافة موظف" : "Add Employee"}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: "14px 20px" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 220px" }}>
              <span style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", insetInlineStart: 10, color: "var(--text-muted)", pointerEvents: "none" }}><IcSearch /></span>
              <input className="form-input" style={{ paddingInlineStart: 34 }} placeholder={ar ? "بحث بالاسم أو الرقم الوظيفي..." : "Search by name or ID..."} value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} />
            </div>
            <select className="form-input form-select" style={{ flex: "0 1 180px" }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="">{ar ? "كل الأقسام" : "All Departments"}</option>
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
            </select>
            <select className="form-input form-select" style={{ flex: "0 1 160px" }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">{ar ? "كل الحالات" : "All Status"}</option>
              <option value="active">{ar ? "نشط" : "Active"}</option>
              <option value="inactive">{ar ? "موقوف" : "Inactive"}</option>
            </select>
            <button className="btn btn-secondary btn-sm" onClick={handleSearch}>{ar ? "بحث" : "Search"}</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{ar ? "الموظف" : "Employee"}</th>
                <th>{ar ? "الرقم الوظيفي" : "ID"}</th>
                <th>{ar ? "القسم" : "Department"}</th>
                <th>{ar ? "المسمى الوظيفي" : "Job Title"}</th>
                <th>{ar ? "الراتب الأساسي" : "Basic Salary"}</th>
                <th>{ar ? "تاريخ التعيين" : "Hire Date"}</th>
                <th>{ar ? "الحالة" : "Status"}</th>
                <th>{ar ? "إجراء" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>{ar ? "لا يوجد موظفون" : "No employees found"}</td></tr>
              ) : employees.map((emp: any) => (
                <tr key={emp.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg, #485668, #65707E)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                        {emp.full_name_ar?.charAt(0) || "?"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{emp.full_name_ar}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{emp.phone || emp.email || ""}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{emp.employee_number}</td>
                  <td>{emp.department?.name_ar || "—"}</td>
                  <td>{emp.job_title_ar}</td>
                  <td><span style={{ fontWeight: 600 }}>{Number(emp.basic_salary || 0).toLocaleString()}</span> <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "ر.س" : "SAR"}</span></td>
                  <td style={{ fontSize: 12 }}>{emp.hire_date}</td>
                  <td><span className={emp.status === "active" ? "badge badge-success" : "badge badge-gray"}>{emp.status === "active" ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}</span></td>
                  <td><button className="btn btn-secondary btn-sm" style={{ gap: 4 }}><IcEye />{ar ? "عرض" : "View"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}>
          <div className="card" style={{ width: "100%", maxWidth: 600, borderRadius: 16, margin: "auto" }}>
            <div className="card-header">
              <span className="card-title">{ar ? "إضافة موظف جديد" : "Add New Employee"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><IcClose /></button>
            </div>
            <div className="card-body">
              {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">{ar ? "الاسم بالعربي" : "Arabic Name"} <span className="required">*</span></label>
                    <input className="form-input" value={form.full_name_ar} onChange={e => upd("full_name_ar", e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "الاسم بالإنجليزي" : "English Name"}</label>
                    <input className="form-input" value={form.full_name_en} onChange={e => upd("full_name_en", e.target.value)} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">{ar ? "رقم الهوية" : "National ID"}</label>
                    <input className="form-input" value={form.national_id} onChange={e => upd("national_id", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "الجنس" : "Gender"}</label>
                    <select className="form-input form-select" value={form.gender} onChange={e => upd("gender", e.target.value)}>
                      <option value="male">{ar ? "ذكر" : "Male"}</option>
                      <option value="female">{ar ? "أنثى" : "Female"}</option>
                    </select>
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">{ar ? "الجوال" : "Phone"}</label>
                    <input className="form-input" value={form.phone} onChange={e => upd("phone", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "البريد الإلكتروني" : "Email"}</label>
                    <input type="email" className="form-input" value={form.email} onChange={e => upd("email", e.target.value)} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">{ar ? "المسمى الوظيفي" : "Job Title"} <span className="required">*</span></label>
                    <input className="form-input" value={form.job_title_ar} onChange={e => upd("job_title_ar", e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "القسم" : "Department"}</label>
                    <select className="form-input form-select" value={form.department_id} onChange={e => upd("department_id", e.target.value)}>
                      <option value="">{ar ? "بدون قسم" : "No Department"}</option>
                      {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">{ar ? "نوع العقد" : "Contract Type"}</label>
                    <select className="form-input form-select" value={form.contract_type} onChange={e => upd("contract_type", e.target.value)}>
                      <option value="full_time">{ar ? "دوام كامل" : "Full Time"}</option>
                      <option value="part_time">{ar ? "دوام جزئي" : "Part Time"}</option>
                      <option value="contract">{ar ? "عقد" : "Contract"}</option>
                      <option value="temporary">{ar ? "مؤقت" : "Temporary"}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "تاريخ التعيين" : "Hire Date"} <span className="required">*</span></label>
                    <input type="date" className="form-input" value={form.hire_date} onChange={e => upd("hire_date", e.target.value)} required />
                  </div>
                </div>
                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">{ar ? "الراتب الأساسي" : "Basic Salary"} <span className="required">*</span></label>
                    <input type="number" className="form-input" value={form.basic_salary} onChange={e => upd("basic_salary", e.target.value)} required min="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "بدل السكن" : "Housing"}</label>
                    <input type="number" className="form-input" value={form.housing_allowance} onChange={e => upd("housing_allowance", e.target.value)} min="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "بدل النقل" : "Transport"}</label>
                    <input type="number" className="form-input" value={form.transport_allowance} onChange={e => upd("transport_allowance", e.target.value)} min="0" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
