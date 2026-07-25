import api from "./api";

// Customers
export const getCustomers = (search?: string) => api.get("/sales/customers", { params: search ? { search } : {} });
export const getCustomer = (id: string) => api.get(`/sales/customers/${id}`);
export const createCustomer = (data: any) => api.post("/sales/customers", data);
export const updateCustomer = (id: string, data: any) => api.patch(`/sales/customers/${id}`, data);

// Invoices
export const getInvoices = (params?: any) => api.get("/sales/invoices", { params });
export const getInvoice = (id: string) => api.get(`/sales/invoices/${id}`);
export const createInvoice = (data: any) => api.post("/sales/invoices", data);
export const confirmInvoice = (id: string) => api.post(`/sales/invoices/${id}/confirm`);
export const cancelInvoice = (id: string) => api.post(`/sales/invoices/${id}/cancel`);
export const getSalesSummary = () => api.get("/sales/invoices/summary");

// Payments
export const getPayments = (invoice_id?: string) => api.get("/sales/payments", { params: invoice_id ? { invoice_id } : {} });
export const createPayment = (data: any) => api.post("/sales/payments", data);

// Quotations
export const getQuotations = () => api.get("/sales/quotations");
export const getQuotation = (id: string) => api.get(`/sales/quotations/${id}`);
export const createQuotation = (data: any) => api.post("/sales/quotations", data);
export const convertToInvoice = (id: string) => api.post(`/sales/quotations/${id}/convert-to-invoice`);

// Credit Notes
export const getCreditNotes = () => api.get("/sales/credit-notes");
export const getCreditNote = (id: string) => api.get(`/sales/credit-notes/${id}`);
export const createCreditNote = (data: any) => api.post("/sales/credit-notes", data);

// Sales Orders
export const getSalesOrders = (params?: any) => api.get("/sales/orders", { params });
export const getSalesOrder = (id: string) => api.get(`/sales/orders/${id}`);
export const confirmSalesOrder = (id: string) => api.post(`/sales/orders/${id}/confirm`);
export const cancelSalesOrder = (id: string) => api.post(`/sales/orders/${id}/cancel`);
export const convertOrderToInvoice = (id: string) => api.post(`/sales/orders/${id}/invoice`);

// Customer Statement
export const getCustomerStatement = (customerId: string, fromDate: string, toDate: string) =>
  api.get(`/sales/customers/${customerId}/statement`, { params: { from_date: fromDate, to_date: toDate } });
