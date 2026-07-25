import api from "./api";

// ─── إدارة المناديب (للمدير) ──────────────────────────────────────────

export const getReps = () => api.get("/reps");

export const createRep = (data: {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  zone?: string;
  notes?: string;
  id_number?: string;
  id_expiry?: string;
  license_expiry?: string;
  vehicle_plate?: string;
  vehicle_type?: string;
  vehicle_color?: string;
  target_monthly?: number;
  commission_pct?: number;
}) => api.post("/reps", data);

export const updateRep = (repId: string, data: object) =>
  api.patch(`/reps/${repId}`, data);

export const getRep = (repId: string) => api.get(`/reps/${repId}`);

export const getRepStock = (repId: string) => api.get(`/reps/${repId}/stock`);

export const getRepInvoices = (repId: string) =>
  api.get(`/reps/${repId}/invoices`);

export const getRepSummary = (repId: string) =>
  api.get(`/reps/${repId}/summary`);

export const getRepTransfers = (repId: string) =>
  api.get(`/reps/${repId}/transfers`);

export const getMyTransfers = () =>
  api.get("/reps/me/transfers");

export const allocateStockToRep = (
  repId: string,
  items: { item_id: string; quantity: number }[]
) => api.post(`/reps/${repId}/allocate`, { items });

// ─── واجهة المندوب الحالي ─────────────────────────────────────────────

export const getMyProfile = () => api.get("/reps/me/profile");

export const getMyStock = () => api.get("/reps/me/stock");

export const getMyInvoices = () => api.get("/reps/me/invoices");

export const getMyPayments = () => api.get("/reps/me/payments");

export const getMySummary = () => api.get("/reps/me/summary");
