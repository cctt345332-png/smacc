"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getVoucher, postVoucher, cancelVoucher } from "@/lib/treasury";
import { getCompany } from "@/lib/settings";
import { Icon } from "@/components/ui/Icons";
import SellerBlock from "@/components/documents/SellerBlock";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const STATUS = {
  draft:     { ar: "مسودة", badge: "badge-warning" },
  posted:    { ar: "مرحّل", badge: "badge-success" },
  cancelled: { ar: "ملغي",  badge: "badge-danger" },
};

export default function TransferDetailPage(props: { params: Promise<{ locale: string; id: string }> }) {
  const params = use(props.params);

  const {
    locale,
    id
  } = params;

  const ar = locale === "ar";
  const [voucher, setVoucher] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = async () => {
    try {
      const [vRes, cRes] = await Promise.all([getVoucher(id), getCompany()]);
      setVoucher(vRes.data); setCompany(cRes.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handlePost = async () => {
    if (!confirm(ar ? "ترحيل التحويل؟" : "Post this transfer?")) return;
    setActing(true);
    try { await postVoucher(id); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(false); }
  };

  const handleCancel = async () => {
    if (!confirm(ar ? "إلغاء التحويل؟" : "Cancel this transfer?")) return;
    setActing(true);
    try { await cancelVoucher(id); load(); }
    catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setActing(false); }
  };

  if (loading) return <div className="empty-state" style={{ minHeight: "60vh" }}><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;
  if (!voucher) return (
    <div className="empty-state" style={{ minHeight: "60vh" }}>
      <div className="empty-state-title">{ar ? "التحويل غير موجود" : "Transfer not found"}</div>
      <Link href={`/${locale}/treasury/transfers`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>{ar ? "العودة" : "Back"}</Link>
    </div>
  );

  const status = STATUS[voucher.status as keyof typeof STATUS] || { ar: voucher.status, badge: "badge-gray" };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/treasury/transfers`}>{ar ? "التحويلات البنكية" : "Transfers"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{voucher.voucher_number}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <h1 className="page-title">{voucher.voucher_number}</h1>
            <span className={`badge ${status.badge}`}>{status.ar}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <StructuredReportPrintButton locale={locale} title={ar ? "سند تحويل بنكي" : "Bank Transfer Voucher"} subtitle={ar ? "مستند تحويل خزينة" : "Treasury transfer document"} period={new Date(voucher.voucher_date).toLocaleDateString("en-SA")} reportCode={voucher.voucher_number} metrics={[{ label: ar ? "مبلغ التحويل" : "Transfer amount", value: `${fmt(voucher.amount)} SAR`, tone: "blue" }, { label: ar ? "الحالة" : "Status", value: status.ar, tone: voucher.status === "posted" ? "green" : voucher.status === "cancelled" ? "red" : "amber" }]} tables={[{ headers: [ar ? "البيان" : "Description", ar ? "المرجع" : "Reference", ar ? "ملاحظات" : "Notes", ar ? "القيد" : "Journal entry"], rows: [[String(voucher.description_ar || "—"), String(voucher.reference || "—"), String(voucher.notes || "—"), voucher.journal_entry_id ? (ar ? "مرتبط بقيد" : "Linked") : (ar ? "غير مرحّل" : "Not posted")]] }]} />
          {voucher.status === "draft" && (
            <>
              <button className="btn btn-primary btn-sm" onClick={handlePost} disabled={acting}>
                <Icon name="check" size={14} /> {ar ? "ترحيل" : "Post"}
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleCancel} disabled={acting}>
                <Icon name="cancel" size={14} /> {ar ? "إلغاء" : "Cancel"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        {/* Header */}
        <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border)", background: "#EFF6FF" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              {company?.logo_data && <img src={company.logo_data} alt="Logo" style={{ height: 48, objectFit: "contain", borderRadius: 6 }} />}
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#485668" }}>
                  {ar ? "تحويل بنكي" : "Bank Transfer — تحويل بنكي"}
                </div>
                <span className={`badge ${status.badge}`} style={{ marginTop: 4 }}>{status.ar}</span>
              </div>
            </div>
            <div style={{ textAlign: "end" }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{voucher.voucher_number}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {ar ? "التاريخ:" : "Date:"} {new Date(voucher.voucher_date).toLocaleDateString("en-SA")}
              </div>
            </div>
          </div>
        </div>

        {/* Company */}
        <div style={{ padding: "18px 28px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.08em" }}>
            {ar ? "الشركة" : "Company"}
          </div>
          <SellerBlock company={company} ar={ar} />
        </div>

        {/* Amount */}
        <div style={{ padding: "28px", display: "flex", justifyContent: "center" }}>
          <div style={{ textAlign: "center", background: "#EFF6FF", borderRadius: 12, padding: "24px 48px", border: "2px solid #BFDBFE" }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>{ar ? "مبلغ التحويل" : "Transfer Amount"}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#485668" }}>{fmt(voucher.amount)}</div>
            <div style={{ fontSize: 14, color: "#485668", marginTop: 4 }}>SAR</div>
          </div>
        </div>

        {/* Description */}
        <div style={{ padding: "0 28px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.06em" }}>
            {ar ? "البيان" : "Description"}
          </div>
          <div style={{ fontSize: 14 }}>{voucher.description_ar}</div>
          {voucher.reference && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
              {ar ? "المرجع:" : "Reference:"} {voucher.reference}
            </div>
          )}
          {voucher.notes && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              {ar ? "ملاحظات:" : "Notes:"} {voucher.notes}
            </div>
          )}
        </div>

        {voucher.journal_entry_id && (
          <div style={{ padding: "12px 28px", borderTop: "1px solid var(--border)", background: "#F8FAFC" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{ar ? "القيد المحاسبي:" : "Journal Entry:"} </span>
            <Link href={`/${locale}/accounting/journal`} style={{ fontSize: 12, color: "var(--primary)" }}>
              {ar ? "عرض القيد" : "View Entry"}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
