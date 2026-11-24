"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { getCompany } from "@/lib/settings";
import MaintenanceA4Print from "@/components/pos/MaintenanceA4Print";

export default function POSMaintenancePrintPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = use(params);
  const query = useSearchParams();
  const documentType = query.get("document") === "inspection" ? "inspection" : "intake";
  const [ticket, setTicket] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([api.get(`/pos/maintenance/${id}`), getCompany()])
      .then(([ticketResult, companyResult]) => { setTicket(ticketResult.data); setCompany(companyResult.data); })
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { if (ticket) { const timer = window.setTimeout(() => window.print(), 600); return () => window.clearTimeout(timer); } }, [ticket]);
  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>جاري تجهيز المستند...</div>;
  if (!ticket) return <div style={{ padding: 40, textAlign: "center" }}>تذكرة الصيانة غير موجودة</div>;
  return <MaintenanceA4Print ticket={ticket} company={company} document={documentType} />;
}
