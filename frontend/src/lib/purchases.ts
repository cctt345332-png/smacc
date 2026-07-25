import api from "./api";

// Vendors
export const getVendors = (search?: string) => api.get("/purchases/vendors", { params: search ? { search } : {} });
export const getVendor = (id: string) => api.get(`/purchases/vendors/${id}`);
export const createVendor = (data: any) => api.post("/purchases/vendors", data);
export const updateVendor = (id: string, data: any) => api.patch(`/purchases/vendors/${id}`, data);

// Purchase Orders
export const getPurchaseOrders = (params?: any) => api.get("/purchases/orders", { params });
export const getPurchaseOrder = (id: string) => api.get(`/purchases/orders/${id}`);
export const createPurchaseOrder = (data: any) => api.post("/purchases/orders", data);
export const confirmPurchaseOrder = (id: string) => api.post(`/purchases/orders/${id}/confirm`);
export const cancelPurchaseOrder = (id: string) => api.post(`/purchases/orders/${id}/cancel`);
export const convertOrderToBill = (id: string) => api.post(`/purchases/orders/${id}/bill`);

// Bills
export const getBills = (params?: any) => api.get("/purchases/bills", { params });
export const getBill = (id: string) => api.get(`/purchases/bills/${id}`);
export const createBill = (data: any) => api.post("/purchases/bills", data);
export const confirmBill = (id: string) => api.post(`/purchases/bills/${id}/confirm`);
export const cancelBill = (id: string) => api.post(`/purchases/bills/${id}/cancel`);
export const getBillPayments = (id: string) => api.get(`/purchases/bills/${id}/payments`);
export const createBillPayment = (id: string, data: any) => api.post(`/purchases/bills/${id}/payments`, data);
export const getPurchasesSummary = () => api.get("/purchases/bills/summary");
export const getBillSerials = (id: string, productId?: string) =>
  api.get(`/purchases/bills/${id}/serials`, { params: productId ? { product_id: productId } : {} });

// Debit Notes
export const getDebitNotes = () => api.get("/purchases/debit-notes");
export const getDebitNote = (id: string) => api.get(`/purchases/debit-notes/${id}`);
export const createDebitNote = (data: any) => api.post("/purchases/debit-notes", data);

// Vendor Statement
export const getVendorStatement = (vendorId: string, fromDate: string, toDate: string) =>
  api.get(`/purchases/vendors/${vendorId}/statement`, { params: { from_date: fromDate, to_date: toDate } });
