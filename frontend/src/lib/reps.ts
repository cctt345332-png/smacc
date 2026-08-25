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

export const getRepAttendance = (date?: string, repId?: string) => {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (repId) params.set("rep_id", repId);
  const query = params.toString();
  return api.get(`/reps/attendance${query ? `?${query}` : ""}`);
};

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

export const getMyAttendanceStatus = () => api.get("/reps/me/attendance/today");

export const checkInMyAttendance = () => api.post("/reps/me/attendance/check-in");

// ─── تتبع مواقع المناديب ──────────────────────────────────────────────

export const postMyLocation = (data: {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  battery_level?: number;
  is_moving?: boolean;
  recorded_at?: string;
}) => api.post("/reps/me/location", data);

export const getMyLatestLocation = () => api.get("/reps/me/location/latest");

export const getAllRepsLiveLocations = () => api.get("/reps/locations/live");

export const getRepLocationHistory = (repId: string, date?: string) =>
  api.get(`/reps/${repId}/locations${date ? `?date=${date}` : ""}`);

// ─── المشرفون ────────────────────────────────────────────────────────

export const getSupervisors = () => api.get("/supervisors");

export const createSupervisor = (data: {
  name: string; email: string; password: string; phone?: string;
}) => api.post("/supervisors", data);

export const assignRepsToSupervisor = (supervisorId: string, repIds: string[]) =>
  api.post(`/supervisors/${supervisorId}/assign-reps`, { rep_ids: repIds });

// ─── واجهة المشرف الحالي ─────────────────────────────────────────────

export const getSupervisorInvoices = () => api.get("/supervisors/me/invoices");
export const getSupervisorSummary  = () => api.get("/supervisors/me/summary");
export const getSupervisorReps     = () => api.get("/supervisors/me/reps");

// ─── الدخول كمندوب (impersonation) ───────────────────────────────
export const getRepImpersonationToken = (repId: string) =>
  api.post(`/reps/${repId}/impersonate-token`);
