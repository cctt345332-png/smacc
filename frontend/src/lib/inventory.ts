import api from "./api";

// Warehouses
export const getWarehouses = () => api.get("/inventory/warehouses");
export const createWarehouse = (data: any) => api.post("/inventory/warehouses", data);

// Categories
export const getCategories = () => api.get("/inventory/categories");
export const createCategory = (data: any) => api.post("/inventory/categories", data);

// Items
export const getItems = (params?: any) => api.get("/inventory/items", { params });
export const getItem = (id: string) => api.get(`/inventory/items/${id}`);
export const createItem = (data: any) => api.post("/inventory/items", data);
export const updateItem = (id: string, data: any) => api.patch(`/inventory/items/${id}`, data);
export const deleteItem = (id: string) => api.delete(`/inventory/items/${id}`);
export const getStockSummary = () => api.get("/inventory/items/summary");

// Serial Items
export const getSerials = (productId: string, status?: string, warehouseId?: string) =>
  api.get(`/inventory/items/${productId}/serials`, { params: { ...(status ? { status } : {}), ...(warehouseId ? { warehouse_id: warehouseId } : {}) } });
export const addSerial = (productId: string, data: any) =>
  api.post(`/inventory/items/${productId}/serials`, data);
export const sellSerial = (serialId: string, data: any) =>
  api.post(`/inventory/serials/${serialId}/sell`, data);

// Stock Movements
export const addStock = (productId: string, data: any) =>
  api.post(`/inventory/items/${productId}/add-stock`, data);
export const deductStock = (productId: string, data: any) =>
  api.post(`/inventory/items/${productId}/deduct-stock`, data);

// Reports
export const getSerialProfitReport = (params?: any) =>
  api.get("/inventory/reports/serial-profit", { params });
export const getSerialMovementsReport = (params?: any) =>
  api.get("/inventory/reports/serial-movements", { params });

// Stock Value Report
export const getStockValueReport = () => api.get("/inventory/reports/stock-value");

// Bulk Serial Add
export const addSerialsBulk = (productId: string, data: any) =>
  api.post(`/inventory/items/${productId}/serials/bulk`, data);

// Search by serial number
export const searchSerial = (q: string) =>
  api.get("/inventory/serials/search", { params: { q } });

// Serial CRUD
export const updateSerial = (serialId: string, data: any) =>
  api.patch(`/inventory/serials/${serialId}`, data);
export const deleteSerial = (serialId: string) =>
  api.delete(`/inventory/serials/${serialId}`);
export const updateSerialsBulk = (serialIds: string[], changes: any) =>
  api.post("/inventory/serials/bulk-update", { serial_ids: serialIds, changes });
export const deleteSerialsBulk = (serialIds: string[]) =>
  api.post("/inventory/serials/bulk-delete", { serial_ids: serialIds });



// Stock by Warehouse
export const getStockByWarehouse = (warehouseId?: string) =>
  api.get("/inventory/stock", { params: warehouseId ? { warehouse_id: warehouseId } : {} });
export const getItemStockLevels = (itemId: string) =>
  api.get(`/inventory/items/${itemId}/stock-levels`);
export const transferStock = (data: any) =>
  api.post("/inventory/stock/transfer", data);

// نقل أكثر من صنف في عملية واحدة
export const transferStockBulk = (data: {
  from_warehouse_id: string;
  to_warehouse_id: string;
  items: Array<
    | { item_id: string; quantity: number }           // صنف عادي
    | { item_id: string; serial_ids: string[] }       // صنف سيريال
  >;
  notes?: string;
}) => api.post("/inventory/stock/transfer-bulk", data);

export const transferSerials = (data: {
  serial_ids: string[];
  to_warehouse_id: string;
  notes?: string;
}) => api.post("/inventory/stock/transfer-serials", data);

export const validateSerials = (data: {
  serial_numbers: string[];
  warehouse_id: string;
}) => api.post("/inventory/stock/validate-serials", data);

export const getSerialsByWarehouse = (warehouseId: string, productId?: string) =>
  api.get("/inventory/serials/by-warehouse", { params: { warehouse_id: warehouseId, product_id: productId } });

// Stock Movements
export const getMovements = (params?: any) => api.get("/inventory/movements", { params });

// Manual stock documents
export const createStockDocument = (data: {
  direction: "in" | "out";
  item_id: string;
  warehouse_id: string;
  quantity?: number;
  unit_cost?: number;
  serial_numbers?: string[];
  notes?: string;
}) => api.post("/inventory/stock-documents", data);

// Stock Count (جرد)
export const createStockCount = (data: any) => api.post("/inventory/stock-count", data);

// Count History
export const getCountHistory = (params?: any) =>
  api.get("/inventory/stock-count/history", { params });

// Available serials for invoice picker
export const getAvailableSerials = (productId: string) =>
  api.get(`/inventory/items/${productId}/available-serials`);

// Items for invoice picker (with stock info) — dedicated endpoint
export const getItemsForPicker = (params?: { search?: string; warehouse_id?: string }) =>
  api.get("/inventory/items/picker", { params });

// Low Stock Alerts
export const getLowStockAlerts = () =>
  api.get("/inventory/alerts/low-stock");

// Variants (ملابس)
export const getVariants = (productId: string) =>
  api.get(`/inventory/items/${productId}/variants`);

// ─── Batch Management (صيدلية فقط) ───────────────────────────────────
export const getBatches = (productId: string, includeEmpty = false) =>
  api.get(`/inventory/items/${productId}/batches`, { params: { include_empty: includeEmpty } });

export const addBatch = (productId: string, data: any) =>
  api.post(`/inventory/items/${productId}/batches`, data);

export const getExpiryAlerts = (daysAhead = 90) =>
  api.get("/inventory/alerts/expiry", { params: { days_ahead: daysAhead } });

export const getBatchExpiryReport = (params?: { product_id?: string; days_ahead?: number }) =>
  api.get("/inventory/reports/batch-expiry", { params });

// Serial invoice reconciliation (admin only)
export const reconcileSerialInvoiceStock = (params: { apply?: boolean; invoice_numbers?: string }) =>
  api.post("/inventory/serial-reconciliation", null, { params });

export const reconcileSerialInvoiceStockPreview = (invoiceNumbers: string[]) =>
  reconcileSerialInvoiceStock({ apply: false, invoice_numbers: invoiceNumbers.join(",") });

export const applySerialInvoiceStockReconciliation = (invoiceNumbers: string[]) =>
  reconcileSerialInvoiceStock({ apply: true, invoice_numbers: invoiceNumbers.join(",") });
