"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import api from "./api";

/**
 * useAIContext — يجمع بيانات الصفحة الحالية ويرسلها للـ AI
 * المستوى 1: Context Awareness
 */
export function useAIContext() {
  const pathname = usePathname();
  const { plan, businessType } = useAuthStore();
  const [contextData, setContextData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!pathname) return;

    const base: Record<string, any> = {
      current_page: pathname,
      business_type: businessType,
      plan: plan,
      page_data: {},
    };

    // جلب بيانات حسب الصفحة الحالية
    const loadPageData = async () => {
      try {
        // ── صفحات المبيعات ────────────────────────────────────────
        if (pathname.includes("/sales/invoices")) {
          const [summary, overdue] = await Promise.all([
            api.get("/sales/invoices/summary").catch(() => null),
            api.get("/sales/invoices?status=overdue").catch(() => null),
          ]);
          base.page_data = {
            total_sales: summary?.data?.total_this_month,
            overdue_count: overdue?.data?.length || 0,
          };
          // جلب أحدث العملاء للاقتراح
          const customers = await api.get("/sales/customers").catch(() => null);
          if (customers?.data?.length) {
            base.page_data.customers = customers.data.slice(0, 5);
          }
        }

        // ── صفحات المشتريات ───────────────────────────────────────
        else if (pathname.includes("/purchases")) {
          const vendors = await api.get("/purchases/vendors").catch(() => null);
          if (vendors?.data?.length) {
            base.page_data.vendors = vendors.data.slice(0, 5);
          }
        }

        // ── صفحات المخزون ─────────────────────────────────────────
        else if (pathname.includes("/inventory")) {
          const alerts = await api.get("/inventory/alerts/low-stock").catch(() => null);
          base.page_data.low_stock_count = alerts?.data?.length || 0;
          if (alerts?.data?.length) {
            base.page_data.low_stock_items = alerts.data.slice(0, 3).map((i: any) => i.name_ar);
          }
        }

        // ── صفحات POS ─────────────────────────────────────────────
        else if (pathname.includes("/pos")) {
          const terminals = await api.get("/pos/terminals").catch(() => null);
          if (terminals?.data?.length) {
            const terminal = terminals.data[0];
            const session = await api.get(`/pos/sessions/active?terminal_id=${terminal.id}`).catch(() => null);
            if (session?.data) {
              base.page_data.open_session = `جلسة مفتوحة — ${terminal.name}`;
            }
          }
        }

        // ── صفحات المحاسبة ────────────────────────────────────────
        else if (pathname.includes("/accounting")) {
          // تحقق من وجود سنة مالية
          const fy = await api.get("/accounting/fiscal-years").catch(() => null);
          if (!fy?.data?.length) {
            base.page_data.no_fiscal_year = true;
          }
        }

        // ── صفحات HR ──────────────────────────────────────────────
        else if (pathname.includes("/hr")) {
          const summary = await api.get("/hr/summary").catch(() => null);
          if (summary?.data) {
            base.page_data.pending_leaves = summary.data.pending_leaves || 0;
            base.page_data.total_employees = summary.data.total_employees || 0;
          }
        }

        // ── لوحة التحكم ───────────────────────────────────────────
        else if (pathname.includes("/dashboard")) {
          const [salesSummary, lowStock] = await Promise.all([
            api.get("/sales/invoices/summary").catch(() => null),
            api.get("/inventory/alerts/low-stock").catch(() => null),
          ]);
          base.page_data = {
            total_sales: salesSummary?.data?.total_this_month,
            low_stock_count: lowStock?.data?.length || 0,
          };
        }

      } catch {
        // تجاهل الأخطاء — context_data اختياري
      }

      setContextData(base);
    };

    loadPageData();
  }, [pathname, plan, businessType]);

  return contextData;
}

/**
 * buildContextData — يبني context_data من بيانات جاهزة
 * للاستخدام في الصفحات التي تريد تمرير بيانات محددة
 */
export function buildContextData(
  pathname: string,
  plan: string,
  businessType: string,
  pageData: Record<string, any> = {},
  recentActions: string[] = [],
): Record<string, any> {
  return {
    current_page: pathname,
    business_type: businessType,
    plan,
    page_data: pageData,
    recent_actions: recentActions,
  };
}
