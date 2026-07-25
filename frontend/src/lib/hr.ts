import api from "./api";

// ─── Summary ─────────────────────────────────────────────────────────
export const getHRSummary = () => api.get("/hr/summary");

// ─── Departments ─────────────────────────────────────────────────────
export const getDepartments = () => api.get("/hr/departments");
export const createDepartment = (data: any) => api.post("/hr/departments", data);
export const updateDepartment = (id: string, data: any) => api.patch(`/hr/departments/${id}`, data);

// ─── Employees ───────────────────────────────────────────────────────
export const getEmployees = (params?: { search?: string; department_id?: string; status?: string }) =>
  api.get("/hr/employees", { params });
export const getEmployee = (id: string) => api.get(`/hr/employees/${id}`);
export const createEmployee = (data: any) => api.post("/hr/employees", data);
export const updateEmployee = (id: string, data: any) => api.patch(`/hr/employees/${id}`, data);

// ─── Attendance ──────────────────────────────────────────────────────
export const getAttendance = (params?: { date_from?: string; date_to?: string; employee_id?: string }) =>
  api.get("/hr/attendance", { params });
export const recordAttendance = (data: any) => api.post("/hr/attendance", data);

// ─── Leaves ──────────────────────────────────────────────────────────
export const getLeaves = (params?: { status?: string; employee_id?: string }) =>
  api.get("/hr/leaves", { params });
export const createLeave = (data: any) => api.post("/hr/leaves", data);
export const approveLeave = (id: string) => api.post(`/hr/leaves/${id}/approve`);
export const rejectLeave = (id: string) => api.post(`/hr/leaves/${id}/reject`);

// ─── Payroll ─────────────────────────────────────────────────────────
export const getPayroll = (params?: { month?: number; year?: number }) =>
  api.get("/hr/payroll", { params });
export const generatePayroll = (month: number, year: number) =>
  api.post(`/hr/payroll/generate?month=${month}&year=${year}`);
export const confirmPayroll = (month: number, year: number) =>
  api.post(`/hr/payroll/confirm?month=${month}&year=${year}`);

// ─── GOSI ────────────────────────────────────────────────────────────
export const getGOSI = (month: number, year: number) =>
  api.get(`/hr/gosi?month=${month}&year=${year}`);
