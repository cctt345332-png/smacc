"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getVouchers, postVoucher, cancelVoucher } from "@/lib/treasury";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const STATUS = { draft: { ar: "مسودة", badge: "badge-warning" }, posted: { ar: "مرحّل", badge: "badge-success" }, cancelled: { ar: "ملغي", badge: "badge-danger" } };
const CATS: Record<string, string> = { rent: "إيجار", utilities: "كهرباء وماء", salaries: "رواتب", maintenance: "صيانة", transport: "مواصلات", marketing: "تسويق", office: "مستلزمات مكتبية", insurance: "تأمين", government: "رسوم حكومية", other: "أخرى" };

export default function ExpensesPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    try { const { data } = await getVouchers({ voucher_type: "expense" }); setItems(data); }
    catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handle = async (fn: () => Promise<any>, id: string) => {
    setActing(id);
    try { await fn(); load(); } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(null); }
  };

  const totalPosted = items.filter(i => i.status === "posted").reduce((s, i) => s + Number(i.amount), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "المصروفات" : "Expenses"}</span>
          </div>
          <h1 className="page-title">{ar ? "المصروفات" : "Expenses"}</h1>
          <p className="page-subtitle">{ar ? "تسجيل المصروفات التشغيلية" : "Record operational expenses"}</p>
        </div>
        <Link href={`/${locale}/treasury/expenses/new`} className="btn btn-primary btn-sm">
          <Icon name="plus" size={14} /> {ar ? "مصروف جديد" : "New Expense"}
        </Link>
      </div>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          { label: ar ? "إجمالي المصروفات" : "Total Expenses", value: `${fmt(totalPosted)} SAR`, color: "#DC2626" },
          { label: ar ? "عدد المصروفات" : "Count", value: items.length, color: "#5A187E" },
          { label: ar ? "مسودة" : "Draft", value: items.filter(i => i.status === "draft").length, color: "#D97706" },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.color + "18", color: s.color }}><Icon name="trendingDown" size={20} /></div>
            <div className="stat-content">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color, fontSize: 18 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          : items.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}><Icon name="receipt" size={24} /></div>
              <div className="empty-state-title">{ar ? "لا توجد مصروفات" : "No expenses"}</div>
              <Link href={`/${locale}/treasury/expenses/new`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>+ {ar ? "مصروف جديد" : "New"}</Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم السند" : "Voucher #"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "الفئة" : "Category"}</th>
                  <th>{ar ? "البيان" : "Description"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المبلغ" : "Amount"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الضريبة" : "VAT"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(v => {
                  const s = STATUS[v.status as keyof typeof STATUS] || { ar: v.status, badge: "badge-gray" };
                  return (
                    <tr key={v.id}>
                      <td><Link href={`/${locale}/treasury/expenses/${v.id}`} style={{ fontWeight: 700, color: "#DC2626", textDecoration: "none" }}>{v.voucher_number}</Link></td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(v.voucher_date).toLocaleDateString("en-SA")}</td>
                      <td style={{ fontSize: 12 }}>{v.expense_category ? (ar ? CATS[v.expense_category] || v.expense_category : v.expense_category) : "—"}</td>
                      <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{v.description_ar}</td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(v.amount)}</td>
                      <td style={{ textAlign: "end", color: "#D97706" }}>{Number(v.vat_amount) > 0 ? fmt(v.vat_amount) : "—"}</td>
                      <td><span className={`badge ${s.badge}`}>{s.ar}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Link href={`/${locale}/treasury/expenses/${v.id}`} className="btn btn-ghost btn-sm btn-icon"><Icon name="view" size={14} /></Link>
                          {v.status === "draft" && <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "#6F4A84" }} onClick={() => handle(() => postVoucher(v.id), v.id)} disabled={acting === v.id}><Icon name="check" size={14} /></button>}
                          {v.status === "draft" && <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "var(--danger)" }} onClick={() => handle(() => cancelVoucher(v.id), v.id)} disabled={acting === v.id}><Icon name="cancel" size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
