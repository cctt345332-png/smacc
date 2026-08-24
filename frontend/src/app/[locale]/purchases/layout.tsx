"use client";;
import { use } from "react";
import { usePathname } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";

export default function PurchasesLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
  }
) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const {
    children
  } = props;

  const pathname = usePathname();
  // صفحات /print تُطبع مستقلة — بدون sidebar أو header
  if (pathname.endsWith("/print")) {
    return <>{children}</>;
  }
  return <AppLayout locale={locale}>{children}</AppLayout>;
}
