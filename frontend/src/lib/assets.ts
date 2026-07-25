import api from "./api";

export const getAssetCategories = () => api.get("/assets/categories");
export const createAssetCategory = (data: any) => api.post("/assets/categories", data);

export const getAssets = (status?: string) => api.get("/assets", { params: status ? { status } : {} });
export const getAsset = (id: string) => api.get(`/assets/${id}`);
export const createAsset = (data: any) => api.post("/assets", data);
export const updateAsset = (id: string, data: any) => api.patch(`/assets/${id}`, data);
export const getAssetsSummary = () => api.get("/assets/summary");

export const getDepreciationSchedule = (id: string) => api.get(`/assets/${id}/depreciation-schedule`);
export const runDepreciation = (data: any) => api.post("/assets/depreciation/run", data);
export const disposeAsset = (id: string, data: any) => api.post(`/assets/${id}/dispose`, data);
