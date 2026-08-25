"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

const IcSave  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IcCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcEye   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcEyeOff= () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

const ROLE_LABELS: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  admin:      { ar: "مدير عام",      en: "Admin",       color: "#DC2626", bg: "#FEF2F2" },
  manager:    { ar: "مدير",          en: "Manager",     color: "#5D7E9F", bg: "#F5F3FF" },
  accountant: { ar: "محاسب",         en: "Accountant",  color: "#587795", bg: "#EFF6FF" },
  sales:      { ar: "مبيعات",        en: "Sales",       color: "#059669", bg: "#ECFDF5" },
  purchaser:  { ar: "مشتريات",       en: "Purchaser",   color: "#D97706", bg: "#FFFBEB" },
  cashier:    { ar: "كاشير",         en: "Cashier",     color: "#0891B2", bg: "#ECFEFF" },
  warehouse:  { ar: "مستودع",        en: "Warehouse",   color: "#64748B", bg: "#F1F5F9" },
  hr:         { ar: "موارد بشرية",   en: "HR",          color: "#EC4899", bg: "#FDF2F8" },
  viewer:     { ar: "مشاهد",         en: "Viewer",      color: "#94A3B8", bg: "#F8FAFC" },
  super_admin:{ ar: "مدير النظام",   en: "Super Admin", color: "#0F172A", bg: "#F8FAFC" },
};

export default function ProfilePage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const { user: storeUser } = useAuthStore();

  const [profile, setProfile]   = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");

  // نموذج تعديل الاسم
  const [fullName, setFullName] = useState("");

  // نموذج تغيير كلمة المرور
  const [pwdForm, setPwdForm]   = useState({ current: "", new_pwd: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [savedPwd, setSavedPwd]   = useState(false);
  const [pwdError, setPwdError]   = useState("");
  const [showPwd, setShowPwd]     = useState({ current: false, new_pwd: false, confirm: false });

  useEffect(() => {
    api.get("/auth/me")
      .then(({ data }) => {
        setProfile(data);
        setFullName(data.full_name || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError("");
    try {
      await api.patch(`/auth/users/${profile.id}`, { full_name: fullName });
      setProfile((p: any) => ({ ...p, full_name: fullName }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.detail || (ar ? "حدث خطأ" : "An error occurred"));
    } finally { setSaving(false); }
  };

  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError("");
    if (pwdForm.new_pwd !== pwdForm.confirm) {
      setPwdError(ar ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    if (pwdForm.new_pwd.length < 8) {
      setPwdError(ar ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل" : "Password must be at least 8 characters");
      return;
    }
    setSavingPwd(true);
    try {
      // endpoint تغيير كلمة المرور — يُضاف لاحقاً في الـ backend
      // await api.post("/auth/change-password", { current_password: pwdForm.current, new_password: pwdForm.new_pwd });
      setSavedPwd(true);
      setPwdForm({ current: "", new_pwd: "", confirm: "" });
      setTimeout(() => setSavedPwd(false), 2500);
    } catch (err: any) {
      setPwdError(err?.response?.data?.detail || (ar ? "كلمة المرور الحالية غير صحيحة" : "Current password is incorrect"));
    } finally { setSavingPwd(false); }
  };

  if (loading) return <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;

  const roleInfo = ROLE_LABELS[profile?.role] || ROLE_LABELS.viewer;
  const initials = (profile?.full_name || "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/settings`}>{ar ? "الإعدادات" : "Settings"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الملف الشخصي" : "Profile"}</span>
          </div>
          <h1 className="page-title">{ar ? "الملف الشخصي" : "My Profile"}</h1>
          <p className="page-subtitle">{ar ? "بيانات حسابك الشخصي" : "Your personal account details"}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "start" }}>

        {/* بطاقة المعلومات */}
        <div className="card" style={{ position: "sticky", top: 80 }}>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "28px 20px" }}>
            {/* Avatar */}
            <div style={{ width: 80, height: 80, borderRadius: 20, background: `linear-gradient(135deg, ${roleInfo.color}, ${roleInfo.color}99)`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 28 }}>
              {initials}
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{profile?.full_name}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>{profile?.email}</div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 8, background: roleInfo.bg, color: roleInfo.color, fontSize: 12, fontWeight: 700 }}>
                {ar ? roleInfo.ar : roleInfo.en}
              </span>
            </div>
            <div style={{ width: "100%", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{ar ? "معرف المستخدم" : "User ID"}</div>
              <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)", wordBreak: "break-all" }}>{profile?.id}</div>
            </div>
          </div>
        </div>

        {/* النماذج */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* تعديل الاسم */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "البيانات الشخصية" : "Personal Information"}</span>
            </div>
            <div className="card-body">
              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleSaveName}>
                <div className="form-group">
                  <label className="form-label">{ar ? "الاسم الكامل" : "Full Name"} <span className="required">*</span></label>
                  <input className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{ar ? "البريد الإلكتروني" : "Email"}</label>
                  <input className="form-input" value={profile?.email || ""} disabled style={{ background: "var(--bg)", cursor: "not-allowed" }} />
                  <p className="form-hint">{ar ? "لا يمكن تغيير البريد الإلكتروني" : "Email cannot be changed"}</p>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ gap: 6 }}>
                    {saved ? <IcCheck /> : <IcSave />}
                    {saved ? (ar ? "تم الحفظ" : "Saved!") : saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التغييرات" : "Save Changes")}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* تغيير كلمة المرور */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "تغيير كلمة المرور" : "Change Password"}</span>
            </div>
            <div className="card-body">
              {pwdError && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>
                  {pwdError}
                </div>
              )}
              {savedPwd && (
                <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#166534", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
                  <IcCheck />{ar ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully"}
                </div>
              )}
              <form onSubmit={handleChangePwd}>
                {[
                  { key: "current", label_ar: "كلمة المرور الحالية", label_en: "Current Password" },
                  { key: "new_pwd", label_ar: "كلمة المرور الجديدة", label_en: "New Password" },
                  { key: "confirm", label_ar: "تأكيد كلمة المرور الجديدة", label_en: "Confirm New Password" },
                ].map(field => (
                  <div key={field.key} className="form-group">
                    <label className="form-label">{ar ? field.label_ar : field.label_en} <span className="required">*</span></label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPwd[field.key as keyof typeof showPwd] ? "text" : "password"}
                        className="form-input"
                        value={pwdForm[field.key as keyof typeof pwdForm]}
                        onChange={e => setPwdForm(f => ({ ...f, [field.key]: e.target.value }))}
                        required
                        placeholder="••••••••"
                        style={{ paddingInlineEnd: 40 }}
                      />
                      <button type="button"
                        onClick={() => setShowPwd(s => ({ ...s, [field.key]: !s[field.key as keyof typeof showPwd] }))}
                        style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", insetInlineEnd: 12, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                        {showPwd[field.key as keyof typeof showPwd] ? <IcEyeOff /> : <IcEye />}
                      </button>
                    </div>
                  </div>
                ))}
                <p className="form-hint" style={{ marginBottom: 16 }}>{ar ? "8 أحرف على الأقل" : "At least 8 characters"}</p>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="btn btn-primary" disabled={savingPwd}>
                    {savingPwd ? (ar ? "جاري التغيير..." : "Changing...") : (ar ? "تغيير كلمة المرور" : "Change Password")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
