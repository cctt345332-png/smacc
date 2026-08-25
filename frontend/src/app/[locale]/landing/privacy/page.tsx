"use client";
import { useParams } from "next/navigation";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";

export default function PrivacyPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";

  const sections = ar ? [
    { title: "1. المعلومات التي نجمعها", content: "نجمع المعلومات التي تقدمها مباشرة عند التسجيل (الاسم، البريد الإلكتروني، بيانات الشركة)، وبيانات الاستخدام (الصفحات المزارة، الإجراءات المنفذة)، والبيانات التجارية التي تدخلها في النظام (الفواتير، العملاء، المخزون)." },
    { title: "2. كيف نستخدم معلوماتك", content: "نستخدم معلوماتك لتقديم الخدمة وتحسينها، وإرسال إشعارات مهمة تتعلق بحسابك، وتقديم الدعم الفني، والامتثال للمتطلبات القانونية والتنظيمية في المملكة العربية السعودية." },
    { title: "3. مشاركة البيانات", content: "لا نبيع بياناتك لأي طرف ثالث. قد نشارك بيانات محدودة مع مزودي الخدمات الذين يساعدوننا في تشغيل النظام (مثل خدمات الاستضافة)، وذلك بموجب اتفاقيات سرية صارمة. نشارك البيانات مع الجهات الحكومية عند الطلب القانوني فقط." },
    { title: "4. أمان البيانات", content: "نستخدم تشفير SSL/TLS لجميع الاتصالات. بياناتك مخزنة على خوادم في المملكة العربية السعودية. نجري نسخاً احتياطية يومية. لدينا فريق أمن معلومات مخصص لمراقبة النظام." },
    { title: "5. الاحتفاظ بالبيانات", content: "نحتفظ ببياناتك طوال فترة اشتراكك النشط. بعد إلغاء الاشتراك، تُحتفظ البيانات لمدة 30 يوماً لإتاحة التصدير. بعد ذلك، تُحذف البيانات نهائياً ما لم يكن هناك التزام قانوني بالاحتفاظ بها." },
    { title: "6. حقوقك", content: "يحق لك الوصول إلى بياناتك وتصديرها في أي وقت. يمكنك طلب تصحيح أي بيانات غير دقيقة. يمكنك طلب حذف بياناتك وفق الشروط المذكورة. للتواصل بشأن أي من هذه الحقوق، راسلنا على privacy@masar.sa" },
    { title: "7. ملفات تعريف الارتباط (Cookies)", content: "نستخدم ملفات تعريف الارتباط الضرورية لتشغيل النظام (مثل جلسة تسجيل الدخول). لا نستخدم ملفات تعريف الارتباط للإعلانات أو التتبع عبر المواقع." },
    { title: "8. التغييرات على هذه السياسة", content: "قد نحدّث هذه السياسة من وقت لآخر. سنخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار داخل النظام." },
  ] : [
    { title: "1. Information We Collect", content: "We collect information you provide directly when registering (name, email, company data), usage data (pages visited, actions performed), and business data you enter into the system (invoices, customers, inventory)." },
    { title: "2. How We Use Your Information", content: "We use your information to provide and improve the service, send important account notifications, provide technical support, and comply with legal and regulatory requirements in Saudi Arabia." },
    { title: "3. Data Sharing", content: "We do not sell your data to any third party. We may share limited data with service providers who help us operate the system (such as hosting services), under strict confidentiality agreements. We share data with government authorities only upon legal request." },
    { title: "4. Data Security", content: "We use SSL/TLS encryption for all communications. Your data is stored on servers in Saudi Arabia. We perform daily backups. We have a dedicated information security team monitoring the system." },
    { title: "5. Data Retention", content: "We retain your data throughout your active subscription. After cancellation, data is retained for 30 days to allow export. After that, data is permanently deleted unless there is a legal obligation to retain it." },
    { title: "6. Your Rights", content: "You have the right to access and export your data at any time. You can request correction of any inaccurate data. You can request deletion of your data under the stated conditions. Contact us at privacy@masar.sa for any of these rights." },
    { title: "7. Cookies", content: "We use necessary cookies to operate the system (such as login session). We do not use cookies for advertising or cross-site tracking." },
    { title: "8. Changes to This Policy", content: "We may update this policy from time to time. We will notify you of any material changes via email or in-system notification." },
  ];

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ fontFamily: "'Alexandria', sans-serif", color: "#0F172A", background: "#fff", minHeight: "100vh" }}>
      <LandingNav locale={locale} />

      <section style={{ padding: "48px 5% 16px", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, marginBottom: 8 }}>
            {ar ? "سياسة الخصوصية" : "Privacy Policy"}
          </h1>
          <p style={{ color: "#64748B", fontSize: 13 }}>
            {ar ? "آخر تحديث: مايو 2026" : "Last updated: May 2026"}
          </p>
        </div>
      </section>

      <section style={{ padding: "32px 5% 56px", background: "#fff" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "#EFF6FF", border: "1px solid #BFDBFE", marginBottom: 28, fontSize: 13, color: "#3E0865" }}>
            {ar
              ? "نحن نأخذ خصوصيتك بجدية. هذه السياسة تشرح بوضوح ما نجمعه وكيف نستخدمه وكيف نحميه."
              : "We take your privacy seriously. This policy clearly explains what we collect, how we use it, and how we protect it."}
          </div>
          {sections.map((s, i) => (
            <div key={i} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: i < sections.length - 1 ? "1px solid #F1F5F9" : "none" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>{s.title}</h2>
              <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.8 }}>{s.content}</p>
            </div>
          ))}
          <div style={{ padding: "16px", borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 13, color: "#64748B" }}>
            {ar
              ? "للتواصل بشأن الخصوصية: privacy@masar.sa"
              : "For privacy inquiries: privacy@masar.sa"}
          </div>
        </div>
      </section>

      <LandingFooter locale={locale} />
    </div>
  );
}
