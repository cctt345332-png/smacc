"use client";;
import { use } from "react";
import { usePathname } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";

export default function RepsLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const {
    children
  } = props;

  const pathname = usePathname();
  // صفحات /reps/me/* تستخدم RepLayout الخاص بها — لا تحتاج AppLayout
  if (pathname.includes("/reps/me")) {
    return <>{children}</>;
  }
  return <AppLayout locale={locale}>{children}</AppLayout>;
}
