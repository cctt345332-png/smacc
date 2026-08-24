export type InvoiceStatusPresentation = {
  ar: string;
  en: string;
  badge: string;
};

/** حالات تملك أثرًا ماليًا فعليًا بعد التأكيد أو التحصيل. */
export const FINANCIAL_INVOICE_STATUSES = [
  "confirmed",
  "paid",
  "partial",
  "overdue",
] as const;

export const isFinancialInvoiceStatus = (status?: string | null): boolean =>
  FINANCIAL_INVOICE_STATUSES.includes(status as (typeof FINANCIAL_INVOICE_STATUSES)[number]);

export const INVOICE_STATUS_PRESENTATION: Record<string, InvoiceStatusPresentation> = {
  draft: { ar: "مسودة", en: "Draft", badge: "badge-gray" },
  submitted: { ar: "بانتظار المراجعة", en: "Pending review", badge: "badge-warning" },
  approved: { ar: "تمت الموافقة", en: "Approved", badge: "badge-info" },
  rejected: { ar: "معادة للمندوب", en: "Returned to rep", badge: "badge-danger" },
  confirmed: { ar: "مؤكدة", en: "Confirmed", badge: "badge-info" },
  paid: { ar: "مدفوعة", en: "Paid", badge: "badge-success" },
  partial: { ar: "مدفوعة جزئيًا", en: "Partially paid", badge: "badge-warning" },
  overdue: { ar: "متأخرة السداد", en: "Overdue", badge: "badge-danger" },
  cancelled: { ar: "ملغاة", en: "Cancelled", badge: "badge-danger" },
  sent: { ar: "مرسلة", en: "Sent", badge: "badge-info" },
  zatca_pending: { ar: "بانتظار معالجة زاتكا", en: "ZATCA pending", badge: "badge-warning" },
  zatca_cleared: { ar: "مقبولة من زاتكا", en: "ZATCA cleared", badge: "badge-success" },
  zatca_rejected: { ar: "مرفوضة من زاتكا", en: "ZATCA rejected", badge: "badge-danger" },
};

export const invoiceStatusText = (status?: string | null, locale = "ar"): string => {
  const presentation = INVOICE_STATUS_PRESENTATION[status || ""];
  if (!presentation) return locale === "ar" ? "حالة غير معروفة" : "Unknown status";
  return locale === "ar" ? presentation.ar : presentation.en;
};

export const invoiceStatusBadge = (status?: string | null): string =>
  INVOICE_STATUS_PRESENTATION[status || ""]?.badge || "badge-gray";
