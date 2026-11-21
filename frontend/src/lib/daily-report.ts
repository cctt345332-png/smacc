import api from "./api";

export const getDailyReport = (params: {
  date_from?: string;
  date_to?: string;
  warehouse_id?: string;
  terminal_id?: string;
  rep_id?: string;
}) => api.get("/reports/daily", { params });
