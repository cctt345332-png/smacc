import api from "./api";

export const getExpenses = (params?: Record<string, any>) => api.get("/expenses", { params });
export const getExpense = (id: string) => api.get(`/expenses/${id}`);
export const approveExpense = (id: string) => api.post(`/expenses/${id}/approve`);
export const rejectExpense = (id: string, reason: string) => api.post(`/expenses/${id}/reject`, { reason });
export const createExpense = (data: any, config?: any) => api.post("/expenses", data, config);
