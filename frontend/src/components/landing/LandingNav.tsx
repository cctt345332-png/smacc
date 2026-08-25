"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const IcMenu  = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const IcClose = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

interface LandingNavProps {
  locale: string;
}

export default function LandingNav({ locale }: LandingNavProps) {
  const ar = locale === "ar";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: `/${locale}/landing`,         label: ar ? "الرئيسية"    : "Home" },
    { href: `/${locale}/landing/pricing`,  label: ar ? "الأسعار"     : "Pricing" },
    { href: `/${locale}/landing/about`,    label: ar ? "من نحن"      : "About" },
    { href: `/${locale}/landing/contact`,  label: ar ? "تواصل معنا"  : "Contact" },
    { href: `/${locale}/landing/terms`,    label: ar ? "الشروط والأحكام" : "Terms" },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <style>{`
        .lnav-links { display: flex; align-items: center; gap: 4px; }
        .lnav-hamburger { display: none; }
        .lnav-mobile { display: none; }
        @media (max-width: 640px) {
          .lnav-links { display: none; }
          .lnav-hamburger { display: flex; }
          .lnav-mobile.open { display: flex; flex-direction: column; }
        }
      `}</style>

      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid #E2E8F0",
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          padding: "0 20px",
          height: 68,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Logo — logo-ha فقط */}
          <Link href={`/${locale}/landing`} style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <img src="/logo-masar-blue.png" alt="Masar" style={{ height: 56, maxWidth: 220, objectFit: "contain" }} />
          </Link>

          {/* Desktop links */}
          <div className="lnav-links">
            {links.map(l => (
              <Link key={l.href} href={l.href} style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                color: isActive(l.href) ? "#5A187E" : "#64748B",
                background: isActive(l.href) ? "#EFF6FF" : "transparent",
                textDecoration: "none", transition: "all 0.15s",
              }}>
                {l.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="lnav-links" style={{ gap: 8 }}>
            <Link href={`/${locale}/login`} style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              color: "#64748B", textDecoration: "none",
            }}>
              {ar ? "دخول" : "Sign In"}
            </Link>
            <Link href={`/${locale}/register`} style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: "#5A187E", color: "white", textDecoration: "none",
            }}>
              {ar ? "ابدأ مجاناً" : "Start Free"}
            </Link>
          </div>

          {/* Hamburger */}
          <button
            className="lnav-hamburger"
            onClick={() => setOpen(o => !o)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#0F172A", padding: 4 }}
          >
            {open ? <IcClose /> : <IcMenu />}
          </button>
        </div>

        {/* Mobile menu */}
        <div className={`lnav-mobile${open ? " open" : ""}`} style={{
          borderTop: "1px solid #E2E8F0",
          background: "white",
          padding: "12px 20px 16px",
          gap: 4,
        }}>
          {links.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{
              padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              color: isActive(l.href) ? "#5A187E" : "#0F172A",
              background: isActive(l.href) ? "#EFF6FF" : "transparent",
              textDecoration: "none",
            }}>
              {l.label}
            </Link>
          ))}
          <div style={{ borderTop: "1px solid #E2E8F0", marginTop: 8, paddingTop: 12, display: "flex", gap: 8 }}>
            <Link href={`/${locale}/login`} onClick={() => setOpen(false)} style={{
              flex: 1, textAlign: "center", padding: "10px", borderRadius: 8,
              fontSize: 14, fontWeight: 600, color: "#64748B",
              border: "1.5px solid #E2E8F0", textDecoration: "none",
            }}>
              {ar ? "تسجيل الدخول" : "Sign In"}
            </Link>
            <Link href={`/${locale}/register`} onClick={() => setOpen(false)} style={{
              flex: 1, textAlign: "center", padding: "10px", borderRadius: 8,
              fontSize: 14, fontWeight: 700, background: "#5A187E",
              color: "white", textDecoration: "none",
            }}>
              {ar ? "ابدأ مجاناً" : "Start Free"}
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}
