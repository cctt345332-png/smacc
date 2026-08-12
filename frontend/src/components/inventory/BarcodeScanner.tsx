"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  onResult: (text: string) => void;
  onClose: () => void;
  locale?: string;
  continuous?: boolean;  // إذا true: الكاميرا تبقى شغالة بعد كل مسح
}

export default function BarcodeScanner({ onResult, onClose, locale = "ar", continuous = false }: Props) {
  const ar = locale === "ar";
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState("");
  const lastScannedRef = useRef("");
  const containerId = "barcode-scanner-container-" + Math.random().toString(36).slice(2);
  const containerIdRef = useRef(containerId);

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        const state = scannerRef.current.getState?.();
        // 2 = SCANNING
        if (state === 2) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear?.();
        scannerRef.current = null;
      }
    } catch { /* صمت */ }
  };

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;

        const html5QrCode = new Html5Qrcode(containerIdRef.current);
        scannerRef.current = html5QrCode;
        setScanning(true);

        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText: string) => {
            if (!mounted) return;
            const text = decodedText.trim();
            if (continuous) {
              // وضع المتواصل: لا توقف الكاميرا، أرسل فقط إذا اختلف عن السابق
              if (text !== lastScannedRef.current) {
                lastScannedRef.current = text;
                setLastScanned(text);
                onResult(text);
                // بعد ثانية امسح التمييز لقبول نفس الرقم مرة ثانية
                setTimeout(() => { lastScannedRef.current = ""; setLastScanned(""); }, 1500);
              }
            } else {
              // وضع عادي: أوقف الكاميرا بعد أول مسح
              stopScanner().then(() => {
                if (mounted) onResult(text);
              });
            }
          },
          () => {}
        );
      } catch {
        if (mounted) {
          setError(ar ? "تعذّر الوصول للكاميرا — تأكد من منح الإذن" : "Camera access denied");
          setScanning(false);
        }
      }
    };

    // Leaflet CSS — Leaflet ليس مطلوباً هنا لكن نضمن عدم التعارض
    startScanner();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, []);

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)",
      zIndex: 9999, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-start",
      paddingTop: 60,
    }}>
      {/* رأس */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "14px 20px", display: "flex",
        justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ color: "white", fontWeight: 700, fontSize: 16 }}>
          {ar ? "مسح الباركود" : "Scan Barcode"}
        </div>
        <button onClick={handleClose}
          style={{
            width: 38, height: 38, borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.5)",
            background: "rgba(255,255,255,0.15)",
            color: "white", fontSize: 20, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          ×
        </button>
      </div>

      {error ? (
        <div style={{
          background: "#FEF2F2", borderRadius: 14, padding: "20px 24px",
          maxWidth: 320, textAlign: "center", margin: "0 20px",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📷</div>
          <div style={{ fontSize: 14, color: "#DC2626", fontWeight: 600, marginBottom: 16 }}>{error}</div>
          <button onClick={handleClose}
            style={{ padding: "10px 24px", borderRadius: 10, border: "none",
              background: "#DC2626", color: "white", fontWeight: 700, cursor: "pointer" }}>
            {ar ? "إغلاق" : "Close"}
          </button>
        </div>
      ) : (
        <div style={{ position: "relative", width: "100%", maxWidth: 400 }}>
          {/* container الكاميرا */}
          <div id={containerIdRef.current} style={{ width: "100%" }} />

          {/* إطار التصويب */}
          {scanning && (
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 240, height: 240, position: "relative" }}>
                {/* زوايا */}
                {[
                  { top: 0, left: 0, borderTop: "3px solid #38BDF8", borderLeft: "3px solid #38BDF8", borderRadius: "4px 0 0 0" },
                  { top: 0, right: 0, borderTop: "3px solid #38BDF8", borderRight: "3px solid #38BDF8", borderRadius: "0 4px 0 0" },
                  { bottom: 0, left: 0, borderBottom: "3px solid #38BDF8", borderLeft: "3px solid #38BDF8", borderRadius: "0 0 0 4px" },
                  { bottom: 0, right: 0, borderBottom: "3px solid #38BDF8", borderRight: "3px solid #38BDF8", borderRadius: "0 0 4px 0" },
                ].map((s, i) => (
                  <div key={i} style={{ position: "absolute", width: 28, height: 28, ...s }} />
                ))}
                {/* خط المسح */}
                <div style={{
                  position: "absolute", left: 6, right: 6, height: 2,
                  background: "linear-gradient(90deg, transparent, #38BDF8, transparent)",
                  animation: "scan 2s ease-in-out infinite",
                  top: "50%",
                }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* تعليمات */}
      {scanning && !error && (
        <div style={{
          marginTop: 24, color: "rgba(255,255,255,0.75)",
          fontSize: 13, textAlign: "center", padding: "0 32px", lineHeight: 1.6,
        }}>
          {ar ? "وجّه الكاميرا نحو الباركود\nسيُمسح تلقائياً" : "Point camera at barcode\nIt will scan automatically"}
          {continuous && lastScanned && (
            <div style={{ marginTop: 10, background: "#059669", color: "white", borderRadius: 8, padding: "6px 16px", fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>
              ✅ {lastScanned}
            </div>
          )}
          {continuous && (
            <div style={{ marginTop: 8, color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
              {ar ? "اضغط ✕ عند الانتهاء" : "Press ✕ when done"}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-60px); opacity: 0.4; }
          50% { transform: translateY(60px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
