import api from "./api";

// Accounts
export const getAccounts = () => api.get("/accounting/accounts");
export const createAccount = (data: any) => api.post("/accounting/accounts", data);
export const updateAccount = (id: string, data: any) => api.patch(`/accounting/accounts/${id}`, data);
export const deleteAccount = (id: string) => api.delete(`/accounting/accounts/${id}`);

// Fiscal Years
export const getFiscalYears = () => api.get("/accounting/fiscal-years");
export const createFiscalYear = (data: any) => api.post("/accounting/fiscal-years", data);
export const closeFiscalYear = (id: string) => api.post(`/accounting/fiscal-years/${id}/close`);

// Cost Centers
export const getCostCenters = () => api.get("/accounting/cost-centers");
export const createCostCenter = (data: any) => api.post("/accounting/cost-centers", data);

// Currencies
export const getCurrencies = () => api.get("/accounting/currencies");
export const createCurrency = (data: any) => api.post("/accounting/currencies", data);

// Journal Entries
export const getJournalEntries = (params?: any) => api.get("/accounting/journal-entries", { params });
export const getJournalEntry = (id: string) => api.get(`/accounting/journal-entries/${id}`);
export const createJournalEntry = (data: any) => api.post("/accounting/journal-entries", data);
export const postJournalEntry = (id: string) => api.post(`/accounting/journal-entries/${id}/post`);
export const cancelJournalEntry = (id: string) => api.post(`/accounting/journal-entries/${id}/cancel`);
export const reverseJournalEntry = (id: string) => api.post(`/accounting/journal-entries/${id}/reverse`);

// Bank Accounts
export const getBankAccounts = () => api.get("/accounting/bank-accounts");
export const createBankAccount = (data: any) => api.post("/accounting/bank-accounts", data);

// Budgets
export const getBudgets = () => api.get("/accounting/budgets");
export const createBudget = (data: any) => api.post("/accounting/budgets", data);

// VAT
export const getVATSettings = () => api.get("/accounting/vat-settings");
export const saveVATSettings = (data: any) => api.put("/accounting/vat-settings", data);

// Reports
export const getTrialBalance = (from_date: string, to_date: string) =>
  api.get("/accounting/reports/trial-balance", { params: { from_date, to_date } });
export const getLedger = (account_id: string, from_date: string, to_date: string) =>
  api.get(`/accounting/reports/ledger/${account_id}`, { params: { from_date, to_date } });


// Default chart and operational account mapping
export const getAccountingReadiness = () => api.get("/accounting/setup/readiness");
export const initializeDefaultChart = () => api.post("/accounting/setup/initialize");
export const getLegacyChartReplacementReadiness = () => api.get("/accounting/setup/legacy-chart-replacement-readiness");
export const importLegacyCompanyChart = () => api.post("/accounting/setup/import-legacy-company-chart");
export const replaceEmptyChartWithLegacyCompanyChart = () => api.post("/accounting/setup/replace-empty-chart-with-legacy-company-chart");
export const applyDefaultPartyMappings = () => api.post("/accounting/setup/apply-default-party-mappings");
export const getOperationalAccountMappings = () => api.get("/accounting/setup/mappings");
export const updateOperationalAccountMapping = (mappingKey: string, accountId: string) =>
  api.put(`/accounting/setup/mappings/${mappingKey}`, { account_id: accountId });
