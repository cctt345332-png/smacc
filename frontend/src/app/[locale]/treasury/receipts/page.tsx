"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getVouchers, postVoucher, cancelVoucher, getTreasurySummary } from "@/lib/treasury";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const STATUS = { draft: { ar: "مسودة", badge: "badge-warning" }, posted: { ar: "مرحّل", badge: "badge-success" }, cancelled: { ar: "ملغي", badge: "badge-danger" } };
const METHODS: Record<string, string> = { cash: "نقداً", bank_transfer: "تحويل بنكي", cheque: "شيك", mada: "مدى", stc_pay: "STC Pay", credit_card: "بطاقة" };

export default function ReceiptsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    try {
      const [v, s] = await Promise.all([getVouchers({ voucher_type: "receipt" }), getTreasurySummary()]);
      setItems(v.data); setSummary(s.data);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handle = async (fn: () => Promise<any>, id: string) => {
    setActing(id);
    try { await fn(); load(); } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(null); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "سندات القبض" : "Receipt Vouchers"}</span>
          </div>
          <h1 className="page-title">{ar ? "سندات القبض" : "Receipt Vouchers"}</h1>
          <p className="page-subtitle">{ar ? "تسجيل المبالغ المستلمة" : "Record received amounts"}</p>
        </div>
        <Link href={`/${locale}/treasury/receipts/new`} className="btn btn-primary btn-sm">
          <Icon name="plus" size={14} /> {ar ? "سند قبض جديد" : "New Receipt"}
        </Link>
      </div>

      {summary && (
        <div className="grid-3" style={{ marginBottom: 20 }}>
          {[
            { label: ar ? "إجمالي المقبوضات" : "Total Receipts", value: summary.total_receipts, color: "#059669" },
            { label: ar ? "عدد السندات" : "Count", value: items.length, color: "#5A187E" },
            { label: ar ? "مسودة" : "Draft", value: items.filter(i => i.status === "draft").length, color: "#D97706" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: s.color + "18", color: s.color }}><Icon name="wallet" size={20} /></div>
              <div className="stat-content">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{typeof s.value === "number" && s.value > 999 ? `${fmt(s.value)} SAR` : s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          : items.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", margin: "0 auto 12px" }}><Icon name="wallet" size={24} /></div>
              <div className="empty-state-title">{ar ? "لا توجد سندات قبض" : "No receipt vouchers"}</div>
              <Link href={`/${locale}/treasury/receipts/new`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>+ {ar ? "سند جديد" : "New"}</Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم السند" : "Voucher #"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "الجهة" : "Party"}</th>
                  <th>{ar ? "البيان" : "Description"}</th>
                  <th>{ar ? "طريقة الدفع" : "Method"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المبلغ" : "Amount"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(v => {
                  const s = STATUS[v.status as keyof typeof STATUS] || { ar: v.status, badge: "badge-gray" };
                  return (
                    <tr key={v.id}>
                      <td><Link href={`/${locale}/treasury/receipts/${v.id}`} style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}>{v.voucher_number}</Link></td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(v.voucher_date).toLocaleDateString("en-SA")}</td>
                      <td style={{ fontSize: 13 }}>{v.party_name || "—"}</td>
                      <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{v.description_ar}</td>
                      <td style={{ fontSize: 12 }}>{ar ? METHODS[v.payment_method] || v.payment_method : v.payment_method}</td>
                      <td style={{ textAlign: "end", fontWeight: 700, color: "#059669" }}>{fmt(v.amount)} SAR</td>
                      <td><span className={`badge ${s.badge}`}>{s.ar}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Link href={`/${locale}/treasury/receipts/${v.id}`} className="btn btn-ghost btn-sm btn-icon"><Icon name="view" size={14} /></Link>
                          {v.status === "draft" && <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "#059669" }} onClick={() => handle(() => postVoucher(v.id), v.id)} disabled={acting === v.id}><Icon name="check" size={14} /></button>}
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
