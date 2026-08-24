"use client";

import { useEffect, useState } from "react";
import { getCompany } from "@/lib/settings";

export default function ReportPrintFrame({ locale }: { locale: string }) {
  const ar = locale === "ar";
  const [company, setCompany] = useState<any>(null);
  useEffect(() => { getCompany().then(({ data }) => setCompany(data)).catch(() => {}); }, []);
  const generatedAt = new Date().toLocaleString(ar ? "ar-SA" : "en-GB");
  return (
    <div className="report-print-frame" dir={ar ? "rtl" : "ltr"}>
      <div className="report-print-brand">
        {company?.logo_data && <img src={company.logo_data} alt="Logo" />}
        <div><strong>{company?.name || company?.name_ar || "SMACC"}</strong><span>{ar ? "تقارير مالية وتشغيلية" : "Financial & operational reports"}</span></div>
      </div>
      <div className="report-print-meta"><strong>{ar ? "تقرير نظام SMACC" : "SMACC system report"}</strong><span>{ar ? `تاريخ الطباعة: ${generatedAt}` : `Printed: ${generatedAt}`}</span></div>
    </div>
  );
}
