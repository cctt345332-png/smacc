"use client";;
import { use } from "react";

import CommercialPrintPage from "@/components/documents/CommercialPrintPage";

export default function ExpensePrintPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  return <CommercialPrintPage source="expense" locale={locale} id={id} />;
}
