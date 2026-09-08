"use client";

import { use } from "react";
import MaintenanceWorkspace from "@/components/MaintenanceWorkspace";

export default function RepMaintenancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  return <MaintenanceWorkspace locale={locale} repOnly />;
}
