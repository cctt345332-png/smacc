import api from "./api";

export const getOrders = (status?: string) => api.get("/sales/orders", { params: status ? { status } : {} });
export const getOrder = (id: string) => api.get(`/sales/orders/${id}`);
export const createOrder = (data: any) => api.post("/sales/orders", data);
export const confirmOrder = (id: string) => api.post(`/sales/orders/${id}/confirm`);
export const cancelOrder = (id: string) => api.post(`/sales/orders/${id}/cancel`);
export const orderToInvoice = (id: string) => api.post(`/sales/orders/${id}/invoice`);
export const getCustomerStatement = (customerId: string, from_date: string, to_date: string) =>
  api.get(`/sales/customers/${customerId}/statement`, { params: { from_date, to_date } });
