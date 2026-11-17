import api from "./api";

export const getSettlementSources = (params?: any) => api.get("/settlements/sources", { params });
export const getSettlements = () => api.get("/settlements");
export const getSettlementReport = (params?: any) => api.get("/settlements/report", { params });
export const getSettlementBreakdown = (params?: any) => api.get("/settlements/source-breakdown", { params });
export const createSettlement = (data: any) => api.post("/settlements", data);
export const updateSettlement = (id: string, data: any) => api.patch(`/settlements/${id}`, data);
export const deleteSettlement = (id: string) => api.delete(`/settlements/${id}`);
