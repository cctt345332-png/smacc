"use client";;
import { use } from "react";

import CommercialPrintPage from "@/components/documents/CommercialPrintPage";

export default function QuotationPrintPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  return <CommercialPrintPage source="quotation" locale={locale} id={id} />;
}
