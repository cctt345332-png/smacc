import Link from "next/link";

export default function LandingFooter({ locale }: { locale: string }) {
  const ar = locale === "ar";
  return (
    <footer style={{ background: "#0F172A", color: "#94A3B8", padding: "40px 5% 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 32, marginBottom: 32 }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <img src="/logo-masar-blue.png" alt="Logo" style={{ height: 44, maxWidth: 160, objectFit: "contain" }} />
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.7, color: "#64748B" }}>
              {ar ? "نظام ERP سحابي متوافق مع زاتكا — مصمم للأعمال السعودية" : "Cloud ERP compliant with ZATCA — designed for Saudi businesses"}
            </p>
          </div>

          {/* Product */}
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{ar ? "المنتج" : "Product"}</div>
            {[
              { href: `/${locale}/landing`,          label: ar ? "الرئيسية"    : "Home" },
              { href: `/${locale}/landing/pricing`,   label: ar ? "الأسعار"     : "Pricing" },
              { href: `/${locale}/register`,          label: ar ? "ابدأ مجاناً" : "Start Free" },
              { href: `/${locale}/login`,             label: ar ? "تسجيل الدخول": "Sign In" },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ display: "block", fontSize: 13, color: "#64748B", textDecoration: "none", marginBottom: 8 }}>{l.label}</Link>
            ))}
          </div>

          {/* Company */}
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{ar ? "الشركة" : "Company"}</div>
            {[
              { href: `/${locale}/landing/about`,    label: ar ? "من نحن"           : "About Us" },
              { href: `/${locale}/landing/contact`,  label: ar ? "تواصل معنا"       : "Contact" },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ display: "block", fontSize: 13, color: "#64748B", textDecoration: "none", marginBottom: 8 }}>{l.label}</Link>
            ))}
          </div>

          {/* Legal */}
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{ar ? "قانوني" : "Legal"}</div>
            {[
              { href: `/${locale}/landing/terms`,    label: ar ? "الشروط والأحكام" : "Terms & Conditions" },
              { href: `/${locale}/landing/privacy`,  label: ar ? "سياسة الخصوصية" : "Privacy Policy" },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ display: "block", fontSize: 13, color: "#64748B", textDecoration: "none", marginBottom: 8 }}>{l.label}</Link>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #1E293B", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <p style={{ fontSize: 12, color: "#475569" }}>
            © 2026 Masar. {ar ? "جميع الحقوق محفوظة" : "All rights reserved"}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6F4A84" }} />
            <span style={{ fontSize: 12, color: "#475569" }}>
              {ar ? "جميع الأنظمة تعمل" : "All systems operational"}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
