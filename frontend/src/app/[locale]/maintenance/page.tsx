"use client";

import { use } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icons";

export default function MaintenancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const ar = locale === "ar";
  const cards = [
    { href: `/${locale}/pos/maintenance-management?view=tickets`, title: ar ? "طلبات وتذاكر الصيانة" : "Requests & Tickets", text: ar ? "إضافة الأجهزة، متابعة الحالات، العملاء والمندوبين" : "Add devices, track status, customers, and reps", icon: "receipt" },
    { href: `/${locale}/maintenance/warehouses`, title: ar ? "مستودعات الصيانة" : "Maintenance Warehouses", text: ar ? "ربط مستودع مستقل بكل جهاز كاشير" : "Link an isolated warehouse to each POS terminal", icon: "inventory" },
    { href: `/${locale}/pos/maintenance`, title: ar ? "تشغيل الصيانة من الكاشير" : "Maintenance Counter", text: ar ? "إضافة القطع والتحصيل من نفس جلسة الكاشير" : "Add parts and collect from the same cashier session", icon: "pos" },
    { href: `/${locale}/pos/maintenance-management?view=report`, title: ar ? "التقرير والعهدة" : "Report & Custody", text: ar ? "القطع، الأجور، التحصيل والمتبقي حسب الجهاز" : "Parts, fees, collections, and balances by terminal", icon: "reports" },
  ];
  return <div dir={ar ? "rtl" : "ltr"}><div className="page-header"><div><div className="breadcrumb"><span>{ar ? "الإدارة" : "Administration"}</span><span className="breadcrumb-sep">/</span><span>{ar ? "الصيانة" : "Maintenance"}</span></div><h1 className="page-title">{ar ? "إدارة الصيانة" : "Maintenance Management"}</h1><p className="page-subtitle">{ar ? "مودول مستقل لإدارة أجهزة العملاء وطلبات الصيانة والقطع والتحصيل" : "Independent module for customer devices, service requests, parts, and collections"}</p></div></div><div className="grid-2">{cards.map((card) => <Link key={card.href} href={card.href} className="card" style={{ padding: 22, textDecoration: "none", color: "inherit" }}><div style={{ display: "flex", gap: 14, alignItems: "start" }}><div style={{ color: "var(--primary)" }}><Icon name={card.icon as any} size={25} /></div><div><h3 className="card-title" style={{ marginBottom: 8 }}>{card.title}</h3><p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>{card.text}</p></div></div></Link>)}</div></div>;
}
