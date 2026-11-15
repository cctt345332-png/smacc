import api from "./api";
export const getSettlementSources = (params?: any) => api.get("/settlements/sources", { params });
export const getSettlements = () => api.get("/settlements");
export const createSettlement = (data: any) => api.post("/settlements", data);
