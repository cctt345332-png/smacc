"use client";;
import { use } from "react";

import CommercialPrintPage from "@/components/documents/CommercialPrintPage";

export default function SalesOrderPrintPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  return <CommercialPrintPage source="sales_order" locale={locale} id={id} />;
}
