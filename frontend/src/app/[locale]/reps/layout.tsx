"use client";
import { usePathname } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";

export default function RepsLayout({ children, params: { locale } }: { children: React.ReactNode; params: { locale: string } }) {
  const pathname = usePathname();
  // صفحات /reps/me/* تستخدم RepLayout الخاص بها — لا تحتاج AppLayout
  if (pathname.includes("/reps/me")) {
    return <>{children}</>;
  }
  return <AppLayout locale={locale}>{children}</AppLayout>;
}
