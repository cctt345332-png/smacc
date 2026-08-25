"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getJournalEntries, postJournalEntry, cancelJournalEntry, reverseJournalEntry } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";

const STATUS_COLORS: Record<string, string> = {
  draft: "badge-warning", posted: "badge-success", cancelled: "badge-danger",
};
const STATUS_AR: Record<string, string> = {
  draft: "مسودة", posted: "مرحّل", cancelled: "ملغي",
};

export default function JournalPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  const load = async () => {
    try {
      const { data } = await getJournalEntries(filterStatus ? { status: filterStatus } : {});
      setEntries(data);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus]);

  const handlePost = async (id: string) => {
    if (!confirm(ar ? "ترحيل القيد؟ لا يمكن التراجع." : "Post this entry? Cannot be undone.")) return;
    try { await postJournalEntry(id); load(); } catch (e: any) { alert(e?.response?.data?.detail); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm(ar ? "إلغاء القيد؟" : "Cancel this entry?")) return;
    try { await cancelJournalEntry(id); load(); } catch (e: any) { alert(e?.response?.data?.detail); }
  };

  const handleReverse = async (id: string) => {
    if (!confirm(ar ? "إنشاء قيد عكسي؟" : "Create reversal entry?")) return;
    try { await reverseJournalEntry(id); load(); } catch (e: any) { alert(e?.response?.data?.detail); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "قيود اليومية" : "Journal Entries"}</span>
          </div>
          <h1 className="page-title">{ar ? "قيود اليومية" : "Journal Entries"}</h1>
          <p className="page-subtitle">{ar ? "إدارة القيود المحاسبية اليومية" : "Manage daily accounting entries"}</p>
        </div>
        <Link href={`/${locale}/accounting/journal/new`} className="btn btn-primary btn-sm">
          + {ar ? "قيد جديد" : "New Entry"}
        </Link>
      </div>

      {/* Stats */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          { label: ar ? "مسودة" : "Draft", status: "draft", color: "#D97706", icon: "draft" as const },
          { label: ar ? "مرحّلة" : "Posted", status: "posted", color: "#059669", icon: "check" as const },
          { label: ar ? "ملغاة" : "Cancelled", status: "cancelled", color: "#DC2626", icon: "cancel" as const },
        ].map(s => (
          <div key={s.status} className="stat-card" style={{ cursor: "pointer" }} onClick={() => setFilterStatus(filterStatus === s.status ? "" : s.status)}>
            <div className="stat-icon" style={{ background: s.color + "18", color: s.color }}><Icon name={s.icon} size={20} /></div>
            <div className="stat-content">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{entries.filter(e => e.status === s.status).length}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
          <select className="form-input form-select" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">{ar ? "كل الحالات" : "All Status"}</option>
            <option value="draft">{ar ? "مسودة" : "Draft"}</option>
            <option value="posted">{ar ? "مرحّل" : "Posted"}</option>
            <option value="cancelled">{ar ? "ملغي" : "Cancelled"}</option>
          </select>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {entries.length} {ar ? "قيد" : "entries"}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border)", margin: "0 auto 12px" }} /></div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border)", margin: "0 auto 12px" }} />
              <div className="empty-state-title">{ar ? "لا توجد قيود" : "No journal entries"}</div>
              <Link href={`/${locale}/accounting/journal/new`} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                + {ar ? "قيد جديد" : "New Entry"}
              </Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم القيد" : "Entry #"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "البيان" : "Description"}</th>
                  <th>{ar ? "المرجع" : "Reference"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "إجمالي المدين" : "Total Debit"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "إجمالي الدائن" : "Total Credit"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/${locale}/accounting/journal/${e.id}`} style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none", fontSize: 13 }}>
                        {e.entry_number}
                      </Link>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {new Date(e.entry_date).toLocaleDateString("en-SA")}
                    </td>
                    <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.description_ar}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{e.reference || "—"}</td>
                    <td style={{ textAlign: "end", fontWeight: 600, color: "#587795" }}>
                      {Number(e.total_debit).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: "end", fontWeight: 600, color: "#059669" }}>
                      {Number(e.total_credit).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td><span className={`badge ${STATUS_COLORS[e.status]}`}>{ar ? STATUS_AR[e.status] : e.status}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Link href={`/${locale}/accounting/journal/${e.id}`} className="btn btn-ghost btn-sm" title={ar ? "عرض" : "View"}>{ar ? "عرض" : "View"}</Link>
                        {e.status === "draft" && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handlePost(e.id)} title={ar ? "ترحيل" : "Post"}>{ar ? "ترحيل" : "Post"}</button>
                        )}
                        {e.status === "draft" && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleCancel(e.id)} title={ar ? "إلغاء" : "Cancel"}>{ar ? "إلغاء" : "Cancel"}</button>
                        )}
                        {e.status === "posted" && (
                          <button className="btn btn-ghost btn-sm" onClick={() => handleReverse(e.id)} title={ar ? "عكس" : "Reverse"}>{ar ? "عكس" : "Reverse"}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
