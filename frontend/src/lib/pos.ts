import api from "./api";

// ─── Terminals ───────────────────────────────────────────────────────
export const getTerminals   = ()                       => api.get("/pos/terminals");
export const getMyTerminal  = ()                       => api.get("/pos/terminals/my");
export const createTerminal = (data: any)              => api.post("/pos/terminals", data);
export const updateTerminal = (id: string, data: any)  => api.patch(`/pos/terminals/${id}`, data);
export const deleteTerminal = (id: string)             => api.delete(`/pos/terminals/${id}`);

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

// ─── Transactions ────────────────────────────────────────────────────
export const createTransaction = (data: any) => api.post("/pos/transactions", data);
export const getTransaction = (id: string) => api.get(`/pos/transactions/${id}`);
export const refundTransaction = (id: string) => api.post(`/pos/transactions/${id}/refund`);

// ─── Purchase ────────────────────────────────────────────────────────
export const posPurchase = (data: any) => api.post("/pos/purchase", data);
