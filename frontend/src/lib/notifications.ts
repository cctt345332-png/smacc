import api from "./api";

export const getNotifications = (unread_only = false) =>
  api.get("/notifications", { params: unread_only ? { unread_only: true } : {} });
export const getUnreadCount = () => api.get("/notifications/count");
export const markRead = (id: string) => api.post(`/notifications/${id}/read`);
export const markAllRead = () => api.post("/notifications/read-all");
export const getAlertSettings = () => api.get("/notifications/alert-settings");
export const updateAlertSettings = (data: any) => api.put("/notifications/alert-settings", data);
export const runAssetAlerts = () => api.post("/notifications/run-asset-alerts");
export const runAllAlerts = () => api.post("/notifications/run-all-alerts");
export const getNotificationRecipients = () => api.get("/notifications/admin/recipients");
export const getManualNotificationHistory = () => api.get("/notifications/admin/history");
export const sendManualNotification = (data: any) => api.post("/notifications/admin/send", data);
