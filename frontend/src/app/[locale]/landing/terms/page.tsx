"use client";
import { useParams } from "next/navigation";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";

export default function TermsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";

  const sections = ar ? [
    {
      title: "1. قبول الشروط",
      content: "باستخدامك لنظام Masar، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي من هذه الشروط، يرجى عدم استخدام الخدمة.",
    },
    {
      title: "2. وصف الخدمة",
      content: "Masar هو نظام ERP سحابي يوفر خدمات المحاسبة والفوترة وإدارة المخزون ونقطة البيع والموارد البشرية. الخدمة متوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك (زاتكا) للفوترة الإلكترونية.",
    },
    {
      title: "3. حساب المستخدم",
      content: "أنت مسؤول عن الحفاظ على سرية بيانات تسجيل الدخول الخاصة بك. يجب إخطارنا فوراً في حالة الاشتباه بأي استخدام غير مصرح به لحسابك. نحن غير مسؤولين عن أي خسائر ناتجة عن إهمالك في حماية بيانات الدخول.",
    },
    {
      title: "4. الاشتراك والدفع",
      content: "تُحتسب رسوم الاشتراك مقدماً على أساس شهري أو سنوي حسب الخطة المختارة. لا تُسترد الرسوم المدفوعة إلا في حالات استثنائية يُقدّرها فريقنا. يحق لنا تعديل الأسعار مع إشعار مسبق لا يقل عن 30 يوماً.",
    },
    {
      title: "5. البيانات والخصوصية",
      content: "بياناتك ملكك. نحن نحتفظ ببياناتك على خوادم آمنة في المملكة العربية السعودية. لن نشارك بياناتك مع أطراف ثالثة إلا بموافقتك الصريحة أو بموجب متطلبات قانونية. راجع سياسة الخصوصية للمزيد من التفاصيل.",
    },
    {
      title: "6. الاستخدام المقبول",
      content: "يُحظر استخدام النظام لأي أغراض غير قانونية أو مخالفة للأنظمة السعودية. يُحظر محاولة اختراق النظام أو التلاعب بالبيانات. نحتفظ بالحق في إيقاف الحسابات التي تنتهك هذه الشروط.",
    },
    {
      title: "7. حدود المسؤولية",
      content: "نسعى لتوفير خدمة موثوقة بنسبة 99.9% من وقت التشغيل. في حالة انقطاع الخدمة، لا تتجاوز مسؤوليتنا قيمة رسوم الاشتراك عن الفترة المتأثرة. لسنا مسؤولين عن أي خسائر غير مباشرة.",
    },
    {
      title: "8. إنهاء الخدمة",
      content: "يمكنك إلغاء اشتراكك في أي وقت. عند الإلغاء، يمكنك تصدير بياناتك خلال 30 يوماً. بعد ذلك، قد يتم حذف البيانات نهائياً. نحتفظ بالحق في إنهاء الخدمة في حالة انتهاك الشروط.",
    },
    {
      title: "9. التعديلات",
      content: "نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إخطارك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار داخل النظام قبل 14 يوماً من تطبيقها.",
    },
    {
      title: "10. القانون المطبق",
      content: "تخضع هذه الشروط لأنظمة المملكة العربية السعودية. أي نزاع يُحال إلى المحاكم السعودية المختصة.",
    },
  ] : [
    {
      title: "1. Acceptance of Terms",
      content: "By using Masar, you agree to be bound by these Terms and Conditions. If you do not agree to any of these terms, please do not use the service.",
    },
    {
      title: "2. Service Description",
      content: "Masar is a cloud ERP system providing accounting, invoicing, inventory management, POS, and HR services. The service is compliant with ZATCA Phase 2 e-invoicing requirements.",
    },
    {
      title: "3. User Account",
      content: "You are responsible for maintaining the confidentiality of your login credentials. You must notify us immediately of any suspected unauthorized use of your account. We are not responsible for losses resulting from your negligence in protecting login credentials.",
    },
    {
      title: "4. Subscription and Payment",
      content: "Subscription fees are charged in advance on a monthly or annual basis depending on the selected plan. Fees paid are non-refundable except in exceptional cases determined by our team. We reserve the right to modify prices with at least 30 days prior notice.",
    },
    {
      title: "5. Data and Privacy",
      content: "Your data belongs to you. We store your data on secure servers in Saudi Arabia. We will not share your data with third parties except with your explicit consent or as required by law. See our Privacy Policy for more details.",
    },
    {
      title: "6. Acceptable Use",
      content: "It is prohibited to use the system for any illegal purposes or in violation of Saudi regulations. Attempting to breach the system or manipulate data is prohibited. We reserve the right to suspend accounts that violate these terms.",
    },
    {
      title: "7. Limitation of Liability",
      content: "We strive to provide a reliable service with 99.9% uptime. In case of service interruption, our liability does not exceed the subscription fees for the affected period. We are not responsible for any indirect losses.",
    },
    {
      title: "8. Termination",
      content: "You can cancel your subscription at any time. Upon cancellation, you can export your data within 30 days. After that, data may be permanently deleted. We reserve the right to terminate service in case of terms violation.",
    },
    {
      title: "9. Modifications",
      content: "We reserve the right to modify these terms at any time. You will be notified of any material changes via email or in-system notification at least 14 days before they take effect.",
    },
    {
      title: "10. Governing Law",
      content: "These terms are governed by the laws of the Kingdom of Saudi Arabia. Any dispute shall be referred to the competent Saudi courts.",
    },
  ];

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ fontFamily: "'Alexandria', sans-serif", color: "#0F172A", background: "#fff", minHeight: "100vh" }}>
      <LandingNav locale={locale} />

      <section style={{ padding: "48px 5% 16px", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h1 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, marginBottom: 8 }}>
            {ar ? "الشروط والأحكام" : "Terms & Conditions"}
          </h1>
          <p style={{ color: "#64748B", fontSize: 13 }}>
            {ar ? "آخر تحديث: مايو 2026" : "Last updated: May 2026"}
          </p>
        </div>
      </section>

      <section style={{ padding: "32px 5% 56px", background: "#fff" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {sections.map((s, i) => (
            <div key={i} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: i < sections.length - 1 ? "1px solid #F1F5F9" : "none" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10, color: "#0F172A" }}>{s.title}</h2>
              <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.8 }}>{s.content}</p>
            </div>
          ))}
        </div>
      </section>

      <LandingFooter locale={locale} />
    </div>
  );
}
