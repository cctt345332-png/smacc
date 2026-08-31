"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";

const IcShield  = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcTarget  = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
const IcUsers   = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcStar    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;

export default function AboutPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";

  const values = [
    { icon: <IcShield />, color: "#5A187E", bg: "#EFF6FF", title: ar ? "الامتثال أولاً" : "Compliance First",    desc: ar ? "نظامنا مبني من الأساس ليكون متوافقاً مع متطلبات زاتكا والفوترة الإلكترونية المرحلة الثانية" : "Our system is built from the ground up to comply with ZATCA Phase 2 e-invoicing requirements" },
    { icon: <IcTarget />, color: "#6F4A84", bg: "#F4EFF7", title: ar ? "مصمم للسوق السعودي" : "Built for Saudi Market", desc: ar ? "نفهم احتياجات الأعمال السعودية — من الرقم الضريبي إلى العنوان الوطني إلى متطلبات GOSI" : "We understand Saudi business needs — from VAT numbers to national addresses to GOSI requirements" },
    { icon: <IcUsers />,  color: "#75617F", bg: "#F5F3FF", title: ar ? "سهولة الاستخدام" : "Ease of Use",         desc: ar ? "واجهة عربية أولاً، مصممة لتكون بسيطة وسريعة حتى بدون خبرة محاسبية" : "Arabic-first interface, designed to be simple and fast even without accounting experience" },
  ];

  const stats = [
    { value: "500+",  label: ar ? "شركة تستخدم النظام" : "Companies using Masar" },
    { value: "99.9%", label: ar ? "وقت التشغيل" : "Uptime" },
    { value: "2026",  label: ar ? "سنة التأسيس" : "Founded" },
    { value: "24/7",  label: ar ? "دعم فني" : "Support" },
  ];

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ fontFamily: "'Alexandria', sans-serif", color: "#0F172A", background: "#fff", minHeight: "100vh" }}>
      <LandingNav locale={locale} />

      {/* Hero */}
      <section style={{ padding: "60px 5% 48px", textAlign: "center", background: "linear-gradient(180deg, #F8FAFC 0%, #fff 100%)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h1 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, marginBottom: 16 }}>
            {ar ? "نبني الأدوات التي تحتاجها الأعمال السعودية" : "Building tools Saudi businesses need"}
          </h1>
          <p style={{ fontSize: 16, color: "#64748B", lineHeight: 1.8 }}>
            {ar
              ? "Masar نظام ERP سحابي متكامل مصمم خصيصاً للسوق السعودي. نؤمن بأن كل صاحب عمل يستحق نظاماً محاسبياً احترافياً متوافقاً مع زاتكا، بسعر معقول وسهولة استخدام حقيقية."
              : "Masar is a complete cloud ERP system designed specifically for the Saudi market. We believe every business owner deserves a professional accounting system that complies with ZATCA, at a reasonable price and with genuine ease of use."}
          </p>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: "32px 5%", background: "#0F172A" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 24, textAlign: "center" }}>
          {stats.map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#5A187E", marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: "#94A3B8" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: "48px 5%", background: "#fff" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 32, textAlign: "center" }}>
            {ar ? "قيمنا" : "Our Values"}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
            {values.map((v, i) => (
              <div key={i} style={{ padding: 24, borderRadius: 14, border: "1px solid #E2E8F0" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: v.bg, display: "flex", alignItems: "center", justifyContent: "center", color: v.color, marginBottom: 14 }}>
                  {v.icon}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{v.title}</div>
                <div style={{ color: "#64748B", fontSize: 13, lineHeight: 1.7 }}>{v.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section style={{ padding: "48px 5%", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>{ar ? "قصتنا" : "Our Story"}</h2>
          <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.9 }}>
            <p style={{ marginBottom: 16 }}>
              {ar
                ? "بدأت فكرة Masar من ملاحظة بسيطة: معظم أنظمة ERP المتاحة إما معقدة جداً أو غير متوافقة مع متطلبات زاتكا أو مكلفة للغاية بالنسبة للشركات الصغيرة والمتوسطة في السعودية."
                : "The idea for Masar started from a simple observation: most available ERP systems are either too complex, not compliant with ZATCA requirements, or too expensive for small and medium businesses in Saudi Arabia."}
            </p>
            <p style={{ marginBottom: 16 }}>
              {ar
                ? "قررنا بناء نظام يتكيف مع نشاطك التجاري — سواء كنت تبيع الجوالات أو تدير صيدلية أو تعمل في البقالة أو الملابس. كل نشاط له متطلباته الخاصة، ونظامنا يفهم ذلك."
                : "We decided to build a system that adapts to your business activity — whether you sell phones, run a pharmacy, work in grocery or clothing. Each activity has its own requirements, and our system understands that."}
            </p>
            <p>
              {ar
                ? "اليوم، يثق بنا أكثر من 500 شركة سعودية لإدارة محاسبتهم وفواتيرهم ومخزونهم ونقاط بيعهم — كل ذلك في نظام واحد متوافق مع زاتكا."
                : "Today, more than 500 Saudi companies trust us to manage their accounting, invoices, inventory and POS — all in one ZATCA-compliant system."}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "48px 5%", background: "#5A187E", textAlign: "center" }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: "white", marginBottom: 12 }}>
          {ar ? "جاهز للبدء؟" : "Ready to get started?"}
        </h2>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 15, marginBottom: 24 }}>
          {ar ? "ابدأ تجربتك المجانية 14 يوم — لا يلزم بطاقة ائتمان" : "Start your 14-day free trial — no credit card required"}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href={`/${locale}/register`} style={{ padding: "12px 28px", borderRadius: 10, background: "white", color: "#5A187E", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            {ar ? "ابدأ مجاناً" : "Start Free"}
          </Link>
          <Link href={`/${locale}/landing/contact`} style={{ padding: "12px 28px", borderRadius: 10, background: "transparent", color: "white", fontWeight: 700, fontSize: 14, textDecoration: "none", border: "1.5px solid rgba(255,255,255,0.4)" }}>
            {ar ? "تواصل معنا" : "Contact Us"}
          </Link>
        </div>
      </section>

      <LandingFooter locale={locale} />
    </div>
  );
}
