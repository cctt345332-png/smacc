import api from "./api";

export const getCompany = () => api.get("/settings/company");
export const updateCompany = (data: any) => api.put("/settings/company", data);
export const uploadLogo = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/settings/company/logo", form, { headers: { "Content-Type": "multipart/form-data" } });
};
export const deleteLogo = () => api.delete("/settings/company/logo");

export const getSubscription = () => api.get("/settings/subscription");
