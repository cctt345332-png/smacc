import axios from "axios";
import { useSuperAdminStore } from "@/store/superAdminStore";

const adminApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
});

adminApi.interceptors.request.use((config) => {
  const token = useSuperAdminStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      useSuperAdminStore.getState().logout();
      const locale = window.location.pathname.split("/")[1] || "ar";
      window.location.href = `/${locale}/super-admin/login`;
    }
    return Promise.reject(error);
  }
);

export default adminApi;
