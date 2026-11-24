import api from "./api";

export const getVouchers = (params?: any) => api.get("/treasury/vouchers", { params });
export const getVoucher = (id: string) => api.get(`/treasury/vouchers/${id}`);
export const createVoucher = (data: any) => api.post("/treasury/vouchers", data);
export const createExpenseBatch = (data: any) => api.post("/treasury/vouchers/expense-batch", data);
export const postVoucher = (id: string) => api.post(`/treasury/vouchers/${id}/post`);
export const cancelVoucher = (id: string) => api.post(`/treasury/vouchers/${id}/cancel`);
export const getTreasurySummary = () => api.get("/treasury/vouchers/summary");
export const getTreasuries = (include_inactive = false) => api.get("/treasury/treasuries", { params: { include_inactive } });
export const createTreasury = (data: any) => api.post("/treasury/treasuries", data);
export const updateTreasury = (id: string, data: any) => api.patch(`/treasury/treasuries/${id}`, data);
export const getTreasuryMovements = (id: string) => api.get(`/treasury/treasuries/${id}/movements`);
