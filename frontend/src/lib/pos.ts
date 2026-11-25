import api from "./api";

// ─── Terminals ───────────────────────────────────────────────────────
export const getTerminals   = ()                       => api.get("/pos/terminals");
export const getMyTerminal  = ()                       => api.get("/pos/terminals/my");
export const getTerminalSerials = (terminalId: string, productId: string, includeMain = false) =>
  api.get(`/pos/terminals/${terminalId}/serials/${productId}`, { params: includeMain ? { include_main: true } : undefined });
export const createTerminal = (data: any)              => api.post("/pos/terminals", data);
export const updateTerminal = (id: string, data: any)  => api.patch(`/pos/terminals/${id}`, data);
export const deleteTerminal = (id: string)             => api.delete(`/pos/terminals/${id}`);

// ─── صيانة نقاط البيع (معزولة عن الفواتير) ─────────────────────────
export const getMaintenanceTickets = (params?: { status?: string; terminal_id?: string; session_id?: string }) =>
  api.get("/pos/maintenance", { params });
export const getMaintenanceManagementReport = (params?: { from_date?: string; to_date?: string; status?: string; terminal_id?: string }) =>
  api.get("/pos/maintenance/management-report", { params });
export const createMaintenanceTicket = (data: any) => api.post("/pos/maintenance", data);
export const updateMaintenanceTicket = (id: string, data: any) => api.patch(`/pos/maintenance/${id}`, data);
export const deleteMaintenanceTicket = (id: string) => api.delete(`/pos/maintenance/${id}`);
export const addMaintenancePart = (id: string, data: any) => api.post(`/pos/maintenance/${id}/parts`, data);
export const recordMaintenancePayment = (id: string, data: any) => api.post(`/pos/maintenance/${id}/payments`, data);
export const addMaintenanceService = (id: string, data: { service_name: string; amount: number }) => api.post(`/pos/maintenance/${id}/services`, data);
export const issueMaintenanceInvoice = (id: string) => api.post(`/pos/maintenance/${id}/invoice`);
export const getMaintenanceSerials = (ticketId: string, productId: string) =>
  api.get(`/pos/maintenance/${ticketId}/serials/${productId}`);
export const getTerminalMaintenanceSerials = (terminalId: string, productId: string) =>
  api.get("/pos/maintenance/serials", { params: { terminal_id: terminalId, product_id: productId } });
export const issueMaintenancePart = (ticketId: string, partId: string) =>
  api.post(`/pos/maintenance/${ticketId}/parts/${partId}/issue`);

// ─── Sessions ────────────────────────────────────────────────────────
export const getSessions = (params?: { terminal_id?: string; limit?: number; status?: string }) =>
  api.get("/pos/sessions", { params });
export const getActiveSession = (terminal_id: string) =>
  api.get("/pos/sessions/active", { params: { terminal_id } });
export const openSession = (data: any) => api.post("/pos/sessions/open", data);
export const closeSession = (session_id: string, data: any) =>
  api.post(`/pos/sessions/${session_id}/close`, data);
export const getSession = (session_id: string) =>
  api.get(`/pos/sessions/${session_id}`);
export const getSessionReport = (session_id: string) =>
  api.get(`/pos/sessions/${session_id}/report`);
export const getSessionTransactions = (session_id: string) =>
  api.get(`/pos/sessions/${session_id}/transactions`);
export const createCashOutflow = (session_id: string, data: any) =>
  api.post(`/pos/sessions/${session_id}/cash-outflows`, data);

// ─── Transactions ────────────────────────────────────────────────────
export const getMyTransactions = (limit = 100) =>
  api.get("/pos/transactions/my-history", { params: { limit } });
export const createTransaction = (data: any) => api.post("/pos/transactions", data);
export const getTransaction = (id: string) => api.get(`/pos/transactions/${id}`);
export const refundTransaction = (id: string) => api.post(`/pos/transactions/${id}/refund`);

// ─── Purchase ────────────────────────────────────────────────────────
export const posPurchase = (data: any) => api.post("/pos/purchase", data);

// ─── وحدة الصيانة الجديدة المستقلة ─────────────────────────────────
export const getMaintenanceCases = (params?: { status?: string }) => api.get("/maintenance-cases", { params });
export const createMaintenanceCase = (data: any) => api.post("/maintenance-cases", data);
export const getMaintenanceCase = (id: string) => api.get(`/maintenance-cases/${id}`);
export const changeMaintenanceCaseStatus = (id: string, data: { status: string; note?: string }) => api.post(`/maintenance-cases/${id}/status`, data);
