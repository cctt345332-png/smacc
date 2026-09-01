"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  getAccounts, createAccount, updateAccount, deleteAccount, bulkReparentAccounts,
  getAccountingReadiness, initializeDefaultChart,
  applyDefaultPartyMappings,
  getOperationalAccountMappings, updateOperationalAccountMapping,
} from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const TYPES = [
  { value: "asset", ar: "أصول", en: "Asset", color: "badge-info" },
  { value: "liability", ar: "خصوم", en: "Liability", color: "badge-danger" },
  { value: "equity", ar: "حقوق ملكية", en: "Equity", color: "badge-warning" },
  { value: "revenue", ar: "إيرادات", en: "Revenue", color: "badge-success" },
  { value: "expense", ar: "مصروفات", en: "Expense", color: "badge-gray" },
];

const NATURES = [
  { value: "debit", ar: "مدين", en: "Debit" },
  { value: "credit", ar: "دائن", en: "Credit" },
];

const MAPPING_LABELS: Record<string, string> = {
  default_cash: "الصندوق الافتراضي", default_bank: "البنك الافتراضي",
  default_card: "تحصيل البطاقة (حساب التسوية)", default_wallet: "المحفظة الرقمية (حساب التسوية)",
  default_ar: "ذمم العملاء", default_ap: "ذمم الموردين",
  inventory: "المخزون", vat_input: "ضريبة المدخلات", vat_output: "ضريبة المخرجات",
  sales_goods: "مبيعات البضائع", sales_services: "إيرادات الخدمات",
  sales_returns: "مردودات المبيعات", sales_discounts: "خصم المبيعات", other_income: "إيرادات أخرى",
  cogs_goods: "تكلفة البضاعة المباعة", cost_services: "تكلفة الخدمات / مصروف عام",
  employee_advances: "عهد الموظفين", rep_collections: "عهد تحصيل المناديب",
  payroll_payable: "رواتب مستحقة", payroll_expense: "مصروف الرواتب",
  accrued_expenses: "مصروفات مستحقة", operating_expenses: "مصروفات تشغيلية",
  inventory_adjustment_gain: "زيادة تسوية المخزون", inventory_adjustment_loss: "عجز أو تلف المخزون",
  capital: "رأس المال",
};

export default function ChartOfAccountsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [accounts, setAccounts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkParentId, setBulkParentId] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [readiness, setReadiness] = useState<any>(null);
  const [mappings, setMappings] = useState<any[]>([]);
  const [form, setForm] = useState({
    code: "", name_ar: "", name_en: "", account_type: "asset",
    nature: "debit", parent_id: "", opening_balance: "0",
    is_posting: true, allow_direct_posting: true, notes: "",
  });

  const load = async () => {
    setLoading(true);
    const [accountsResult, readinessResult, mappingsResult] = await Promise.allSettled([
      getAccounts(), getAccountingReadiness(), getOperationalAccountMappings(),
    ]);
    if (accountsResult.status === "fulfilled") setAccounts(accountsResult.value.data);
    if (readinessResult.status === "fulfilled") setReadiness(readinessResult.value.data);
    if (mappingsResult.status === "fulfilled") setMappings(mappingsResult.value.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditItem(null);
    setForm({ code: "", name_ar: "", name_en: "", account_type: "asset", nature: "debit", parent_id: "", opening_balance: "0", is_posting: true, allow_direct_posting: true, notes: "" });
    setShowModal(true);
  };

  const openEdit = (acc: any) => {
    setEditItem(acc);
    setForm({ code: acc.code, name_ar: acc.name_ar, name_en: acc.name_en, account_type: acc.account_type, nature: acc.nature, parent_id: acc.parent_id || "", opening_balance: String(acc.opening_balance), is_posting: acc.is_posting, allow_direct_posting: acc.allow_direct_posting, notes: acc.notes || "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, opening_balance: parseFloat(form.opening_balance) || 0, parent_id: form.parent_id || null };
      if (editItem) await updateAccount(editItem.id, payload);
      else await createAccount(payload);
      setShowModal(false);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Error");
    } finally { setSaving(false); }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
  };

  const handleBulkReparent = async () => {
    if (!selectedIds.length) return;
    if (!bulkParentId) return alert(ar ? "اختر الحساب الأب الجديد" : "Choose the new parent account");
    if (selectedIds.includes(bulkParentId)) return alert(ar ? "لا يمكن اختيار حساب محدد كأب لنفسه" : "A selected account cannot be its own parent");
    if (!confirm(ar ? `سيتم نقل ${selectedIds.length} حساب إلى الحساب الأب المختار. هل تريد المتابعة؟` : `Move ${selectedIds.length} accounts under the selected parent?`)) return;
    setBulkSaving(true);
    try {
      await bulkReparentAccounts(selectedIds, bulkParentId);
      setSelectedIds([]);
      setBulkParentId("");
      await load();
      alert(ar ? "تم نقل الحسابات بنجاح" : "Accounts moved successfully");
    } catch (e: any) {
      alert(e?.response?.data?.detail || (ar ? "تعذر نقل الحسابات" : "Unable to move accounts"));
    } finally { setBulkSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(ar ? "هل أنت متأكد من الحذف؟" : "Are you sure?")) return;
    try { await deleteAccount(id); load(); } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
  };

  const isDescendantOf = (candidateId: string, ancestorId: string) => {
    const byId = new Map(accounts.map(a => [a.id, a]));
    const visited = new Set<string>();
    let current = byId.get(candidateId);
    while (current?.parent_id) {
      if (current.parent_id === ancestorId) return true;
      if (visited.has(current.parent_id)) return false;
      visited.add(current.parent_id);
      current = byId.get(current.parent_id);
    }
    return false;
  };

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.code.includes(q) || a.name_ar.includes(q) || a.name_en.toLowerCase().includes(q);
    const matchType = !filterType || a.account_type === filterType;
    return matchSearch && matchType;
  });

  const typeInfo = (type: string) => TYPES.find(t => t.value === type);
  const handleInitializeDefaultChart = async () => {
    if (!confirm(ar
      ? "سيتم إنشاء الشجرة الرسمية ذات الأكواد الستة بأرصدة صفرية فقط. لن تتغير أو يعاد ترقيم أي فاتورة أو عميل أو مورد أو قيد سابق. هل تريد المتابعة؟"
      : "This creates a zero-balance chart only. Existing invoices, parties, and journal entries will not change. Continue?")) return;
    setSetupBusy(true);
    try {
      await initializeDefaultChart();
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || (ar ? "تعذر تهيئة الشجرة" : "Unable to initialize the chart"));
    } finally { setSetupBusy(false); }
  };

  const handleApplyPartyMappings = async () => {
    if (!confirm(ar
      ? "سيتم ربط العملاء والموردين الذين بلا حساب بالذمم العامة فقط، من دون إنشاء أي قيود أو تعديل الفواتير. هل تريد المتابعة؟"
      : "Only unmapped customers and vendors will be linked to the general receivable/payable accounts. No journal entries or invoices will change. Continue?")) return;
    setSetupBusy(true);
    try {
      const { data } = await applyDefaultPartyMappings();
      alert(ar ? `تم ربط ${data.customers_linked} عميل و${data.vendors_linked} مورد مرجعيًا.` : `Linked ${data.customers_linked} customers and ${data.vendors_linked} vendors.`);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || (ar ? "تعذر ربط الأطراف" : "Unable to map parties"));
    } finally { setSetupBusy(false); }
  };

  const handleMappingChange = async (mappingKey: string, accountId: string) => {
    if (!accountId) return;
    setSetupBusy(true);
    try {
      await updateOperationalAccountMapping(mappingKey, accountId);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || (ar ? "تعذر حفظ الربط" : "Unable to save mapping"));
    } finally { setSetupBusy(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "دليل الحسابات" : "Chart of Accounts"}</span>
          </div>
          <h1 className="page-title">{ar ? "دليل الحسابات" : "Chart of Accounts"}</h1>
          <p className="page-subtitle">{ar ? "إدارة الهيكل المحاسبي للشركة" : "Manage your company's accounting structure"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <StructuredReportPrintButton locale={locale} title={ar ? "دليل الحسابات" : "Chart of Accounts"} subtitle={ar ? "الهيكل المحاسبي للشركة" : "Company account structure"} period={ar ? "كما في تاريخ الطباعة" : "As of print date"} orientation="landscape" reportCode={`COA-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`} metrics={[{ label: ar ? "إجمالي الحسابات" : "Total accounts", value: String(filtered.length), tone: "green" }, ...TYPES.map(t => ({ label: ar ? t.ar : t.en, value: String(accounts.filter(a => a.account_type === t.value).length), tone: "neutral" as const }))]} tables={[{ headers: [ar ? "الكود" : "Code", ar ? "اسم الحساب" : "Account name", ar ? "النوع" : "Type", ar ? "الطبيعة" : "Nature", ar ? "الرصيد الحالي" : "Current balance", ar ? "قابل للترحيل" : "Posting"], rows: filtered.map(a => [String(a.code), String(ar ? a.name_ar : a.name_en || a.name_ar), String(ar ? typeInfo(a.account_type)?.ar : typeInfo(a.account_type)?.en || a.account_type), a.nature === "debit" ? (ar ? "مدين" : "Debit") : (ar ? "دائن" : "Credit"), Number(a.current_balance ?? a.opening_balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 }), a.is_posting ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")]) }]} />
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ {ar ? "حساب جديد" : "New Account"}</button>
        </div>
      </div>

      {(
        <>
      {/* Default chart and safe mapping setup */}
      <div className="card" style={{ marginBottom: 16, borderInlineStart: "4px solid var(--primary)" }}>
        <div className="card-body" style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Icon name="journal" size={18} />
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{ar ? "تهيئة شجرة الحسابات والربط" : "Chart setup and mapping"}</h2>
                {readiness && <span className={`badge ${readiness.chart_initialized ? "badge-success" : "badge-warning"}`}>
                  {readiness.chart_initialized ? (ar ? "الشجرة مهيأة" : "Chart ready") : (ar ? "غير مهيأة" : "Not initialized")}
                </span>}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, maxWidth: 760 }}>
                {ar ? "للشركات التي لا تملك حسابات، يمكنك إنشاء الشجرة الافتراضية بأرصدة صفرية. لا تتغير الفواتير أو العملاء أو الموردون أو القيود السابقة." : "For companies without accounts, create the default zero-balance chart. Existing invoices, parties, and journal entries remain unchanged."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {readiness && !readiness.chart_initialized && readiness.account_count === 0 && (
                <button className="btn btn-primary btn-sm" onClick={handleInitializeDefaultChart} disabled={setupBusy || readiness.account_count > 0}>
                  {setupBusy ? (ar ? "جاري التهيئة..." : "Initializing...") : (ar ? "تهيئة الشجرة الافتراضية" : "Initialize default chart")}
                </button>
              )}
            </div>
          </div>

          {readiness ? (
            <>
              <div className="grid-4" style={{ marginTop: 14, marginBottom: 12 }}>
                <div style={{ background: "var(--surface-muted)", padding: "10px 12px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{ar ? "الحسابات الحالية" : "Current accounts"}</div>
                  <strong style={{ fontSize: 18 }}>{readiness.account_count}</strong>
                </div>
                <div style={{ background: "var(--surface-muted)", padding: "10px 12px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{ar ? "ربط العملاء المتبقي" : "Customers to map"}</div>
                  <strong style={{ fontSize: 18 }}>{readiness.customer_without_ar}</strong>
                </div>
                <div style={{ background: "var(--surface-muted)", padding: "10px 12px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{ar ? "ربط الموردين المتبقي" : "Vendors to map"}</div>
                  <strong style={{ fontSize: 18 }}>{readiness.vendor_without_ap}</strong>
                </div>
                <div style={{ background: "var(--surface-muted)", padding: "10px 12px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{ar ? "القيود التلقائية" : "Automatic posting"}</div>
                  <strong style={{ fontSize: 13, color: readiness.auto_posting_enabled ? "var(--success)" : "var(--warning)" }}>
                    {readiness.auto_posting_enabled ? (ar ? "مفعلة" : "Enabled") : (ar ? "غير مفعلة بأمان" : "Safely disabled")}
                  </strong>
                </div>
              </div>

              {readiness.chart_initialized && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                    <div>
                      <h3 style={{ fontSize: 14, margin: 0 }}>{ar ? "خريطة الربط المحاسبي" : "Operational account mapping"}</h3>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "3px 0 0" }}>{ar ? "غيّر الحساب النهائي لكل عملية عند الحاجة. لا يقبل النظام الحسابات التجميعية أو الموقوفة." : "Choose the final posting account for each operation. Parent and inactive accounts are rejected."}</p>
                    </div>
                    {(readiness.customer_without_ar > 0 || readiness.vendor_without_ap > 0) && (
                      <button className="btn btn-secondary btn-sm" onClick={handleApplyPartyMappings} disabled={setupBusy}>
                        {setupBusy ? (ar ? "جاري الربط..." : "Mapping...") : (ar ? "ربط العملاء والموردين بلا حساب" : "Map unmapped parties")}
                      </button>
                    )}
                  </div>
                  <div className="table-wrapper" style={{ border: "1px solid var(--border)" }}>
                    <table>
                      <thead><tr><th>{ar ? "العملية" : "Operation"}</th><th>{ar ? "الحساب المرتبط" : "Linked account"}</th></tr></thead>
                      <tbody>
                        {mappings.map((mapping) => (
                          <tr key={mapping.mapping_key}>
                            <td style={{ fontWeight: 600 }}>{MAPPING_LABELS[mapping.mapping_key] || mapping.mapping_key}</td>
                            <td>
                              <select className="form-input form-select" style={{ minWidth: 240, maxWidth: 420 }} value={mapping.account_id}
                                onChange={(e) => handleMappingChange(mapping.mapping_key, e.target.value)} disabled={setupBusy}>
                                {accounts.filter((account) => account.is_active && account.is_posting).map((account) => (
                                  <option key={account.id} value={account.id}>{account.code} — {ar ? account.name_ar : account.name_en}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="alert alert-info" style={{ marginTop: 12, marginBottom: 0 }}>
                    {ar ? "بياناتك التاريخية لم تتغير. مؤشرات المراجعة تعرض فقط ما يحتاج قرارًا محاسبيًا لاحقًا؛ لن يتم إنشاء قيود بأثر رجعي تلقائيًا." : "Historical data remains unchanged. Review indicators require an accounting decision later; no backdated entries will be created automatically."}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "14px 0 0" }}>{ar ? "تعذر جلب حالة التهيئة حاليًا. تأكد من تحديث الخلفية ثم أعد فتح الصفحة." : "Unable to load setup status. Update the backend and reload this page."}</p>
          )}
        </div>
      </div>
        </>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input className="form-input" style={{ width: 240 }} placeholder={ar ? "بحث بالكود أو الاسم..." : "Search by code or name..."}
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-input form-select" style={{ width: 160 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">{ar ? "كل الأنواع" : "All Types"}</option>
            {TYPES.map(t => <option key={t.value} value={t.value}>{ar ? t.ar : t.en}</option>)}
          </select>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {filtered.length} {ar ? "حساب" : "accounts"}
          </span>
          {selectedIds.length > 0 && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              <strong style={{ fontSize: 13 }}>{selectedIds.length} {ar ? "محدد" : "selected"}</strong>
              <select className="form-input form-select" style={{ minWidth: 260 }} value={bulkParentId} onChange={e => setBulkParentId(e.target.value)}>
                <option value="">{ar ? "اختر الحساب الأب الجديد" : "Choose new parent account"}</option>
                {accounts
                  .filter(a => !selectedIds.includes(a.id) && !selectedIds.some(id => isDescendantOf(a.id, id)))
                  .map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={handleBulkReparent} disabled={bulkSaving}>
                {bulkSaving ? (ar ? "جاري النقل..." : "Moving...") : (ar ? "نقل المحدد" : "Move selected")}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedIds([]); setBulkParentId(""); }}>
                {ar ? "إلغاء التحديد" : "Clear selection"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {TYPES.map(t => {
          const count = accounts.filter(a => a.account_type === t.value).length;
          return (
            <div key={t.value} className="card" style={{ padding: "14px 16px", cursor: "pointer" }}
              onClick={() => setFilterType(filterType === t.value ? "" : t.value)}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{ar ? t.ar : t.en}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{count}</div>
              <div style={{ marginTop: 6 }}><span className={`badge ${t.color}`}>{ar ? t.ar : t.en}</span></div>
            </div>
          );
        })}
        <div className="card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{ar ? "الإجمالي" : "Total"}</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{accounts.length}</div>
          <div style={{ marginTop: 6 }}><span className="badge badge-info">{ar ? "حساب" : "Accounts"}</span></div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border)", margin: "0 auto 12px" }} /><div>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}><Icon name="journal" size={24} /></div>
              <div className="empty-state-title">{ar ? "لا توجد حسابات" : "No accounts found"}</div>
              <div className="empty-state-desc">{ar ? "أضف حسابك الأول لبدء العمل" : "Add your first account to get started"}</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 42 }}>
                    <input type="checkbox" aria-label={ar ? "تحديد الحسابات الظاهرة" : "Select visible accounts"}
                      checked={filtered.length > 0 && filtered.every(a => selectedIds.includes(a.id))}
                      onChange={e => setSelectedIds(e.target.checked ? Array.from(new Set([...selectedIds, ...filtered.map(a => a.id)])) : selectedIds.filter(id => !filtered.some(a => a.id === id)))} />
                  </th>
                  <th>{ar ? "الكود" : "Code"}</th>
                  <th>{ar ? "اسم الحساب" : "Account Name"}</th>
                  <th>{ar ? "النوع" : "Type"}</th>
                  <th>{ar ? "الطبيعة" : "Nature"}</th>
                  <th>{ar ? "المستوى" : "Level"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الرصيد الحالي" : "Current Balance"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(acc => {
                  const t = typeInfo(acc.account_type);
                  return (
                    <tr key={acc.id}>
                      <td>
                        <input type="checkbox" aria-label={`${ar ? "تحديد " : "Select "}${ar ? acc.name_ar : acc.name_en}`} checked={selectedIds.includes(acc.id)} onChange={() => toggleSelected(acc.id)} />
                      </td>
                      <td><code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{acc.code}</code></td>
                      <td style={{ paddingInlineStart: `${(acc.level - 1) * 20 + 16}px` }}>
                        {acc.level > 1 && <span style={{ color: "var(--text-muted)", marginInlineEnd: 6 }}>└</span>}
                        <span style={{ fontWeight: acc.level === 1 ? 700 : 400 }}>{ar ? acc.name_ar : acc.name_en}</span>
                      </td>
                      <td><span className={`badge ${t?.color || "badge-gray"}`}>{ar ? t?.ar : t?.en}</span></td>
                      <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                        {acc.nature === "debit" ? (ar ? "مدين" : "Debit") : (ar ? "دائن" : "Credit")}
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>{acc.level}</td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>
                        {Number(acc.current_balance ?? acc.opening_balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} {ar ? "ر.س" : "SAR"}
                      </td>
                      <td>
                        <span className={`badge ${acc.is_active ? "badge-success" : "badge-gray"}`}>
                          {acc.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(acc)} title={ar ? "تعديل" : "Edit"}><Icon name="edit" size={14} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(acc.id)} title={ar ? "حذف" : "Delete"}><Icon name="trash" size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto" }} className="animate-slide">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>{editItem ? (ar ? "تعديل حساب" : "Edit Account") : (ar ? "حساب جديد" : "New Account")}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "كود الحساب" : "Account Code"} <span className="required">*</span></label>
                  <input className="form-input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="100000" />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "الحساب الأب" : "Parent Account"}</label>
                  <select className="form-input form-select" value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                    <option value="">{ar ? "— بدون —" : "— None —"}</option>
                    {accounts
                      .filter(a => !editItem || (a.id !== editItem.id && !isDescendantOf(a.id, editItem.id)))
                      .map(a => <option key={a.id} value={a.id}>{a.code} - {ar ? a.name_ar : a.name_en}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "الاسم بالعربي" : "Arabic Name"} <span className="required">*</span></label>
                  <input className="form-input" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} placeholder="النقدية" />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "الاسم بالإنجليزي" : "English Name"} <span className="required">*</span></label>
                  <input className="form-input" value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} placeholder="Cash" />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "نوع الحساب" : "Account Type"}</label>
                  <select className="form-input form-select" value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}>
                    {TYPES.map(t => <option key={t.value} value={t.value}>{ar ? t.ar : t.en}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "طبيعة الحساب" : "Account Nature"}</label>
                  <select className="form-input form-select" value={form.nature} onChange={e => setForm(f => ({ ...f, nature: e.target.value }))}>
                    {NATURES.map(n => <option key={n.value} value={n.value}>{ar ? n.ar : n.en}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الرصيد الافتتاحي" : "Opening Balance"}</label>
                <input type="number" className="form-input" value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
                <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
