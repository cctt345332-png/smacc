import api from "./api";

export const getVouchers = (params?: any) => api.get("/treasury/vouchers", { params });
export const getVoucher = (id: string) => api.get(`/treasury/vouchers/${id}`);
export const createVoucher = (data: any) => api.post("/treasury/vouchers", data);
export const postVoucher = (id: string) => api.post(`/treasury/vouchers/${id}/post`);
export const cancelVoucher = (id: string) => api.post(`/treasury/vouchers/${id}/cancel`);
export const getTreasurySummary = () => api.get("/treasury/vouchers/summary");
