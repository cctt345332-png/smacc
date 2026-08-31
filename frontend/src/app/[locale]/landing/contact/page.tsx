"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import { PUBLIC_CONTACT, publicContactLinks } from "@/lib/publicContact";

const IcMail    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const IcPhone   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.18 6.18l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IcClock   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcCheck   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;

export default function ContactPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";

  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    // محاكاة إرسال
    await new Promise(r => setTimeout(r, 1200));
    setSent(true);
    setSending(false);
  };

  const contactInfo = [
    { icon: <IcMail />,  color: "#3E0865", bg: "#F4EFF7", label: ar ? "البريد الإلكتروني" : "Email", value: PUBLIC_CONTACT.email, href: publicContactLinks.email },
    { icon: <IcPhone />, color: "#75617F", bg: "#EAF5ED", label: ar ? "الهاتف / واتساب" : "Phone / WhatsApp", value: PUBLIC_CONTACT.phone, href: publicContactLinks.phone },
    { icon: <IcClock />, color: "#6F4A84", bg: "#EEF3EE", label: ar ? "العنوان" : "Address", value: ar ? PUBLIC_CONTACT.addressAr : PUBLIC_CONTACT.addressEn },
    { icon: <IcClock />, color: "#D97706", bg: "#FFFBEB", label: ar ? "ساعات العمل"      : "Working Hours", value: ar ? "الأحد — الخميس، 9ص — 6م" : "Sun — Thu, 9AM — 6PM" },
  ];

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ fontFamily: "'Alexandria', sans-serif", color: "#0F172A", background: "#fff", minHeight: "100vh" }}>
      <LandingNav locale={locale} />

      {/* Hero */}
      <section style={{ padding: "48px 5% 32px", textAlign: "center", background: "#F8FAFC" }}>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 38px)", fontWeight: 800, marginBottom: 12 }}>
          {ar ? "تواصل معنا" : "Contact Us"}
        </h1>
        <p style={{ color: "#64748B", fontSize: 15 }}>
          {ar ? "فريقنا جاهز للمساعدة — نرد خلال ساعات العمل" : "Our team is ready to help — we respond during business hours"}
        </p>
      </section>

      <section style={{ padding: "32px 5% 56px", background: "#fff" }}>
        <style>{`
          .contact-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 40px; align-items: start; }
          @media (max-width: 640px) { .contact-grid { grid-template-columns: 1fr; gap: 28px; } }
        `}</style>
        <div className="contact-grid" style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* Contact info */}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>
              {ar ? "معلومات التواصل" : "Contact Information"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {contactInfo.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", color: c.color, flexShrink: 0 }}>
                    {c.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 2 }}>{c.label}</div>
                    {c.href ? <a href={c.href} style={{ fontSize: 14, fontWeight: 700, color: "#3E0865" }}>{c.value}</a> : <div style={{ fontSize: 14, fontWeight: 700 }}>{c.value}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, padding: "16px", borderRadius: 12, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                {ar ? "هل أنت عميل حالي؟" : "Existing customer?"}
              </div>
              <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6 }}>
                {ar
                  ? "يمكنك فتح تذكرة دعم مباشرة من داخل النظام عبر قائمة المساعدة."
                  : "You can open a support ticket directly from within the system via the Help menu."}
              </div>
            </div>
          </div>

          {/* Form */}
          <div>
            {sent ? (
              <div style={{ textAlign: "center", padding: "48px 24px", borderRadius: 16, border: "1px solid #E9DDED", background: "#F4EFF7" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#6F4A84", display: "flex", alignItems: "center", justifyContent: "center", color: "white", margin: "0 auto 16px" }}>
                  <IcCheck />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: "#6F4A84", marginBottom: 8 }}>
                  {ar ? "تم إرسال رسالتك" : "Message Sent"}
                </h3>
                <p style={{ color: "#4B2A5A", fontSize: 14 }}>
                  {ar ? "سنتواصل معك خلال ساعات العمل. شكراً لتواصلك معنا." : "We'll get back to you during business hours. Thank you for reaching out."}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5, color: "#374151" }}>
                      {ar ? "الاسم" : "Name"} <span style={{ color: "#DC2626" }}>*</span>
                    </label>
                    <input className="form-input" value={form.name} onChange={e => upd("name", e.target.value)}
                      placeholder={ar ? "محمد أحمد" : "John Smith"} required />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5, color: "#374151" }}>
                      {ar ? "البريد الإلكتروني" : "Email"} <span style={{ color: "#DC2626" }}>*</span>
                    </label>
                    <input type="email" className="form-input" value={form.email} onChange={e => upd("email", e.target.value)}
                      placeholder="email@company.com" required />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5, color: "#374151" }}>
                      {ar ? "الجوال" : "Phone"}
                    </label>
                    <input className="form-input" value={form.phone} onChange={e => upd("phone", e.target.value)}
                      placeholder="0500000000" />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5, color: "#374151" }}>
                      {ar ? "الموضوع" : "Subject"} <span style={{ color: "#DC2626" }}>*</span>
                    </label>
                    <select className="form-input form-select" value={form.subject} onChange={e => upd("subject", e.target.value)} required>
                      <option value="">{ar ? "— اختر —" : "— Select —"}</option>
                      <option value="sales">{ar ? "استفسار عن الأسعار" : "Pricing inquiry"}</option>
                      <option value="support">{ar ? "دعم فني" : "Technical support"}</option>
                      <option value="demo">{ar ? "طلب عرض تجريبي" : "Request a demo"}</option>
                      <option value="other">{ar ? "أخرى" : "Other"}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5, color: "#374151" }}>
                    {ar ? "الرسالة" : "Message"} <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <textarea className="form-input" rows={5} value={form.message} onChange={e => upd("message", e.target.value)}
                    placeholder={ar ? "اكتب رسالتك هنا..." : "Write your message here..."} required
                    style={{ resize: "vertical" }} />
                </div>
                <button type="submit" disabled={sending}
                  style={{ padding: "12px", borderRadius: 2, background: "#3E0865", color: "white", fontWeight: 700, fontSize: 14, border: "1px solid #3E0865", cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.7 : 1 }}>
                  {sending ? (ar ? "جاري الإرسال..." : "Sending...") : (ar ? "إرسال الرسالة" : "Send Message")}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <LandingFooter locale={locale} />
    </div>
  );
}
