"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getReps, getRepSummary } from "@/lib/reps";
import { getCustomers } from "@/lib/sales";
import api from "@/lib/api";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";
import {
  FINANCIAL_INVOICE_STATUSES,
  INVOICE_STATUS_PRESENTATION,
  isFinancialInvoiceStatus,
} from "@/lib/invoiceStatus";

const fmt  = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtD = (d: any) => d ? new Date(d).toLocaleDateString("en-US") : "—";

const STATUS_AR: Record<string, string> = Object.fromEntries(
  Object.entries(INVOICE_STATUS_PRESENTATION).map(([status, presentation]) => [status, presentation.ar])
);
const STATUS_COLOR: Record<string, string> = {
  draft: "#6B7280", submitted: "#D97706", approved: "#5A187E",
  rejected: "#DC2626", confirmed: "#6F4A84", paid: "#6F4A84",
  partial: "#D97706", overdue: "#DC2626", cancelled: "#6B7280",
  sent: "#5A187E", zatca_pending: "#D97706", zatca_cleared: "#6F4A84", zatca_rejected: "#DC2626",
};
const PAY_AR: Record<string, string> = { cash: "نقد", credit: "آجل", cheque: "شيك", transfer: "تحويل" };

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);
const startOfWeekIso = (value: string) => {
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toIsoDate(date);
};
const endOfWeekIso = (value: string) => {
  const date = new Date(`${startOfWeekIso(value)}T12:00:00`);
  date.setDate(date.getDate() + 6);
  return toIsoDate(date);
};
const monthBounds = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  const start = new Date(year, (month || 1) - 1, 1, 12);
  const end = new Date(year, month || 1, 0, 12);
  return { from: toIsoDate(start), to: toIsoDate(end) };
};

export default function RepsReportsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [reps, setReps] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<Record<string, any>>({});
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerReports, setCustomerReports] = useState<any[]>([]);
  const [customerReportLoading, setCustomerReportLoading] = useState(false);
  const [customerActivity, setCustomerActivity] = useState<any[]>([]);
  const [customerActivityLoaded, setCustomerActivityLoaded] = useState(false);
  const [customerPeriod, setCustomerPeriod] = useState<"day" | "week" | "month" | "custom">("day");
  const todayIso = new Date().toISOString().slice(0, 10);
  const [customerAnchorDate, setCustomerAnchorDate] = useState(todayIso);
  const [customerMonth, setCustomerMonth] = useState(todayIso.slice(0, 7));
  const [customerFrom, setCustomerFrom] = useState(todayIso);
  const [customerTo, setCustomerTo] = useState(todayIso);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"performance" | "invoices" | "operations" | "customers" | "stock">("performance");
  const [filterRep, setFilterRep] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterZone, setFilterZone] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  /* ── تصدير CSV ──────────────────────────────────────────────────── */
  const downloadCSV = (rows: any[][], filename: string) => {
    const bom = "\uFEFF";
    const csv = bom + rows.map(r =>
      r.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPerformance = () => {
    const rows = [
      ["المندوب", "الكود", "المنطقة", "الهدف الشهري", "المبيعات", "نسبة التحقق%", "المحصّل", "المستحق", "عدد الفواتير", "العمولة"],
      ...repStats.map(({ rep, sum, pct, commission }) => [
        rep.full_name, rep.rep_code, rep.zone || "",
        rep.target_monthly || 0,
        Number(sum.total_sales || 0).toFixed(2),
        pct ?? "",
        Number(sum.total_collected || 0).toFixed(2),
        Number(sum.outstanding || 0).toFixed(2),
        sum.invoice_count || 0,
        commission > 0 ? commission.toFixed(2) : 0,
      ]),
    ];
    downloadCSV(rows, "reps-performance.csv");
  };

  const exportInvoices = () => {
    const rows = [
      ["رقم الفاتورة", "المندوب", "المنطقة", "العميل", "الحالة", "طريقة الدفع", "التاريخ", "الإجمالي", "المدفوع", "المتبقي"],
      ...filteredInvoices.map((inv: any) => {
        const rep = repMap[inv.rep_id];
        const remaining = Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0));
        return [
          inv.invoice_number, rep?.full_name || "", rep?.zone || "",
          inv.buyer_name_ar, STATUS_AR[inv.status] || "حالة غير معروفة",
          PAY_AR[inv.invoice_payment_method] || "",
          inv.issue_date ? new Date(inv.issue_date).toLocaleDateString("en-US") : "",
          Number(inv.total || 0).toFixed(2),
          Number(inv.paid_amount || 0).toFixed(2),
          remaining.toFixed(2),
        ];
      }),
    ];
    downloadCSV(rows, "reps-invoices.csv");
  };


  /* ── تحميل PDF من الباكند ───────────────────────────────────────── */
  const [pdfLoading, setPdfLoading] = useState(false);

  const downloadPDF = async () => {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterRep)   params.set("rep_id", filterRep);
      if (filterZone)  params.set("zone",   filterZone);
      if (filterMonth) params.set("month",  filterMonth);

      // استخدام axios مع التوكن التلقائي
      const { default: api } = await import("@/lib/api");
      const res = await api.get(`/reps/report/pdf?${params.toString()}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `reps-report-${filterMonth || new Date().toISOString().slice(0, 7)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(ar ? "خطأ في تحميل التقرير" : "PDF download failed");
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const repsRes = await getReps();
        const list = Array.isArray(repsRes.data) ? repsRes.data : [];
        setReps(list);
        const [sumResults, invRes, paymentsRes, creditNotesRes, pendingRes, customersRes] = await Promise.all([
          Promise.allSettled(list.map((r: any) => getRepSummary(r.id))),
          api.get("/sales/invoices"),
          api.get("/sales/payments").catch(() => ({ data: [] })),
          api.get("/sales/credit-notes").catch(() => ({ data: [] })),
          api.get("/sales/invoices-pending").catch(() => ({ data: [] })),
          getCustomers().catch(() => ({ data: [] })),
        ]);
        const map: Record<string, any> = {};
        sumResults.forEach((r, i) => {
          if (r.status === "fulfilled") map[list[i].id] = r.value.data;
        });
        setSummaries(map);
        // مصدر التقرير المالي يعيد المؤكد فقط؛ طلبات المراجعة تبقى منفصلة
        // ولا تدخل أبداً في المبيعات أو العمولات أو التصدير.
        setInvoices(Array.isArray(invRes.data) ? invRes.data.filter((invoice: any) => isFinancialInvoiceStatus(invoice.status)) : []);
        setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
        setCreditNotes(Array.isArray(creditNotesRes.data) ? creditNotesRes.data : []);
        setPendingInvoices(Array.isArray(pendingRes.data) ? pendingRes.data : []);
        setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      } catch { } finally { setLoading(false); }
    };
    load();
  }, []);

  const repMap: Record<string, any> = {};
  reps.forEach(r => { repMap[r.id] = r; });

  // تقرير المبيعات لا يشمل إلا الفواتير المكتملة ماليًا بعد الاعتماد.
  const filteredInvoices = invoices.filter((inv: any) => {
    if (!inv.rep_id || !isFinancialInvoiceStatus(inv.status)) return false;
    const matchR    = !filterRep    || inv.rep_id === filterRep;
    const matchS    = !filterStatus || inv.status === filterStatus;
    const matchFrom = !dateFrom || new Date(inv.issue_date) >= new Date(dateFrom);
    const matchTo   = !dateTo   || new Date(inv.issue_date) <= new Date(dateTo + "T23:59:59");
    const matchZone = !filterZone  || (repMap[inv.rep_id]?.zone || "") === filterZone;
    const matchMonth= !filterMonth || (inv.issue_date || "").startsWith(filterMonth);
    return matchR && matchS && matchFrom && matchTo && matchZone && matchMonth;
  });

  const invoiceById: Record<string, any> = {};
  invoices.forEach((invoice: any) => { invoiceById[invoice.id] = invoice; });
  const operations = [
    ...invoices.map((inv: any) => ({
      id: `invoice-${inv.id}`, type: "invoice", date: inv.issue_date, rep_id: inv.rep_id,
      customer: inv.buyer_name_ar, reference: inv.invoice_number, debit: Number(inv.total || 0), credit: 0,
      status: inv.status,
    })),
        ...payments.map((payment: any) => {
      const invoice = invoiceById[payment.invoice_id];
      return { id: `payment-${payment.id}`, type: "payment", date: payment.payment_date,
        rep_id: payment.rep_id || invoice?.rep_id,
        customer: payment.customer_name_ar || invoice?.buyer_name_ar || payment.customer_id,
        reference: payment.payment_number, debit: 0, credit: Number(payment.amount || 0), status: payment.payment_method };
    }),
    ...creditNotes.map((note: any) => {
      const invoice = invoiceById[note.original_invoice_id];
      return { id: `credit-${note.id}`, type: "credit_note", date: note.issue_date, rep_id: note.rep_id || invoice?.rep_id,
        customer: note.customer_id, reference: note.credit_note_number, debit: 0, credit: Number(note.total || 0), status: note.reason };
    }),
  ].filter((op: any) => {
    const matchR = !filterRep || op.rep_id === filterRep;
    const matchFrom = !dateFrom || new Date(op.date) >= new Date(dateFrom);
    const matchTo = !dateTo || new Date(op.date) <= new Date(dateTo + "T23:59:59");
    const matchMonth = !filterMonth || String(op.date || "").startsWith(filterMonth);
    const matchZone = !filterZone || (repMap[op.rep_id]?.zone || "") === filterZone;
    return op.rep_id && matchR && matchFrom && matchTo && matchMonth && matchZone;
  }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const operationTotals = {
    debit: operations.reduce((s: number, op: any) => s + op.debit, 0),
    credit: operations.reduce((s: number, op: any) => s + op.credit, 0),
  };

  const customerMap: Record<string, any> = {};
  customers.forEach((customer: any) => { customerMap[customer.id] = customer; });
  const allActivityInvoices = [...invoices, ...pendingInvoices].filter((invoice: any, index: number, list: any[]) =>
    list.findIndex((item: any) => item.id === invoice.id) === index
  );
  const customerActivityDateRange = () => {
    if (customerPeriod === "week") return { from: startOfWeekIso(customerAnchorDate), to: endOfWeekIso(customerAnchorDate) };
    if (customerPeriod === "month") return monthBounds(customerMonth);
    if (customerPeriod === "custom") return { from: customerFrom, to: customerTo };
    return { from: customerAnchorDate, to: customerAnchorDate };
  };
  const customerOperationRepId = (item: any, invoice?: any) =>
    item.rep_id || invoice?.rep_id || customerMap[item.customer_id || invoice?.customer_id]?.rep_id || "";
  const customerOperationInRange = (date: any, from: string, to: string) => {
    const value = String(date || "").slice(0, 10);
    return Boolean(value && value >= from && value <= to);
  };
  const loadCustomerActivity = () => {
    setCustomerReportLoading(true);
    const { from, to } = customerActivityDateRange();
    const rows: any[] = [];
    allActivityInvoices.forEach((invoice: any) => {
      const repId = customerOperationRepId({}, invoice);
      if (!repId || (filterRep && repId !== filterRep) || !customerOperationInRange(invoice.issue_date, from, to)) return;
      const financial = isFinancialInvoiceStatus(invoice.status);
      rows.push({
        id: `invoice-${invoice.id}`, type: "invoice", date: invoice.issue_date, rep_id: repId,
        customer_id: invoice.customer_id, customer: invoice.buyer_name_ar || customerMap[invoice.customer_id]?.name_ar || "—",
        reference: invoice.invoice_number, status: invoice.status, amount: Number(invoice.total || 0),
        debit: financial ? Number(invoice.total || 0) : 0, credit: 0, financial,
        displayOnly: !financial,
      });
    });
    payments.forEach((payment: any) => {
      const invoice = allActivityInvoices.find((item: any) => item.id === payment.invoice_id);
      const repId = customerOperationRepId(payment, invoice);
      if (!repId || (filterRep && repId !== filterRep) || !customerOperationInRange(payment.payment_date, from, to)) return;
      rows.push({
        id: `payment-${payment.id}`, type: "payment", date: payment.payment_date, rep_id: repId,
        customer_id: payment.customer_id || invoice?.customer_id,
        customer: payment.customer_name_ar || invoice?.buyer_name_ar || customerMap[payment.customer_id]?.name_ar || "—",
        reference: payment.payment_number, status: payment.payment_method, amount: Number(payment.amount || 0),
        debit: 0, credit: Number(payment.amount || 0), financial: true, displayOnly: false,
      });
    });
    creditNotes.forEach((note: any) => {
      const invoice = allActivityInvoices.find((item: any) => item.id === note.original_invoice_id);
      const repId = customerOperationRepId(note, invoice);
      if (!repId || (filterRep && repId !== filterRep) || !customerOperationInRange(note.issue_date, from, to)) return;
      rows.push({
        id: `credit-${note.id}`, type: "credit_note", date: note.issue_date, rep_id: repId,
        customer_id: note.customer_id || invoice?.customer_id,
        customer: customerMap[note.customer_id]?.name_ar || invoice?.buyer_name_ar || "—",
        reference: note.credit_note_number, status: note.reason, amount: Number(note.total || 0),
        debit: 0, credit: Number(note.total || 0), financial: true, displayOnly: false,
      });
    });
    setCustomerActivity(rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setCustomerActivityLoaded(true);
    setCustomerReportLoading(false);
  };
  const customerActivityTotals = {
    confirmedSales: customerActivity.reduce((sum, row) => sum + (row.financial && row.type === "invoice" ? row.amount : 0), 0),
    collected: customerActivity.reduce((sum, row) => sum + (row.type === "payment" ? row.amount : 0), 0),
    pendingDisplay: customerActivity.reduce((sum, row) => sum + (row.displayOnly ? row.amount : 0), 0),
  };
  const customerActivityCustomers = new Set(customerActivity.map(row => row.customer_id).filter(Boolean)).size;

  const zones = [...new Set(reps.map(r => r.zone).filter(Boolean))] as string[];

  const repStats = reps
    .filter(rep => !filterZone || (rep.zone || "") === filterZone)
    .filter(rep => !filterRep  || rep.id === filterRep)
    .map(rep => {
      const sum = summaries[rep.id] || {};
      const pct = rep.target_monthly > 0
        ? Math.min(100, Math.round((Number(sum.total_sales || 0) / Number(rep.target_monthly)) * 100))
        : null;
      const commission = rep.commission_pct > 0
        ? Number(sum.total_sales || 0) * Number(rep.commission_pct) / 100
        : 0;
      return { rep, sum, pct, commission };
    }).sort((a, b) => Number(b.sum.total_sales || 0) - Number(a.sum.total_sales || 0));

  const TABS = [
    { key: "performance", label: ar ? "مقارنة الأداء" : "Performance" },
    { key: "invoices",    label: ar ? "الفواتير التفصيلية" : "Invoices Detail" },
    { key: "operations",  label: ar ? "كل العمليات" : "All Operations" },
    { key: "customers",   label: ar ? "كل العملاء" : "All Customers" },
    { key: "stock",       label: ar ? "المخزون" : "Stock" },
  ] as const;

  const totalSales       = repStats.reduce((s, r) => s + Number(r.sum.total_sales || 0), 0);
  const totalCollected   = repStats.reduce((s, r) => s + Number(r.sum.total_collected || 0), 0);
  const totalOutstanding = repStats.reduce((s, r) => s + Number(r.sum.outstanding || 0), 0);
  const totalCommission  = repStats.reduce((s, r) => s + r.commission, 0);

  const printTitle = tab === "performance"
    ? (ar ? "تقرير أداء المناديب" : "Sales Rep Performance Report")
    : tab === "invoices"
      ? (ar ? "تقرير فواتير المناديب" : "Sales Rep Invoices Report")
      : tab === "operations"
        ? (ar ? "كشف عمليات المناديب" : "Sales Rep Operations Ledger")
        : tab === "customers"
          ? (ar ? "تقرير كل عمليات العملاء" : "All Customer Operations Report")
          : (ar ? "تقرير مخزون المناديب" : "Sales Rep Stock Report");
  const reportPeriod = filterMonth || `${dateFrom || (ar ? "بداية البيانات" : "Start")} — ${dateTo || (ar ? "حتى اليوم" : "Today")}`;
  const reportMetrics = tab === "performance" ? [
    { label: ar ? "مبيعات الفريق" : "Team sales", value: `${fmt(totalSales)} SAR`, tone: "blue" as const },
    { label: ar ? "المحصّل" : "Collected", value: `${fmt(totalCollected)} SAR`, tone: "green" as const },
    { label: ar ? "المستحق" : "Outstanding", value: `${fmt(totalOutstanding)} SAR`, tone: "amber" as const },
    { label: ar ? "العمولات" : "Commissions", value: `${fmt(totalCommission)} SAR`, tone: "neutral" as const },
  ] : tab === "invoices" ? [
    { label: ar ? "عدد الفواتير" : "Invoices", value: String(filteredInvoices.length), tone: "neutral" as const },
    { label: ar ? "إجمالي الفواتير" : "Total invoiced", value: `${fmt(filteredInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0))} SAR`, tone: "blue" as const },
    { label: ar ? "المتبقي" : "Outstanding", value: `${fmt(filteredInvoices.reduce((s: number, i: any) => s + Math.max(0, Number(i.total || 0) - Number(i.paid_amount || 0)), 0))} SAR`, tone: "amber" as const },
  ] : tab === "operations" ? [
    { label: ar ? "عدد العمليات" : "Operations", value: String(operations.length), tone: "neutral" as const },
    { label: ar ? "إجمالي المدين" : "Total debit", value: `${fmt(operationTotals.debit)} SAR`, tone: "blue" as const },
    { label: ar ? "إجمالي الدائن" : "Total credit", value: `${fmt(operationTotals.credit)} SAR`, tone: "green" as const },
    { label: ar ? "الصافي" : "Net", value: `${fmt(operationTotals.debit - operationTotals.credit)} SAR`, tone: "amber" as const },
  ] : [
    { label: ar ? "المناديب" : "Reps", value: String(repStats.length), tone: "neutral" as const },
    { label: ar ? "كمية مخزون المناديب" : "Rep stock qty", value: String(repStats.reduce((s, r) => s + Number(r.sum.stock_qty || 0), 0)), tone: "amber" as const },
  ];
  const reportTable = tab === "performance" ? { headers: [ar ? "المندوب" : "Rep", ar ? "المنطقة" : "Zone", ar ? "الهدف" : "Target", ar ? "المبيعات" : "Sales", ar ? "التحقق" : "Achievement", ar ? "المحصّل" : "Collected", ar ? "المستحق" : "Outstanding", ar ? "العمولة" : "Commission"], rows: repStats.map(({ rep, sum, pct, commission }) => [rep.full_name, rep.zone || "—", rep.target_monthly ? fmt(rep.target_monthly) : "—", fmt(sum.total_sales || 0), pct == null ? "—" : `${pct}%`, fmt(sum.total_collected || 0), fmt(sum.outstanding || 0), fmt(commission)]), totals: [ar ? "الإجمالي" : "Total", "", "", fmt(totalSales), "", fmt(totalCollected), fmt(totalOutstanding), fmt(totalCommission) ] } : tab === "invoices" ? { headers: [ar ? "الفاتورة" : "Invoice", ar ? "المندوب" : "Rep", ar ? "العميل" : "Customer", ar ? "الحالة" : "Status", ar ? "التاريخ" : "Date", ar ? "الإجمالي" : "Total", ar ? "المدفوع" : "Paid", ar ? "المتبقي" : "Remaining"], rows: filteredInvoices.map((inv: any) => [inv.invoice_number, repMap[inv.rep_id]?.full_name || "—", inv.buyer_name_ar || "—", STATUS_AR[inv.status] || "حالة غير معروفة", fmtD(inv.issue_date), fmt(inv.total), fmt(inv.paid_amount), fmt(Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0)))]) } : tab === "operations" ? { headers: [ar ? "النوع" : "Type", ar ? "التاريخ" : "Date", ar ? "المندوب" : "Rep", ar ? "العميل" : "Customer", ar ? "المرجع" : "Reference", ar ? "مدين" : "Debit", ar ? "دائن" : "Credit", ar ? "البيان" : "Details"], rows: operations.map((op: any) => [op.type === "invoice" ? (ar ? "فاتورة" : "Invoice") : op.type === "payment" ? (ar ? "سند قبض" : "Receipt") : (ar ? "مرتجع" : "Credit Note"), fmtD(op.date), repMap[op.rep_id]?.full_name || "—", op.customer || "—", op.reference || "—", fmt(op.debit), fmt(op.credit), op.status || "—"]), totals: [ar ? "الإجمالي" : "Total", "", "", "", "", fmt(operationTotals.debit), fmt(operationTotals.credit), ""] } : { headers: [ar ? "المندوب" : "Rep", ar ? "المنطقة" : "Zone", ar ? "المركبة" : "Vehicle", ar ? "كمية المخزون" : "Stock qty", ar ? "قيمة المخزون" : "Stock value"], rows: repStats.map(({ rep, sum }) => [rep.full_name, rep.zone || "—", rep.vehicle_plate || "—", String(Number(sum.stock_qty || 0)), fmt(sum.stock_value || 0)]) };

  const customerReportMetrics = [
    { label: ar ? "العملاء النشطون" : "Active customers", value: String(customerActivityCustomers), tone: "neutral" as const },
    { label: ar ? "المبيعات المؤكدة" : "Confirmed sales", value: `${fmt(customerActivityTotals.confirmedSales)} SAR`, tone: "blue" as const },
    { label: ar ? "المحصّل" : "Collected", value: `${fmt(customerActivityTotals.collected)} SAR`, tone: "green" as const },
    { label: ar ? "فواتير للعرض فقط" : "Display-only invoices", value: `${fmt(customerActivityTotals.pendingDisplay)} SAR`, tone: "amber" as const },
  ];
  const customerReportTable = {
    headers: [ar ? "النوع" : "Type", ar ? "التاريخ" : "Date", ar ? "المندوب" : "Rep", ar ? "العميل" : "Customer", ar ? "المرجع" : "Reference", ar ? "الحالة" : "Status", ar ? "مدين" : "Debit", ar ? "دائن" : "Credit", ar ? "الحساب" : "Accounting"],
    rows: customerActivity.map((row: any) => [
      row.type === "invoice" ? (ar ? "فاتورة" : "Invoice") : row.type === "payment" ? (ar ? "سند قبض" : "Receipt") : (ar ? "مرتجع" : "Credit note"),
      fmtD(row.date), repMap[row.rep_id]?.full_name || "—", row.customer || "—", row.reference || "—",
      row.displayOnly ? (ar ? "تحت المراجعة — عرض فقط" : "Under review — display only") : (STATUS_AR[row.status] || row.status || (ar ? "مرحّل" : "Posted")),
      row.debit ? `${fmt(row.debit)} SAR` : "—", row.credit ? `${fmt(row.credit)} SAR` : "—",
      row.displayOnly ? (ar ? "لا يدخل في الحساب" : "Excluded from totals") : (ar ? "يدخل في الحساب" : "Included in totals"),
    ]),
    totals: [ar ? "الإجمالي" : "Total", "", "", "", "", "", `${fmt(customerActivity.reduce((sum, row) => sum + Number(row.debit || 0), 0))} SAR`, `${fmt(customerActivity.reduce((sum, row) => sum + Number(row.credit || 0), 0))} SAR`, ""],
  };
  const printableReportMetrics = tab === "customers" ? customerReportMetrics : reportMetrics;
  const printableReportTable = tab === "customers" ? customerReportTable : reportTable;

  return (
    <>
      {/* CSS طباعة */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { font-size: 12px; }
          .card { box-shadow: none !important; border: 1px solid #ddd !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
        .print-only { display: none; }
      `}</style>

      {/* Print Title */}
      <div className="print-only" style={{ textAlign: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>{printTitle}</h2>
        <div style={{ fontSize: 12, color: "#666" }}>
          {new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}
          {filterRep && repMap[filterRep] && ` — ${repMap[filterRep].full_name}`}
          {filterMonth && ` — ${filterMonth}`}
        </div>
      </div>

      {/* Header */}
      <div className="page-header no-print">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reps/manage`}>{ar ? "المناديب" : "Sales Reps"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "التقارير" : "Reports"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقارير المناديب" : "Sales Rep Reports"}</h1>
          <p className="page-subtitle">{ar ? "أداء المناديب — المبيعات والتحصيل والمخزون والفواتير" : "Performance — sales, collection, stock and invoices"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={downloadPDF} disabled={pdfLoading}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #FCA5A5", background: pdfLoading ? "#F1F5F9" : "#FEF2F2", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: pdfLoading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {pdfLoading ? "⏳" : "📥"} {ar ? (pdfLoading ? "جاري..." : "PDF") : (pdfLoading ? "Loading..." : "PDF")}
          </button>
          <StructuredReportPrintButton locale={locale} title={printTitle} subtitle={ar ? "تقرير تشغيلي للمناديب" : "Operational sales-rep report"} period={reportPeriod} orientation="landscape" reportCode={`REP-${tab.toUpperCase()}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`} metrics={printableReportMetrics} tables={[printableReportTable]} />
        </div>
      </div>

      {/* فلاتر عامة */}
      <div className="card no-print" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select className="form-input form-select" style={{ width: 190 }} value={filterRep} onChange={e => setFilterRep(e.target.value)}>
            <option value="">{ar ? "كل المناديب" : "All Reps"}</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.full_name} ({r.rep_code})</option>)}
          </select>
          {zones.length > 0 && (
            <select className="form-input form-select" style={{ width: 150 }} value={filterZone} onChange={e => setFilterZone(e.target.value)}>
              <option value="">{ar ? "كل المناطق" : "All Zones"}</option>
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          )}
          <input type="month" className="form-input" style={{ width: 150 }} value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)} title={ar ? "فلتر بالشهر" : "Filter by month"} />
          {(filterRep || filterZone || filterMonth) && (
            <button className="btn btn-secondary btn-sm"
              onClick={() => { setFilterRep(""); setFilterZone(""); setFilterMonth(""); }}>
              {ar ? "مسح" : "Clear"}
            </button>
          )}
        </div>
      </div>

      {/* بطاقات الإجمالي */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: ar ? "إجمالي مبيعات الفريق" : "Team Sales",     value: fmt(totalSales) + " SAR",       color: "#5A187E" },
          { label: ar ? "إجمالي المحصّل" : "Collected",             value: fmt(totalCollected) + " SAR",   color: "#6F4A84" },
          { label: ar ? "إجمالي المستحق" : "Outstanding",           value: fmt(totalOutstanding) + " SAR", color: totalOutstanding > 0 ? "#DC2626" : "#6F4A84" },
          { label: ar ? "إجمالي العمولات" : "Commissions",          value: fmt(totalCommission) + " SAR",  color: "#75617F" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* التبويبات */}
      <div className="no-print" style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ padding: "8px 18px", border: "none", borderBottom: tab === t.key ? "2px solid var(--primary)" : "2px solid transparent",
              background: "none", cursor: "pointer", fontSize: 13,
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? "var(--primary)" : "var(--text-secondary)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "customers" && (
        <div className="card no-print" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>{ar ? "فترة النشاط" : "Activity period"}</span>
            <select className="form-input form-select" style={{ width: 150 }} value={customerPeriod} onChange={e => setCustomerPeriod(e.target.value as "day" | "week" | "month" | "custom")}>
              <option value="day">{ar ? "يومي" : "Daily"}</option>
              <option value="week">{ar ? "أسبوعي" : "Weekly"}</option>
              <option value="month">{ar ? "شهري" : "Monthly"}</option>
              <option value="custom">{ar ? "تاريخ مخصص" : "Custom dates"}</option>
            </select>
            {customerPeriod === "month" ? (
              <input type="month" className="form-input" style={{ width: 150 }} value={customerMonth} onChange={e => setCustomerMonth(e.target.value)} />
            ) : customerPeriod === "custom" ? (
              <>
                <input type="date" className="form-input" style={{ width: 150 }} value={customerFrom} onChange={e => setCustomerFrom(e.target.value)} />
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{ar ? "إلى" : "to"}</span>
                <input type="date" className="form-input" style={{ width: 150 }} value={customerTo} onChange={e => setCustomerTo(e.target.value)} />
              </>
            ) : (
              <input type="date" className="form-input" style={{ width: 150 }} value={customerAnchorDate} onChange={e => setCustomerAnchorDate(e.target.value)} />
            )}
            <button className="btn btn-primary" onClick={loadCustomerActivity} disabled={customerReportLoading}>
              {customerReportLoading ? (ar ? "جاري تجهيز التقرير..." : "Preparing...") : (ar ? "عرض النشاط" : "Show activity")}
            </button>
            {customerActivityLoaded && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{customerActivity.length} {ar ? "عملية" : "operations"}</span>}
          </div>
          <div style={{ padding: "0 16px 12px", fontSize: 11, color: "var(--text-muted)" }}>
            {ar ? "فلتر المندوب الموجود أعلى التقرير يطبق على هذا القسم أيضًا. الفواتير تحت المراجعة تظهر للعرض فقط ولا تدخل في المبيعات أو الأرصدة." : "The rep filter above also applies here. Under-review invoices are display-only and excluded from sales and balances."}
          </div>
        </div>
      )}

      {/* فلاتر إضافية للفواتير */}
      {(tab === "invoices" || tab === "operations") && (
        <div className="card no-print" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <select className="form-input form-select" style={{ width: 180 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">{ar ? "كل الفواتير المؤكدة" : "All confirmed invoices"}</option>
              {FINANCIAL_INVOICE_STATUSES.map((status) => <option key={status} value={status}>{STATUS_AR[status]}</option>)}
            </select>
            <input type="date" className="form-input" style={{ width: 150 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <input type="date" className="form-input" style={{ width: 150 }} value={dateTo}   onChange={e => setDateTo(e.target.value)}   />
            {(filterStatus || dateFrom || dateTo) && (
              <button className="btn btn-secondary btn-sm"
                onClick={() => { setFilterStatus(""); setDateFrom(""); setDateTo(""); }}>
                {ar ? "مسح" : "Clear"}
              </button>
            )}
            <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
              {filteredInvoices.length} {ar ? "فاتورة" : "invoices"} — {fmt(filteredInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0))} SAR
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
      ) : (
        <>
          {/* ══ تبويب: مقارنة الأداء ══ */}
          {tab === "performance" && (
            <div className="card">
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{ar ? "المندوب" : "Rep"}</th>
                      <th>{ar ? "المنطقة" : "Zone"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الهدف الشهري" : "Target"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "المبيعات (مؤكدة)" : "Sales (confirmed)"}</th>
                      <th>{ar ? "نسبة التحقق" : "Achievement"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "المحصّل" : "Collected"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "المستحق" : "Outstanding"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الفواتير" : "Invoices"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "المعلقة" : "Pending"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "العمولة" : "Commission"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repStats.map(({ rep, sum, pct, commission }, idx) => {
                      const pendingCount = pendingInvoices.filter(i => i.rep_id === rep.id && i.status === "submitted").length;
                      const pendingTotal = pendingInvoices.filter(i => i.rep_id === rep.id && i.status === "submitted")
                        .reduce((s, i) => s + Number(i.total || 0), 0);
                      return (
                        <tr key={rep.id}>
                          <td style={{ color: "var(--text-muted)", fontSize: 13 }}>
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                          </td>
                          <td>
                            <Link href={`/${locale}/reps/${rep.id}`}
                              style={{ fontWeight: 700, color: "var(--primary)", textDecoration: "none" }}>
                              {rep.full_name}
                            </Link>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{rep.rep_code}</div>
                          </td>
                          <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{rep.zone || "—"}</td>
                          <td style={{ textAlign: "end", fontSize: 13 }}>
                            {rep.target_monthly > 0 ? fmt(rep.target_monthly) + " SAR" : "—"}
                          </td>
                          <td style={{ textAlign: "end", fontWeight: 700, color: "#5A187E" }}>
                            {fmt(sum.total_sales || 0)} SAR
                          </td>
                          <td style={{ minWidth: 130 }}>
                            {pct !== null ? (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: pct >= 100 ? "#6F4A84" : pct >= 70 ? "#D97706" : "#DC2626", marginBottom: 3 }}>
                                  {pct}%
                                </div>
                                <div style={{ height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`,
                                    background: pct >= 100 ? "#6F4A84" : pct >= 70 ? "#D97706" : "#DC2626", borderRadius: 3 }} />
                                </div>
                              </div>
                            ) : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>}
                          </td>
                          <td style={{ textAlign: "end", fontWeight: 600, color: "#6F4A84" }}>
                            {fmt(sum.total_collected || 0)} SAR
                          </td>
                          <td style={{ textAlign: "end", fontWeight: 600, color: Number(sum.outstanding || 0) > 0 ? "#DC2626" : "#6F4A84" }}>
                            {fmt(sum.outstanding || 0)} SAR
                          </td>
                          <td style={{ textAlign: "end" }}>{sum.invoice_count || 0}</td>
                          <td style={{ textAlign: "end" }}>
                            {pendingCount > 0 ? (
                              <span style={{ background: "#FFF7ED", color: "#D97706", borderRadius: 12, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>
                                {pendingCount} ({fmt(pendingTotal)} SAR)
                              </span>
                            ) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                          </td>
                          <td style={{ textAlign: "end", fontWeight: 600, color: "#75617F" }}>
                            {commission > 0 ? fmt(commission) + " SAR" : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td colSpan={4} style={{ padding: "10px 16px" }}>{ar ? "الإجمالي" : "Total"} ({repStats.length} {ar ? "مندوب" : "reps"})</td>
                      <td style={{ textAlign: "end", padding: "10px 16px", color: "#5A187E" }}>{fmt(totalSales)} SAR</td>
                      <td />
                      <td style={{ textAlign: "end", padding: "10px 16px", color: "#6F4A84" }}>{fmt(totalCollected)} SAR</td>
                      <td style={{ textAlign: "end", padding: "10px 16px", color: totalOutstanding > 0 ? "#DC2626" : "#6F4A84" }}>{fmt(totalOutstanding)} SAR</td>
                      <td style={{ textAlign: "end", padding: "10px 16px" }}>{repStats.reduce((s, r) => s + (r.sum.invoice_count || 0), 0)}</td>
                      <td style={{ textAlign: "end", padding: "10px 16px", color: "#D97706" }}>
                        {pendingInvoices.filter(i => i.rep_id && i.status === "submitted").length}
                      </td>
                      <td style={{ textAlign: "end", padding: "10px 16px", color: "#75617F" }}>{fmt(totalCommission)} SAR</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ══ تبويب: الفواتير التفصيلية ══ */}
          {tab === "invoices" && (
            <div className="card">
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                {filteredInvoices.length === 0 ? (
                  <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد فواتير" : "No invoices"}</div></div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>{ar ? "رقم الفاتورة" : "Invoice"}</th>
                        <th>{ar ? "المندوب" : "Rep"}</th>
                        <th>{ar ? "العميل" : "Customer"}</th>
                        <th>{ar ? "الحالة" : "Status"}</th>
                        <th>{ar ? "طريقة الدفع" : "Payment"}</th>
                        <th>{ar ? "التاريخ" : "Date"}</th>
                        <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                        <th style={{ textAlign: "end" }}>{ar ? "المدفوع" : "Paid"}</th>
                        <th style={{ textAlign: "end" }}>{ar ? "المتبقي" : "Remaining"}</th>
                        <th className="no-print"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv: any) => {
                        const remaining = Number(inv.total || 0) - Number(inv.paid_amount || 0);
                        const rep = repMap[inv.rep_id];
                        return (
                          <tr key={inv.id} style={{ cursor: "pointer" }} onClick={() => setSelectedInvoice(inv)}>
                            <td style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--primary)" }}>{inv.invoice_number}</td>
                            <td style={{ fontSize: 13 }}>
                              <div>{rep?.full_name || "—"}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{rep?.rep_code}</div>
                            </td>
                            <td style={{ fontSize: 13 }}>{inv.buyer_name_ar}</td>
                            <td>
                              <span style={{
                                background: (STATUS_COLOR[inv.status] || "#6B7280") + "20",
                                color: STATUS_COLOR[inv.status] || "#6B7280",
                                padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 600
                              }}>
                                {STATUS_AR[inv.status] || "حالة غير معروفة"}
                              </span>
                              {inv.status === "rejected" && inv.rejection_note && (
                                <div style={{ fontSize: 11, color: "#DC2626", marginTop: 2 }}>{inv.rejection_note.slice(0, 40)}</div>
                              )}
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {PAY_AR[inv.invoice_payment_method] || "—"}
                              {inv.invoice_payment_method === "credit" && inv.credit_days
                                ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{inv.credit_days} {ar ? "يوم" : "d"}</div> : ""}
                            </td>
                            <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtD(inv.issue_date)}</td>
                            <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(inv.total)} SAR</td>
                            <td style={{ textAlign: "end", color: "#6F4A84" }}>{fmt(inv.paid_amount)} SAR</td>
                            <td style={{ textAlign: "end", color: remaining > 0.01 ? "#DC2626" : "#6F4A84", fontWeight: 600 }}>
                              {fmt(Math.max(0, remaining))} SAR
                            </td>
                            <td className="no-print">
                              <button className="btn btn-ghost btn-sm"
                                onClick={e => { e.stopPropagation(); setSelectedInvoice(inv); }}
                                style={{ fontSize: 12 }}>👁</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                        <td colSpan={6} style={{ padding: "10px 16px" }}>
                          {ar ? "الإجمالي" : "Total"} ({filteredInvoices.length})
                        </td>
                        <td style={{ textAlign: "end", padding: "10px 16px", color: "#5A187E" }}>
                          {fmt(filteredInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0))} SAR
                        </td>
                        <td style={{ textAlign: "end", padding: "10px 16px", color: "#6F4A84" }}>
                          {fmt(filteredInvoices.reduce((s: number, i: any) => s + Number(i.paid_amount || 0), 0))} SAR
                        </td>
                        <td style={{ textAlign: "end", padding: "10px 16px", color: "#DC2626" }}>
                          {fmt(filteredInvoices.reduce((s: number, i: any) => s + Math.max(0, Number(i.total || 0) - Number(i.paid_amount || 0)), 0))} SAR
                        </td>
                        <td className="no-print" />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ══ تبويب: كل العملاء ══ */}
          {tab === "customers" && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">{ar ? "نشاط العملاء حسب المندوب والفترة" : "Customer activity by rep and period"}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{customerActivityLoaded ? `${customerActivity.length} ${ar ? "عملية" : "operations"}` : (ar ? "اضغط عرض النشاط" : "Choose a period and show activity")}</span>
              </div>
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                {!customerActivityLoaded ? (
                  <div className="empty-state"><div className="empty-state-title">{ar ? "حدد الفترة والمندوب ثم اضغط عرض النشاط" : "Select the period and rep, then show activity"}</div></div>
                ) : customerActivity.length === 0 ? (
                  <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد عمليات في الفترة المحددة" : "No activity in the selected period"}</div></div>
                ) : (
                  <table>
                    <thead><tr>
                      <th>{ar ? "النوع" : "Type"}</th>
                      <th>{ar ? "التاريخ" : "Date"}</th>
                      <th>{ar ? "المندوب" : "Rep"}</th>
                      <th>{ar ? "العميل" : "Customer"}</th>
                      <th>{ar ? "المرجع" : "Reference"}</th>
                      <th>{ar ? "الحالة" : "Status"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "مدين" : "Debit"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "دائن" : "Credit"}</th>
                      <th>{ar ? "الأثر المالي" : "Financial effect"}</th>
                    </tr></thead>
                    <tbody>{customerActivity.map((row: any) => (
                      <tr key={row.id}>
                        <td><span className="badge" style={{ background: row.type === "invoice" ? (row.displayOnly ? "#FFF7ED" : "#F4EFF7") : row.type === "payment" ? "#ECFDF3" : "#FEF2F2", color: row.type === "invoice" ? (row.displayOnly ? "#D97706" : "#5A187E") : row.type === "payment" ? "#15803D" : "#B42318" }}>
                          {row.type === "invoice" ? (ar ? "فاتورة" : "Invoice") : row.type === "payment" ? (ar ? "سند قبض" : "Receipt") : (ar ? "مرتجع" : "Credit note")}
                        </span></td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtD(row.date)}</td>
                        <td style={{ fontSize: 13 }}>{repMap[row.rep_id]?.full_name || "—"}<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{repMap[row.rep_id]?.rep_code || ""}</div></td>
                        <td style={{ fontSize: 13 }}>{row.customer || "—"}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--primary)" }}>{row.reference || "—"}</td>
                        <td><span style={{ color: row.displayOnly ? "#D97706" : "var(--text-secondary)", fontSize: 12, fontWeight: row.displayOnly ? 700 : 400 }}>{row.displayOnly ? (ar ? "تحت المراجعة — عرض فقط" : "Under review — display only") : (STATUS_AR[row.status] || row.status || (ar ? "مرحّل" : "Posted"))}</span></td>
                        <td style={{ textAlign: "end", color: row.debit ? "#5A187E" : "var(--text-muted)" }}>{row.debit ? `${fmt(row.debit)} SAR` : "—"}</td>
                        <td style={{ textAlign: "end", color: row.credit ? "#15803D" : "var(--text-muted)" }}>{row.credit ? `${fmt(row.credit)} SAR` : "—"}</td>
                        <td style={{ fontSize: 12, color: row.displayOnly ? "#D97706" : "#15803D" }}>{row.displayOnly ? (ar ? "لا يدخل في الحساب" : "Excluded") : (ar ? "يدخل في الحساب" : "Included")}</td>
                      </tr>
                    ))}</tbody>
                    <tfoot><tr style={{ background: "#F8FAFC", fontWeight: 700 }}>
                      <td colSpan={6}>{ar ? "الإجمالي المالي" : "Financial totals"}</td>
                      <td style={{ textAlign: "end", color: "#5A187E" }}>{fmt(customerActivity.reduce((sum, row) => sum + Number(row.debit || 0), 0))} SAR</td>
                      <td style={{ textAlign: "end", color: "#15803D" }}>{fmt(customerActivity.reduce((sum, row) => sum + Number(row.credit || 0), 0))} SAR</td>
                      <td>{ar ? "لا تشمل الفواتير تحت المراجعة" : "Under-review invoices excluded"}</td>
                    </tr></tfoot>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ══ تبويب: كل العمليات ══ */}
          {tab === "operations" && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">{ar ? "كشف كل عمليات المناديب" : "All Rep Operations Ledger"}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{operations.length} {ar ? "عملية" : "operations"}</span>
              </div>
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                {operations.length === 0 ? (
                  <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد عمليات للفترة المحددة" : "No operations for the selected period"}</div></div>
                ) : (
                  <table>
                    <thead><tr>
                      <th>{ar ? "النوع" : "Type"}</th>
                      <th>{ar ? "التاريخ" : "Date"}</th>
                      <th>{ar ? "المندوب" : "Rep"}</th>
                      <th>{ar ? "العميل" : "Customer"}</th>
                      <th>{ar ? "المرجع" : "Reference"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "مدين" : "Debit"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "دائن" : "Credit"}</th>
                      <th>{ar ? "البيان" : "Details"}</th>
                    </tr></thead>
                    <tbody>{operations.map((op: any) => (
                      <tr key={op.id}>
                        <td><span className="badge" style={{ background: op.type === "invoice" ? "#F4EFF7" : op.type === "payment" ? "#ECFDF3" : "#FEF2F2", color: op.type === "invoice" ? "#5A187E" : op.type === "payment" ? "#15803D" : "#B42318" }}>
                          {op.type === "invoice" ? (ar ? "فاتورة" : "Invoice") : op.type === "payment" ? (ar ? "سند قبض" : "Receipt") : (ar ? "مرتجع" : "Credit Note")}
                        </span></td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtD(op.date)}</td>
                        <td style={{ fontSize: 13 }}>{repMap[op.rep_id]?.full_name || "—"}</td>
                        <td style={{ fontSize: 13 }}>{op.customer || "—"}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--primary)" }}>{op.reference || "—"}</td>
                        <td style={{ textAlign: "end", color: op.debit ? "#5A187E" : "var(--text-muted)" }}>{op.debit ? `${fmt(op.debit)} SAR` : "—"}</td>
                        <td style={{ textAlign: "end", color: op.credit ? "#15803D" : "var(--text-muted)" }}>{op.credit ? `${fmt(op.credit)} SAR` : "—"}</td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{op.status || "—"}</td>
                      </tr>
                    ))}</tbody>
                    <tfoot><tr style={{ background: "#F8FAFC", fontWeight: 700 }}>
                      <td colSpan={5}>{ar ? "الإجمالي" : "Total"}</td>
                      <td style={{ textAlign: "end" }}>{fmt(operationTotals.debit)} SAR</td>
                      <td style={{ textAlign: "end", color: "#15803D" }}>{fmt(operationTotals.credit)} SAR</td>
                      <td />
                    </tr></tfoot>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ══ تبويب: المخزون ══ */}
          {tab === "stock" && (
            <div className="card">
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "المندوب" : "Rep"}</th>
                      <th>{ar ? "المنطقة" : "Zone"}</th>
                      <th>{ar ? "السيارة" : "Vehicle"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "إجمالي المخزون" : "Stock Qty"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "قيمة المخزون" : "Stock Value"}</th>
                      <th className="no-print">{ar ? "التفاصيل" : "Details"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repStats.map(({ rep, sum }) => (
                      <tr key={rep.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{rep.full_name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{rep.rep_code}</div>
                        </td>
                        <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{rep.zone || "—"}</td>
                        <td>
                          {rep.vehicle_plate ? (
                            <div>
                              <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>{rep.vehicle_plate}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                {[rep.vehicle_type, rep.vehicle_color].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          ) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ textAlign: "end", fontWeight: 700, color: "#D97706" }}>
                          {Number(sum.stock_qty || 0).toLocaleString("en-US")}
                        </td>
                        <td style={{ textAlign: "end", fontSize: 13, color: "var(--text-secondary)" }}>
                          {sum.stock_value ? fmt(sum.stock_value) + " SAR" : "—"}
                        </td>
                        <td className="no-print">
                          <Link href={`/${locale}/reps/${rep.id}`} className="btn btn-ghost btn-sm">
                            {ar ? "عرض" : "View"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ Modal تفاصيل الفاتورة ══ */}
      {selectedInvoice && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSelectedInvoice(null)}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 800, maxHeight: "92vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 18, fontFamily: "monospace" }}>{selectedInvoice.invoice_number}</span>
                <span style={{
                  background: (STATUS_COLOR[selectedInvoice.status] || "#6B7280") + "20",
                  color: STATUS_COLOR[selectedInvoice.status] || "#6B7280",
                  padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700
                }}>
                  {STATUS_AR[selectedInvoice.status] || "حالة غير معروفة"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href={`/${locale}/sales/invoices/${selectedInvoice.id}`} target="_blank"
                  className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}>
                  🔗 {ar ? "صفحة كاملة" : "Full page"}
                </Link>
                <button className="btn btn-ghost btn-icon" onClick={() => setSelectedInvoice(null)}>✕</button>
              </div>
            </div>

            <div style={{ padding: "20px 24px" }}>

              {/* معلومات */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20, background: "#F8FAFC", borderRadius: 10, padding: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 3 }}>{ar ? "المندوب" : "Rep"}</div>
                  <div style={{ fontWeight: 700 }}>{repMap[selectedInvoice.rep_id]?.full_name || "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{repMap[selectedInvoice.rep_id]?.zone}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 3 }}>{ar ? "العميل" : "Customer"}</div>
                  <div style={{ fontWeight: 700 }}>{selectedInvoice.buyer_name_ar || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 3 }}>{ar ? "طريقة الدفع" : "Payment"}</div>
                  <div style={{ fontWeight: 600 }}>
                    {PAY_AR[selectedInvoice.invoice_payment_method] || "—"}
                    {selectedInvoice.credit_days ? ` (${selectedInvoice.credit_days} ${ar ? "يوم" : "d"})` : ""}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 3 }}>{ar ? "تاريخ الإصدار" : "Issue Date"}</div>
                  <div style={{ fontWeight: 600 }}>{fmtD(selectedInvoice.issue_date)}</div>
                </div>
                {selectedInvoice.due_date && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 3 }}>{ar ? "الاستحقاق" : "Due Date"}</div>
                    <div style={{ fontWeight: 600, color: "#D97706" }}>{fmtD(selectedInvoice.due_date)}</div>
                  </div>
                )}
                {selectedInvoice.notes && (
                  <div style={{ gridColumn: "1/-1" }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 3 }}>{ar ? "ملاحظات" : "Notes"}</div>
                    <div style={{ fontSize: 13 }}>{selectedInvoice.notes}</div>
                  </div>
                )}
                {selectedInvoice.status === "rejected" && selectedInvoice.rejection_note && (
                  <div style={{ gridColumn: "1/-1", background: "#FEF2F2", borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 700, marginBottom: 3 }}>{ar ? "سبب الرفض" : "Rejection Reason"}</div>
                    <div style={{ fontSize: 13, color: "#DC2626" }}>{selectedInvoice.rejection_note}</div>
                  </div>
                )}
              </div>

              {/* الأسطر */}
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{ar ? "أسطر الفاتورة" : "Invoice Lines"}</div>
              {(selectedInvoice.lines || []).length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 20, fontSize: 13, background: "#F8FAFC", borderRadius: 8 }}>
                  {ar ? "لا توجد أسطر مفصّلة — افتح الصفحة الكاملة" : "No lines detail — open full page"}
                </div>
              ) : (
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC" }}>
                        <th style={{ padding: "10px 12px", textAlign: "start", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>#</th>
                        <th style={{ padding: "10px 12px", textAlign: "start", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "الوصف" : "Description"}</th>
                        <th style={{ padding: "10px 12px", textAlign: "end", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "الكمية" : "Qty"}</th>
                        <th style={{ padding: "10px 12px", textAlign: "end", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "السعر" : "Price"}</th>
                        <th style={{ padding: "10px 12px", textAlign: "end", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "الضريبة" : "VAT"}</th>
                        <th style={{ padding: "10px 12px", textAlign: "end", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{ar ? "الإجمالي" : "Total"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedInvoice.lines || []).map((line: any, i: number) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)" }}>{i + 1}</td>
                          <td style={{ padding: "8px 12px", fontWeight: 500 }}>{line.description_ar}</td>
                          <td style={{ padding: "8px 12px", textAlign: "end" }}>{fmt(line.quantity)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "end" }}>{fmt(line.unit_price)} SAR</td>
                          <td style={{ padding: "8px 12px", textAlign: "end", color: "#D97706" }}>{fmt(line.vat_amount)} SAR</td>
                          <td style={{ padding: "8px 12px", textAlign: "end", fontWeight: 700 }}>{fmt(line.total)} SAR</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* الإجماليات */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ minWidth: 280, display: "flex", flexDirection: "column", gap: 8, background: "#F8FAFC", borderRadius: 10, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{ar ? "قبل الضريبة" : "Subtotal"}</span>
                    <span>{fmt(selectedInvoice.subtotal)} SAR</span>
                  </div>
                  {Number(selectedInvoice.discount_amount) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#DC2626" }}>{ar ? "الخصم" : "Discount"}</span>
                      <span style={{ color: "#DC2626" }}>- {fmt(selectedInvoice.discount_amount)} SAR</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#D97706" }}>
                    <span>{ar ? "الضريبة" : "VAT"}</span>
                    <span>{fmt(selectedInvoice.vat_amount)} SAR</span>
                  </div>
                  <div style={{ height: 1, background: "var(--border)" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 800 }}>
                    <span>{ar ? "الإجمالي" : "Total"}</span>
                    <span style={{ color: "var(--primary)" }}>{fmt(selectedInvoice.total)} SAR</span>
                  </div>
                  {Number(selectedInvoice.paid_amount) > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6F4A84" }}>
                        <span>{ar ? "المدفوع" : "Paid"}</span>
                        <span>{fmt(selectedInvoice.paid_amount)} SAR</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700,
                        color: (Number(selectedInvoice.total) - Number(selectedInvoice.paid_amount)) > 0.01 ? "#DC2626" : "#6F4A84" }}>
                        <span>{ar ? "المتبقي" : "Remaining"}</span>
                        <span>{fmt(Math.max(0, Number(selectedInvoice.total) - Number(selectedInvoice.paid_amount)))} SAR</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
