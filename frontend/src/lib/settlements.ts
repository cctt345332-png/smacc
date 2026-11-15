import api from "./api";
export const getSettlementSources = () => api.get("/settlements/sources");
export const getSettlements = () => api.get("/settlements");
export const createSettlement = (data: any) => api.post("/settlements", data);
