import api from "./api";

// Customers
export const getCustomers = (search?: string) => api.get("/sales/customers", { params: search ? { search } : {} });
export const getCustomer = (id: string) => api.get(`/sales/customers/${id}`);
export const getCustomerReceivableAccounts = () => api.get("/sales/customers/ar-accounts");
export const createCustomer = (data: any) => api.post("/sales/customers", data);
export const updateCustomer = (id: string, data: any) => api.patch(`/sales/customers/${id}`, data);
export const deleteCustomer = (id: string) => api.delete(`/sales/customers/${id}`);

// Invoices
export const getInvoices = (params?: any) => api.get("/sales/invoices", { params });
export const getInvoice = (id: string) => api.get(`/sales/invoices/${id}`);
export const createInvoice = (data: any) => api.post("/sales/invoices", data);
export const confirmInvoice = (id: string) => api.post(`/sales/invoices/${id}/confirm`);
export const cancelInvoice = (id: string) => api.post(`/sales/invoices/${id}/cancel`);
export const getSalesSummary = () => api.get("/sales/invoices/summary");
export const getPendingInvoices = (repId?: string) => api.get("/sales/invoices-pending", { params: repId ? { rep_id: repId } : {} });
export const submitInvoice = (id: string) => api.post(`/sales/invoices/${id}/submit`);
export const approveInvoice = (id: string) => api.post(`/sales/invoices/${id}/approve`);
export const rejectInvoice = (id: string, rejection_note: string) => api.post(`/sales/invoices/${id}/reject`, { rejection_note });
export const updateInvoice = (id: string, data: any) => api.patch(`/sales/invoices/${id}`, data);
export const deleteInvoiceDraft = (id: string) => api.delete(`/sales/invoices/${id}`);

// Payments
export const getPayments = (params?: string | { invoice_id?: string; rep_id?: string }) => {
  const query = typeof params === "string" ? { invoice_id: params } : (params || {});
  return api.get("/sales/payments", { params: query });
};
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
export const createRepCreditNote = (data: any) => api.post("/reps/me/credit-notes", data);
export const getRefundRequests = (creditNoteId: string) => api.get(`/sales/credit-notes/${creditNoteId}/refund-requests`);
export const createRefundRequest = (creditNoteId: string, data: { amount: number; reason?: string }) => api.post(`/sales/credit-notes/${creditNoteId}/refund-requests`, data);

// Sales Orders
export const getSalesOrders = (params?: any) => api.get("/sales/orders", { params });
export const getSalesOrder = (id: string) => api.get(`/sales/orders/${id}`);
export const confirmSalesOrder = (id: string) => api.post(`/sales/orders/${id}/confirm`);
export const cancelSalesOrder = (id: string) => api.post(`/sales/orders/${id}/cancel`);
export const convertOrderToInvoice = (id: string) => api.post(`/sales/orders/${id}/invoice`);

// Customer Statement
export const getCustomerStatement = (customerId: string, fromDate: string, toDate: string, accountId?: string) =>
  api.get(`/sales/customers/${customerId}/statement`, { params: { from_date: fromDate, to_date: toDate, ...(accountId ? { account_id: accountId } : {}) } });
