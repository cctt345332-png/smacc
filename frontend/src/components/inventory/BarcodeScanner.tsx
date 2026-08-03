"use client";
/**
 * BarcodeScanner — يفتح كاميرا الجوال ويمسح الباركود/QR
 * يستخدم html5-qrcode
 * onResult(text) — يُستدعى عند نجاح المسح
 * onClose() — عند الإغلاق
 */
import { useEffect, useRef, useState } from "react";

interface Props {
  onResult: (text: string) => void;
  onClose: () => void;
  locale?: string;
}

export default function BarcodeScanner({ onResult, onClose, locale = "ar" }: Props) {
  const ar = locale === "ar";
  const scannerRef = useRef<any>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const containerId = "barcode-scanner-container";

  useEffect(() => {
    let html5QrCode: any = null;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        setScanning(true);
        await html5QrCode.start(
          { facingMode: "environment" }, // الكاميرا الخلفية
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            // نجح المسح
            html5QrCode.stop().catch(() => {});
            onResult(decodedText.trim());
          },
          () => {} // خطأ عادي أثناء المسح — نتجاهله
        );
      } catch (err: any) {
        setError(ar ? "تعذّر الوصول للكاميرا. تأكد من منح الإذن." : "Camera access denied. Please allow camera.");
        setScanning(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
      }
    };
  }, []);

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
    }
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      zIndex: 9999, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
    }}>
      {/* رأس */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "16px 20px", display: "flex",
        justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ color: "white", fontWeight: 700, fontSize: 16 }}>
          {ar ? "مسح الباركود" : "Scan Barcode"}
        </div>
        <button onClick={handleClose}
          style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)",
            background: "rgba(255,255,255,0.1)", color: "white", fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
          ×
        </button>
      </div>

      {/* منطقة الكاميرا */}
      <div style={{ position: "relative", width: "100%", maxWidth: 400 }}>
        <div id={containerId} style={{ width: "100%" }} />

        {/* إطار التصويب */}
        {scanning && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <div style={{
              width: 250, height: 250, position: "relative",
            }}>
              {/* زوايا الإطار */}
              {[
                { top: 0, left: 0, borderTop: "3px solid #2563EB", borderLeft: "3px solid #2563EB" },
                { top: 0, right: 0, borderTop: "3px solid #2563EB", borderRight: "3px solid #2563EB" },
                { bottom: 0, left: 0, borderBottom: "3px solid #2563EB", borderLeft: "3px solid #2563EB" },
                { bottom: 0, right: 0, borderBottom: "3px solid #2563EB", borderRight: "3px solid #2563EB" },
              ].map((style, i) => (
                <div key={i} style={{ position: "absolute", width: 24, height: 24, ...style }} />
              ))}

              {/* خط المسح */}
              <div style={{
                position: "absolute", top: "50%", left: 4, right: 4, height: 2,
                background: "rgba(37,99,235,0.8)",
                animation: "scan-line 2s ease-in-out infinite",
              }} />
            </div>
          </div>
        )}
      </div>

      {/* رسالة خطأ */}
      {error && (
        <div style={{
          marginTop: 20, background: "#FEF2F2", border: "1px solid #FECACA",
          borderRadius: 10, padding: "12px 20px", color: "#DC2626",
          fontSize: 13, maxWidth: 340, textAlign: "center",
        }}>
          {error}
          <div style={{ marginTop: 10 }}>
            <button onClick={handleClose}
              style={{ padding: "6px 16px", borderRadius: 8, border: "none",
                background: "#DC2626", color: "white", fontWeight: 600, cursor: "pointer" }}>
              {ar ? "إغلاق" : "Close"}
            </button>
          </div>
        </div>
      )}

      {/* تعليمات */}
      {scanning && !error && (
        <div style={{
          marginTop: 20, color: "rgba(255,255,255,0.8)",
          fontSize: 13, textAlign: "center", padding: "0 20px",
        }}>
          {ar ? "وجّه الكاميرا نحو باركود السيريال" : "Point camera at serial barcode"}
        </div>
      )}

      {/* أنيميشن خط المسح */}
      <style>{`
        @keyframes scan-line {
          0%, 100% { transform: translateY(-60px); opacity: 0.5; }
          50% { transform: translateY(60px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
