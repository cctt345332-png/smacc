"use client";
import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import api from "@/lib/api";

const IcDownload = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IcUpload   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const IcShield   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcClock    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcCheck    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcTrash    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const IcRefresh  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.08-4.43"/></svg>;
const IcInfo     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
const IcWarning  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;

export default function BackupPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [backups, setBackups]         = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [creating, setCreating]       = useState(false);
  const [restoring, setRestoring]     = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [deleting, setDeleting]       = useState<string | null>(null);
  const [message, setMessage]         = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const load = async () => {
    try {
      const { data } = await api.get("/settings/backup/list");
      setBackups(data || []);
    } catch {
      setBackups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // إنشاء نسخة احتياطية
  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data } = await api.post("/settings/backup/create");
      showMsg("success", ar ? `تم إنشاء النسخة الاحتياطية: ${data.filename} (${data.size})` : `Backup created: ${data.filename} (${data.size})`);
      await load();
    } catch (err: any) {
      showMsg("error", err?.response?.data?.detail || (ar ? "فشل إنشاء النسخة الاحتياطية" : "Backup creation failed"));
    } finally {
      setCreating(false); }
  };

  // تنزيل نسخة احتياطية
  const handleDownload = (filename: string) => {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = (window as any).__authToken || localStorage.getItem("erp-auth")
      ? JSON.parse(localStorage.getItem("erp-auth") || "{}").state?.token
      : null;

    const link = document.createElement("a");
    link.href = `${baseURL}/settings/backup/download/${filename}`;
    link.download = filename;
    if (token) {
      // فتح في tab جديد مع token في header — نستخدم fetch بدلاً
      fetch(link.href, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        });
    } else {
      link.click();
    }
  };

  // استعادة نسخة احتياطية
  const handleRestore = async (filename: string) => {
    setRestoring(filename);
    setConfirmRestore(null);
    try {
      const { data } = await api.post(`/settings/backup/restore/${filename}`);
      showMsg("success", ar ? "تمت الاستعادة بنجاح. يرجى إعادة تسجيل الدخول." : "Restore successful. Please log in again.");
      setTimeout(() => window.location.href = `/${locale}/login`, 3000);
    } catch (err: any) {
      showMsg("error", err?.response?.data?.detail || (ar ? "فشلت الاستعادة" : "Restore failed"));
    } finally {
      setRestoring(null);
    }
  };

  // حذف نسخة احتياطية
  const handleDelete = async (filename: string) => {
    setDeleting(filename);
    try {
      await api.delete(`/settings/backup/${filename}`);
      showMsg("success", ar ? "تم حذف النسخة الاحتياطية" : "Backup deleted");
      await load();
    } catch {
      showMsg("error", ar ? "فشل الحذف" : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  // رفع ملف واستعادة
  const handleUploadRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".sql")) {
      showMsg("error", ar ? "يجب أن يكون الملف بصيغة .sql" : "File must be .sql format");
      return;
    }
    if (!confirm(ar ? "تحذير: ستُمسح البيانات الحالية وتُستبدل بالنسخة المرفوعة. هل أنت متأكد؟" : "Warning: Current data will be replaced. Are you sure?")) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post("/settings/backup/upload-restore", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showMsg("success", ar ? "تمت الاستعادة بنجاح. يرجى إعادة تسجيل الدخول." : "Restore successful. Please log in again.");
      setTimeout(() => window.location.href = `/${locale}/login`, 3000);
    } catch (err: any) {
      showMsg("error", err?.response?.data?.detail || (ar ? "فشلت الاستعادة" : "Restore failed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const lastBackup = backups[0];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/settings`}>{ar ? "الإعدادات" : "Settings"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "النسخ الاحتياطي" : "Backup"}</span>
          </div>
          <h1 className="page-title">{ar ? "النسخ الاحتياطي والاستعادة" : "Backup & Restore"}</h1>
          <p className="page-subtitle">{ar ? "نسخ احتياطية حقيقية لقاعدة البيانات" : "Real database backups"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            <IcRefresh />{ar ? "تحديث" : "Refresh"}
          </button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
            {creating ? (ar ? "جاري الإنشاء..." : "Creating...") : <><IcShield />{ar ? "نسخة احتياطية الآن" : "Backup Now"}</>}
          </button>
        </div>
      </div>

      {/* رسائل */}
      {message && (
        <div style={{
          background: message.type === "success" ? "#DCFCE7" : "#FEF2F2",
          border: `1px solid ${message.type === "success" ? "#86EFAC" : "#FECACA"}`,
          borderRadius: 8, padding: "10px 16px", marginBottom: 16,
          fontSize: 13, color: message.type === "success" ? "#166534" : "#DC2626",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {message.type === "success" ? <IcCheck /> : <IcInfo />}
          {message.text}
        </div>
      )}

      {/* بطاقات الحالة */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#ECFDF5", color: "#059669" }}><IcShield /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "آخر نسخة احتياطية" : "Last Backup"}</div>
            <div className="stat-value" style={{ fontSize: 14 }}>
              {lastBackup ? new Date(lastBackup.created_at).toLocaleDateString(ar ? "ar-SA" : "en-US") : (ar ? "لا يوجد" : "None")}
            </div>
            {lastBackup && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{lastBackup.size}</div>}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#EFF6FF", color: "#587795" }}><IcClock /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "عدد النسخ المحفوظة" : "Stored Backups"}</div>
            <div className="stat-value">{backups.length}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{ar ? "آخر 30 نسخة" : "Last 30 backups"}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#F5F3FF", color: "#5D7E9F" }}><IcDownload /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "إجمالي الحجم" : "Total Size"}</div>
            <div className="stat-value" style={{ fontSize: 14 }}>
              {backups.reduce((s, b) => s + (b.size_bytes || 0), 0) > 0
                ? `${(backups.reduce((s, b) => s + (b.size_bytes || 0), 0) / (1024 * 1024)).toFixed(1)} MB`
                : "0 MB"}
            </div>
          </div>
        </div>
      </div>

      {/* استعادة من ملف */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">{ar ? "استعادة من ملف" : "Restore from File"}</span>
        </div>
        <div className="card-body">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                {ar
                  ? "ارفع ملف .sql لاستعادة قاعدة البيانات. تحذير: ستُمسح البيانات الحالية."
                  : "Upload a .sql file to restore the database. Warning: Current data will be replaced."}
              </p>
            </div>
            <input ref={fileInputRef} type="file" accept=".sql" style={{ display: "none" }} onChange={handleUploadRestore} />
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}
              style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <IcUpload />
              {uploading ? (ar ? "جاري الاستعادة..." : "Restoring...") : (ar ? "رفع ملف واستعادة" : "Upload & Restore")}
            </button>
          </div>
        </div>
      </div>

      {/* قائمة النسخ الاحتياطية */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "النسخ الاحتياطية المتاحة" : "Available Backups"}</span>
        </div>
        {loading ? (
          <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
        ) : backups.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 20px" }}>
            <div className="empty-state-title">{ar ? "لا توجد نسخ احتياطية بعد" : "No backups yet"}</div>
            <div className="empty-state-desc" style={{ marginBottom: 16 }}>
              {ar ? "اضغط على 'نسخة احتياطية الآن' لإنشاء أول نسخة" : "Click 'Backup Now' to create the first backup"}
            </div>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "اسم الملف" : "Filename"}</th>
                  <th>{ar ? "التاريخ والوقت" : "Date & Time"}</th>
                  <th>{ar ? "الحجم" : "Size"}</th>
                  <th>{ar ? "النوع" : "Type"}</th>
                  <th>{ar ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.filename}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{b.filename}</td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {b.created_at ? new Date(b.created_at).toLocaleString(ar ? "ar-SA" : "en-US") : "—"}
                    </td>
                    <td style={{ fontWeight: 600 }}>{b.size}</td>
                    <td>
                      <span className={b.type === "auto" ? "badge badge-info" : "badge badge-gray"}>
                        {b.type === "auto" ? (ar ? "تلقائي" : "Auto") : (ar ? "يدوي" : "Manual")}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        {/* تنزيل */}
                        <button className="btn btn-secondary btn-sm" style={{ gap: 4 }} onClick={() => handleDownload(b.filename)}>
                          <IcDownload />{ar ? "تنزيل" : "Download"}
                        </button>

                        {/* استعادة */}
                        {confirmRestore === b.filename ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-sm" style={{ background: "#DC2626", color: "white", gap: 4 }}
                              onClick={() => handleRestore(b.filename)} disabled={restoring === b.filename}>
                              {restoring === b.filename ? (ar ? "جاري..." : "...") : (ar ? "تأكيد" : "Confirm")}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmRestore(null)}>
                              {ar ? "إلغاء" : "Cancel"}
                            </button>
                          </div>
                        ) : (
                          <button className="btn btn-sm" style={{ background: "#FEF9C3", color: "#92400E", gap: 4 }}
                            onClick={() => setConfirmRestore(b.filename)}>
                            <IcRefresh />{ar ? "استعادة" : "Restore"}
                          </button>
                        )}

                        {/* حذف */}
                        <button className="btn btn-sm" style={{ background: "#FEF2F2", color: "#DC2626", gap: 4 }}
                          onClick={() => handleDelete(b.filename)} disabled={deleting === b.filename}>
                          <IcTrash />{deleting === b.filename ? "..." : (ar ? "حذف" : "Delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* تحذير الاستعادة */}
      {confirmRestore && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card" style={{ maxWidth: 480, width: "100%", borderRadius: 16 }}>
            <div className="card-body" style={{ textAlign: "center", padding: 32 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FEF9C3", display: "flex", alignItems: "center", justifyContent: "center", color: "#D97706", margin: "0 auto 16px" }}>
                <IcWarning />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                {ar ? "تأكيد الاستعادة" : "Confirm Restore"}
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.7 }}>
                {ar
                  ? "ستُمسح جميع البيانات الحالية وتُستبدل بهذه النسخة الاحتياطية. هذا الإجراء لا يمكن التراجع عنه."
                  : "All current data will be erased and replaced with this backup. This action cannot be undone."}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button className="btn btn-secondary" onClick={() => setConfirmRestore(null)}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-danger" onClick={() => handleRestore(confirmRestore)} disabled={!!restoring}>
                  {restoring ? (ar ? "جاري الاستعادة..." : "Restoring...") : (ar ? "نعم، استعادة" : "Yes, Restore")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ملاحظة */}
      <div style={{ marginTop: 16, padding: "12px 16px", background: "#EFF6FF", borderRadius: 10, border: "1px solid #BFDBFE", display: "flex", gap: 8, fontSize: 12, color: "#1E40AF" }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}><IcInfo /></span>
        <span>
          {ar
            ? "النسخ الاحتياطية تشمل كل بيانات قاعدة البيانات. الملفات محفوظة على الخادم. عند الاستعادة ستُعاد جلسة تسجيل الدخول."
            : "Backups include all database data. Files are stored on the server. After restore, you will need to log in again."}
        </span>
      </div>
    </div>
  );
}
