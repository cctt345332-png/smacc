import api from "./api";

export const getVehicleList = () => api.get("/vehicle-maintenance/vehicles");
export const createVehicle = (data: object) => api.post("/vehicle-maintenance/vehicles", data);
export const updateVehicle = (id: string, data: object) => api.patch(`/vehicle-maintenance/vehicles/${id}`, data);
export const getMyVehicle = () => api.get("/vehicle-maintenance/me");
export const updateMyOdometer = (odometer: number) => api.patch("/vehicle-maintenance/me/odometer", { odometer });
export const addMyOilChange = (data: object) => api.post("/vehicle-maintenance/me/maintenance", data);
export const getVehicleMaintenance = (id: string) => api.get(`/vehicle-maintenance/vehicles/${id}/maintenance`);
export const getMaintenanceRequests = () => api.get('/vehicle-maintenance/maintenance/requests');
export const approveMaintenance = (id: string) => api.post(`/vehicle-maintenance/maintenance/${id}/approve`);
export const rejectMaintenance = (id: string, rejection_reason: string) => api.post(`/vehicle-maintenance/maintenance/${id}/reject`, { rejection_reason });
