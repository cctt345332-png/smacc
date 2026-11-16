import api from "./api";

// ─── Summary ─────────────────────────────────────────────────────────
export const getHRSummary = () => api.get("/hr/summary");

// ─── Departments ─────────────────────────────────────────────────────
export const getDepartments = () => api.get("/hr/departments");
export const createDepartment = (data: any) => api.post("/hr/departments", data);
export const updateDepartment = (id: string, data: any) => api.patch(`/hr/departments/${id}`, data);

// ─── Employees ───────────────────────────────────────────────────────
export const getEmployees = (params?: { search?: string; department_id?: string; status?: string }) => api.get("/hr/employees", { params });
export const getEmployee = (id: string) => api.get(`/hr/employees/${id}`);
export const createEmployee = (data: any) => api.post("/hr/employees", data);
export const updateEmployee = (id: string, data: any) => api.patch(`/hr/employees/${id}`, data);
export const deleteEmployee = (id: string) => api.delete(`/hr/employees/${id}`);
export const getHRSettings = () => api.get("/hr/settings");
export const updateHRSettings = (data: any) => api.patch("/hr/settings", data);
export const getAdvances = (params?: any) => api.get("/hr/advances", { params });
export const createAdvance = (data: any) => api.post("/hr/advances", data);
export const approveAdvance = (id: string) => api.post(`/hr/advances/${id}/approve`);
export const rejectAdvance = (id: string) => api.post(`/hr/advances/${id}/reject`);
export const updateAdvance = (id: string, data: any) => api.patch(`/hr/advances/${id}`, data);
export const deleteAdvance = (id: string) => api.delete(`/hr/advances/${id}`);
export const getWithdrawals = (params?: any) => api.get("/hr/withdrawals", { params });
export const createWithdrawal = (data: any) => api.post("/hr/withdrawals", data);
export const approveWithdrawal = (id: string) => api.post(`/hr/withdrawals/${id}/approve`);
export const rejectWithdrawal = (id: string) => api.post(`/hr/withdrawals/${id}/reject`);
export const updateWithdrawal = (id: string, data: any) => api.patch(`/hr/withdrawals/${id}`, data);
export const deleteWithdrawal = (id: string) => api.delete(`/hr/withdrawals/${id}`);
export const getDeductions = (params?: any) => api.get("/hr/deductions", { params });
export const createDeduction = (data: any) => api.post("/hr/deductions", data);
export const updateDeduction = (id: string, data: any) => api.patch(`/hr/deductions/${id}`, data);
export const deleteDeduction = (id: string) => api.delete(`/hr/deductions/${id}`);
export const getDeductionReport = (month: number, year: number, employee_id?: string) => api.get("/hr/deductions/report", { params: { month, year, employee_id } });
export const approveDeduction = (id: string) => api.post(`/hr/deductions/${id}/approve`);
export const rejectDeduction = (id: string) => api.post(`/hr/deductions/${id}/reject`);
export const getSalarySettlements = (month: number, year: number, employee_id?: string) => api.get("/hr/salary-settlements", { params: { month, year, employee_id } });
export const getSalarySettlementReport = (month: number, year: number, employee_id?: string) => api.get("/hr/salary-settlements/report", { params: { month, year, employee_id } });
export const createSalarySettlement = (data: any) => api.post("/hr/salary-settlements", data);
export const recordSalarySettlementPayment = (id: string, data: any) => api.post(`/hr/salary-settlements/${id}/payments`, data);
export const deleteSalarySettlementPayment = (id: string) => api.delete(`/hr/salary-settlement-payments/${id}`);

// ─── Attendance ──────────────────────────────────────────────────────
export const getAttendance = (params?: { date_from?: string; date_to?: string; employee_id?: string }) => api.get("/hr/attendance", { params });
export const recordAttendance = (data: any) => api.post("/hr/attendance", data);

// ─── Biometric devices ───────────────────────────────────────────────
export const getBiometricDevices = () => api.get("/hr/biometric/devices");
export const createBiometricDevice = (data: any) => api.post("/hr/biometric/devices", data);
export const updateBiometricDevice = (id: string, data: any) => api.patch(`/hr/biometric/devices/${id}`, data);
export const deleteBiometricDevice = (id: string) => api.delete(`/hr/biometric/devices/${id}`);
export const getBiometricLinks = (params?: any) => api.get("/hr/biometric/links", { params });
export const saveBiometricLink = (data: any) => api.post("/hr/biometric/links", data);
export const deleteBiometricLink = (id: string) => api.delete(`/hr/biometric/links/${id}`);
export const processBiometricLogs = () => api.post("/hr/biometric/process");

// ─── Leaves ──────────────────────────────────────────────────────────
export const getLeaves = (params?: any) => api.get("/hr/leaves", { params });
export const createLeave = (data: any) => api.post("/hr/leaves", data);
export const approveLeave = (id: string) => api.post(`/hr/leaves/${id}/approve`);
export const rejectLeave = (id: string) => api.post(`/hr/leaves/${id}/reject`);

// ─── Payroll ──────────────────────────────────────────────────────────
export const getPayroll = (params?: any) => api.get("/hr/payroll", { params });
export const generatePayroll = (month: number, year: number) => api.post(`/hr/payroll/generate?month=${month}&year=${year}`);
export const confirmPayroll = (month: number, year: number) => api.post(`/hr/payroll/confirm?month=${month}&year=${year}`);
export const deletePayroll = (month: number, year: number) => api.delete(`/hr/payroll?month=${month}&year=${year}`);
export const payPayroll = (month: number, year: number, data: any) => api.post(`/hr/payroll/pay?month=${month}&year=${year}`, data);
export const updatePayrollRecord = (id: string, data: any) => api.patch(`/hr/payroll/${id}`, data);
export const getGOSI = (month: number, year: number) => api.get(`/hr/gosi?month=${month}&year=${year}`);
export const getEmployeeExpenses = (params?: any) => api.get("/hr/expenses", { params });
export const createEmployeeExpense = (data: any) => api.post("/hr/expenses", data);
export const approveEmployeeExpense = (id: string) => api.post(`/hr/expenses/${id}/approve`);
export const rejectEmployeeExpense = (id: string) => api.post(`/hr/expenses/${id}/reject`);
export const getEmployeeProfile = (id: string) => api.get(`/hr/employees/${id}/profile`);
export const getHRFinancialReport = (month: number, year: number) => api.get(`/hr/reports/financial?month=${month}&year=${year}`);
export const getEmployeeStatements = (params?: any) => api.get(`/hr/reports/statements`, { params });
