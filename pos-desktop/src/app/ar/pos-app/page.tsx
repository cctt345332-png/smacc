"use client";
import { useEffect } from "react";

// helper للتنقل عبر Electron IPC أو window.location
async function navTo(page: string) {
  if (typeof window !== "undefined" && (window as any).electronAPI?.navigate) {
    await (window as any).electronAPI.navigate(page);
  } else {
    window.location.href = `/ar/pos-app/${page}/`;
  }
}

export default function EntryPage() {
  useEffect(() => {
    const go = async () => {
      try {
        if (typeof window !== "undefined" && (window as any).electronAPI) {
          const config = await (window as any).electronAPI.getConfig();
          if (!config.serverUrl) {
            navTo("setup");
          } else if (!config.token) {
            navTo("login");
          } else {
            navTo("cashier");
          }
        } else {
          // fallback localStorage
          const stored = localStorage.getItem("masar-pos-config");
          const config = stored ? JSON.parse(stored) : {};
          if (!config.serverUrl) {
            navTo("setup");
          } else if (!config.token) {
            navTo("login");
          } else {
            navTo("cashier");
          }
        }
      } catch (e) {
        console.error("Entry error:", e);
        navTo("setup");
      }
    };
    go();
  }, []);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#F8FAFC"
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: "#EFF6FF",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px"
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <div style={{ fontSize: 13, color: "#64748B" }}>جاري التحميل...</div>
      </div>
    </div>
  );
}
