"use client";
import { usePathname } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";

export default function SalesLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const pathname = usePathname();
  // صفحات /print تُطبع مستقلة — بدون sidebar أو header
  if (pathname.endsWith("/print")) {
    return <>{children}</>;
  }
  return <AppLayout locale={locale}>{children}</AppLayout>;
}
