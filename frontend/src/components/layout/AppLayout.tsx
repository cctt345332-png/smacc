"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import Sidebar from "./Sidebar";
import Header from "./Header";
import AIWidget from "@/components/ai/AIWidget";
import { getCompany } from "@/lib/settings";

export default function AppLayout({ children, locale }: { children: React.ReactNode; locale: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { token, user, _hasHydrated, setPlanInfo } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (_hasHydrated && !token) router.replace(`/${locale}/login`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, token]);

  // إذا الدور cashier — يُسمح فقط بصفحة الكاشير
  useEffect(() => {
    if (!_hasHydrated || !token || !user) return;
    if (user.role === "cashier") {
      const allowed = pathname.startsWith(`/${locale}/pos/cashier`);
      if (!allowed) {
        router.replace(`/${locale}/pos/cashier`);
      }
    }
    // إذا الدور sales_rep
    if (user.role === "sales_rep") {
      if (!pathname.startsWith(`/${locale}/reps/me`)) {
        router.replace(`/${locale}/reps/me/dashboard`);
      }
      return;
    }
    // إذا الدور supervisor
    if (user.role === "supervisor") {
      if (!pathname.startsWith(`/${locale}/supervisor`)) {
        router.replace(`/${locale}/supervisor/dashboard`);
      }
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, token, pathname]);

  // جلب بيانات الباقة ونوع النشاط وحفظها في الـ store
  useEffect(() => {
    if (!token) return;
    getCompany()
      .then(({ data }) => {
        setPlanInfo(data?.plan || "trial", data?.business_type || "general");
      })
      .catch(() => {});
  }, [token]);

  const isMobile = () => typeof window !== "undefined" && window.innerWidth <= 768;

  const handleToggle = () => {
    if (isMobile()) {
      setMobileOpen(v => !v);
    } else {
      setCollapsed(v => !v);
    }
  };

  if (!_hasHydrated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          {locale === "ar" ? "جاري التحميل..." : "Loading..."}
        </div>
      </div>
    );
  }

  if (!token) return null;

  // المندوب — لا يجب أن يكون هنا، RepLayout يتولى الأمر
  if (user?.role === "sales_rep") return null;
  if (user?.role === "supervisor") return null;

  // الكاشير — شاشة كاملة بدون sidebar أو header، مباشرة للكاشير
  if (user?.role === "cashier") {
    // إذا مش في صفحة الكاشير، لا تعرض شي حتى يصير الـ redirect
    if (!pathname.startsWith(`/${locale}/pos/cashier`)) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
          <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {locale === "ar" ? "جاري التحميل..." : "Loading..."}
          </div>
        </div>
      );
    }
    return (
      <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
        {children}
      </div>
    );
  }

  // المندوب — يُوجَّه لواجهته الخاصة، لا يدخل AppLayout
  if (user?.role === "sales_rep") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          {locale === "ar" ? "جاري التحميل..." : "Loading..."}
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <div
        className={`sidebar-overlay${mobileOpen ? " visible" : ""}`}
        onClick={() => setMobileOpen(false)}
      />

      <Sidebar
        locale={locale}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={handleToggle}
      />

      <div className={`main-content${collapsed ? " collapsed" : ""}`}>
        <Header
          locale={locale}
          collapsed={collapsed}
          onMobileMenuClick={() => setMobileOpen(v => !v)}
        />
        <main className="page-content animate-fade">
          {children}
        </main>
        <AIWidget locale={locale} />
      </div>
    </div>
  );
}
