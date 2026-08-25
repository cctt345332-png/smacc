"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ─── AI Logo (animated) ───────────────────────────────────────────────
function AILogoSmall() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 200 200" width={28} height={28}>
      <g clipPath="url(#w_clip)">
        <mask id="w_mask" style={{ maskType: "alpha" as const }} width="200" height="200" x="0" y="0" maskUnits="userSpaceOnUse">
          <path fill="#fff" fillRule="evenodd" d="M100 150c27.614 0 50-22.386 50-50s-22.386-50-50-50-50 22.386-50 50 22.386 50 50 50zm0 50c55.228 0 100-44.772 100-100S155.228 0 100 0 0 44.772 0 100s44.772 100 100 100z" clipRule="evenodd"/>
        </mask>
        <g mask="url(#w_mask)">
          <path fill="#fff" d="M200 0H0v200h200V0z"/>
          <path fill="#485668" fillOpacity="0.4" d="M200 0H0v200h200V0z"/>
          <g filter="url(#w_blur)" style={{ animation: "ai-spin 6s linear infinite", transformOrigin: "center", transformBox: "fill-box" as const }}>
            <path fill="#485668" d="M110 32H18v68h92V32z"/>
            <path fill="#364152" d="M188-24H15v98h173v-98z"/>
            <path fill="#3B82F6" d="M175 70H5v156h170V70z"/>
            <path fill="#60A5FA" d="M230 51H100v103h130V51z"/>
          </g>
        </g>
      </g>
      <defs>
        <filter id="w_blur" width="385" height="410" x="-75" y="-104" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur result="effect1" stdDeviation="40"/>
        </filter>
        <clipPath id="w_clip"><path fill="#fff" d="M0 0H200V200H0z"/></clipPath>
      </defs>
    </svg>
  );
}

export default function AIWidget({ locale }: { locale: string }) {
  const pathname = usePathname();
  const ar = locale === "ar";
  const [msgCount, setMsgCount] = useState(0);
  const [pulse, setPulse] = useState(false);

  // لا تعرض الـ widget في صفحة AI نفسها
  const isAIPage = pathname?.includes("/ai");

  // عدد الرسائل المحفوظة
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`ai_chat_${locale}`);
      if (saved) {
        const msgs = JSON.parse(saved);
        setMsgCount(Array.isArray(msgs) ? msgs.length : 0);
      }
    } catch {}

    // pulse animation عند وجود محادثة محفوظة
    const timer = setTimeout(() => setPulse(true), 2000);
    return () => clearTimeout(timer);
  }, [locale]);

  if (isAIPage) return null;

  return (
    <>
      <style>{`
        @keyframes ai-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes ai-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        .ai-widget-btn:hover { transform: scale(1.05) !important; }
        .ai-widget-btn:hover .ai-tooltip { opacity: 1 !important; transform: translateY(0) !important; }
      `}</style>

      <Link href={`/${locale}/ai`}
        className="ai-widget-btn"
        style={{
          position: "fixed",
          bottom: 24,
          [ar ? "left" : "right"]: 24,
          zIndex: 999,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 4px 20px rgba(37,99,235,0.25), 0 2px 8px rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          transition: "transform 0.2s, box-shadow 0.2s",
          animation: pulse && msgCount === 0 ? "ai-pulse 2s ease-in-out 3" : "none",
          border: "2px solid #EFF6FF",
        }}
        title={ar ? "المساعد الذكي" : "AI Assistant"}
      >
        <AILogoSmall />

        {/* Badge عدد الرسائل */}
        {msgCount > 0 && (
          <div style={{
            position: "absolute",
            top: -4,
            [ar ? "left" : "right"]: -4,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#485668",
            color: "white",
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid white",
          }}>
            {msgCount > 9 ? "9+" : msgCount}
          </div>
        )}

        {/* Tooltip */}
        <div className="ai-tooltip" style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          [ar ? "left" : "right"]: 0,
          background: "#0F172A",
          color: "white",
          fontSize: 12,
          fontWeight: 600,
          padding: "5px 10px",
          borderRadius: 8,
          whiteSpace: "nowrap",
          opacity: 0,
          transform: "translateY(4px)",
          transition: "all 0.15s",
          pointerEvents: "none",
        }}>
          {ar
            ? (msgCount > 0 ? `المساعد الذكي (${msgCount} رسالة)` : "المساعد الذكي")
            : (msgCount > 0 ? `AI Assistant (${msgCount} msgs)` : "AI Assistant")}
        </div>
      </Link>
    </>
  );
}
