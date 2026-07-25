"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/components/layout/AppLayout";
import { AIFeatures, FeatureKey, Message, streamMessage, getAISettings } from "@/lib/ai";
import { useAIContext } from "@/lib/useAIContext";

// ─── SVG Icons ────────────────────────────────────────────────────────
const s = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IcSend    = () => <svg {...s}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IcUser    = () => <svg {...s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcTrash   = () => <svg {...s}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const IcCopy    = () => <svg {...s}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const IcCheck   = () => <svg {...s}><polyline points="20 6 9 17 4 12"/></svg>;
const IcSettings= () => <svg {...s}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>;
const IcStop    = () => <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
const IcMic     = () => <svg {...s}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const IcMicOff  = () => <svg {...s}><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const IcPaperclip=()=> <svg {...s}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>;
const IcX       = () => <svg {...s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcFile    = () => <svg {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;

// ─── Animated AI Logo ─────────────────────────────────────────────────
function AILogo({ size = 64 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 200 200" width={size} height={size}>
      <g clipPath="url(#ai_clip)">
        <mask id="ai_mask" style={{ maskType: "alpha" as const }} width="200" height="200" x="0" y="0" maskUnits="userSpaceOnUse">
          <path fill="#fff" fillRule="evenodd" d="M100 150c27.614 0 50-22.386 50-50s-22.386-50-50-50-50 22.386-50 50 22.386 50 50 50zm0 50c55.228 0 100-44.772 100-100S155.228 0 100 0 0 44.772 0 100s44.772 100 100 100z" clipRule="evenodd"/>
        </mask>
        <g mask="url(#ai_mask)">
          <path fill="#fff" d="M200 0H0v200h200V0z"/>
          <path fill="#2563EB" fillOpacity="0.33" d="M200 0H0v200h200V0z"/>
          <g filter="url(#ai_blur)" style={{ animation: "ai-spin 8s linear infinite", transformOrigin: "center", transformBox: "fill-box" as const }}>
            <path fill="#2563EB" d="M110 32H18v68h92V32z"/>
            <path fill="#1D4ED8" d="M188-24H15v98h173v-98z"/>
            <path fill="#3B82F6" d="M175 70H5v156h170V70z"/>
            <path fill="#60A5FA" d="M230 51H100v103h130V51z"/>
          </g>
        </g>
      </g>
      <defs>
        <filter id="ai_blur" width="385" height="410" x="-75" y="-104" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur result="effect1" stdDeviation="40"/>
        </filter>
        <clipPath id="ai_clip"><path fill="#fff" d="M0 0H200V200H0z"/></clipPath>
      </defs>
    </svg>
  );
}

// ─── Tool Result Card ─────────────────────────────────────────────────
function ToolResultCard({ result, ar }: { result: any; ar: boolean }) {
  if (!result) return null;
  const tool = result.tool || "";

  const s2 = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const IcChart2 = () => <svg {...s2}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;

  return (
    <div style={{ marginTop: 8, background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0", overflow: "hidden", fontSize: 12 }}>
      <div style={{ background: "#EFF6FF", padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid #E2E8F0" }}>
        <IcChart2 />
        <span style={{ fontWeight: 700, color: "#2563EB", fontSize: 11 }}>
          {ar ? "بيانات من النظام" : "Live Data from System"}
        </span>
        {result.period && <span style={{ color: "#64748B", fontSize: 10 }}>· {result.period}</span>}
      </div>
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {Object.entries(result).filter(([k]) => !["tool", "period", "from", "to", "status"].includes(k)).map(([key, val]) => {
          if (Array.isArray(val)) {
            if (val.length === 0) return null;
            return (
              <div key={key}>
                <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4, textTransform: "capitalize" as const }}>{key.replace(/_/g, " ")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {(val as any[]).slice(0, 5).map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, padding: "3px 6px", background: i % 2 === 0 ? "white" : "#F8FAFC", borderRadius: 4 }}>
                      {typeof item === "object" ? Object.entries(item).map(([k2, v2]) => (
                        <span key={k2} style={{ color: "#374151" }}>
                          <span style={{ color: "#94A3B8" }}>{k2}: </span>
                          <strong>{String(v2)}</strong>
                        </span>
                      )) : <span>{String(item)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (typeof val === "object" && val !== null) return null;
          return (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ color: "#64748B" }}>{key.replace(/_/g, " ")}</span>
              <strong style={{ color: "#0F172A" }}>{String(val)}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0" }}>
      {[0, 1, 2].map(i => (
        <motion.div key={i}
          style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--primary)" }}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────
function MessageBubble({ msg, ar }: { msg: Message; ar: boolean }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // تحويل markdown بسيط للـ bold و code
  function renderContent(text: string) {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      // code block
      if (line.startsWith("```")) return null;
      // bold **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((p, j) =>
            p.startsWith("**") && p.endsWith("**")
              ? <strong key={j}>{p.slice(2, -2)}</strong>
              : p
          )}
          {i < lines.length - 1 && <br />}
        </span>
      );
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: "flex",
        flexDirection: isUser ? (ar ? "row" : "row-reverse") : (ar ? "row-reverse" : "row"),
        gap: 10, alignItems: "flex-start", marginBottom: 16,
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isUser ? "var(--primary)" : "white",
        border: isUser ? "none" : "1px solid var(--border)",
        color: isUser ? "white" : "var(--primary)",
        overflow: "hidden",
      }}>
        {isUser ? <IcUser /> : <AILogo size={28} />}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{
          padding: "12px 16px", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isUser ? "var(--primary)" : "white",
          color: isUser ? "white" : "var(--text-primary)",
          border: isUser ? "none" : "1px solid var(--border)",
          fontSize: 14, lineHeight: 1.7,
          boxShadow: isUser ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          {renderContent(msg.content)}
        </div>

        {/* Tool Result Card */}
        {!isUser && msg.toolResult && (
          <ToolResultCard result={msg.toolResult} ar={ar} />
        )}

        {/* Navigate Button */}
        {!isUser && msg.navigateUrl && (
          <a href={`/${ar ? "ar" : "en"}${msg.navigateUrl}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, background: "var(--primary)", color: "white", fontSize: 12, fontWeight: 700, textDecoration: "none", width: "fit-content" }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            {ar ? "فتح الصفحة" : "Open Page"}
          </a>
        )}

        {/* Actions */}
        {!isUser && (
          <div style={{ display: "flex", gap: 4, paddingInlineStart: 4 }}>
            <button onClick={copy} title={ar ? "نسخ" : "Copy"}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px 4px", borderRadius: 4, display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}>
              {copied ? <IcCheck /> : <IcCopy />}
            </button>
            <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>
              {msg.timestamp.toLocaleTimeString(ar ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Suggestion chips ─────────────────────────────────────────────────
const SUGGESTIONS: Record<string, { ar: string; en: string }[]> = {
  general:    [{ ar: "كيف أستخدم النظام؟", en: "How do I use the system?" }, { ar: "ما هي الوحدات المتاحة؟", en: "What modules are available?" }],
  accounting: [{ ar: "كيف أسجل قيد يومية؟", en: "How to record a journal entry?" }, { ar: "اشرح لي الميزانية العمومية", en: "Explain the balance sheet" }],
  inventory:  [{ ar: "كيف أضيف صنف جديد؟", en: "How to add a new item?" }, { ar: "ما هي نقطة إعادة الطلب؟", en: "What is reorder point?" }],
  sales:      [{ ar: "كيف أنشئ فاتورة زاتكا؟", en: "How to create a ZATCA invoice?" }, { ar: "اشرح متطلبات الفاتورة الإلكترونية", en: "Explain e-invoice requirements" }],
  pos:        [{ ar: "كيف أفتح جلسة كاشير؟", en: "How to open a cashier session?" }, { ar: "كيف أطبع فاتورة حرارية؟", en: "How to print a thermal receipt?" }],
  purchases:  [{ ar: "كيف أنشئ أمر شراء؟", en: "How to create a purchase order?" }, { ar: "كيف أطابق الفاتورة مع الأمر؟", en: "How to match invoice with PO?" }],
  reports:    [{ ar: "كيف أقرأ ميزان المراجعة؟", en: "How to read trial balance?" }, { ar: "اشرح تقرير ضريبة القيمة المضافة", en: "Explain VAT report" }],
  treasury:   [{ ar: "كيف أسجل سند قبض؟", en: "How to record a receipt voucher?" }, { ar: "ما الفرق بين سند القبض والصرف؟", en: "Difference between receipt and payment?" }],
};

// ══════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════
export default function AIPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";

  // ── المستوى 1: Context Awareness ─────────────────────────────────
  const contextData = useAIContext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [feature, setFeature] = useState<FeatureKey>("general");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);
  const [abortRef] = useState({ current: false });
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const msgIdRef = useRef(0);
  const STORAGE_KEY = `ai_chat_${locale}`;

  const newId = () => `msg-${++msgIdRef.current}`;

  // تحميل المحادثة المحفوظة عند الدخول
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // استعادة التواريخ
          const restored = parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
          setMessages(restored);
          msgIdRef.current = restored.length;
        }
      }
    } catch {}
  }, []);

  // حفظ المحادثة عند كل تغيير
  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
    }
  }, [messages]);

  // جلب إعدادات AI
  useEffect(() => {
    getAISettings().then(r => {
      setAiEnabled(r.data.is_enabled);
      setEnabledFeatures(r.data.plan_info?.allowed_features || r.data.enabled_features || []);
    }).catch(() => setAiEnabled(false));
  }, []);

  // scroll للأسفل
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  async function send(text?: string) {
    const fileContext = attachedFiles.length > 0
      ? "\n\n[ملفات مرفقة]:\n" + attachedFiles.map(f => `${f.name}:\n${f.content}`).join("\n\n")
      : "";
    const content = ((text || input).trim()) + fileContext;
    if (!content.trim() || loading) return;

    setInput("");
    setAttachedFiles([]);
    if (inputRef.current) { inputRef.current.style.height = "auto"; }

    const userMsg: Message = { id: newId(), role: "user", content, timestamp: new Date(), feature };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setStreaming(true);
    abortRef.current = false;

    // placeholder للـ assistant
    const assistantId = newId();
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date(), feature }]);

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      let fullContent = "";
      let toolResult: any = null;
      let navigateUrl: string | null = null;

      for await (const chunk of streamMessage(feature, history, contextData)) {
        if (abortRef.current) break;

        // tool_result event
        if (typeof chunk === "object" && chunk.type === "tool_result") {
          toolResult = chunk.result;
          continue;
        }

        // navigate event → افتح الصفحة فوراً
        if (typeof chunk === "object" && chunk.type === "navigate") {
          navigateUrl = chunk.url;
          const navLabel = (chunk as any).label || chunk.url;
          const navMsg = ar ? `فتحت لك صفحة ${navLabel}` : `Opening ${navLabel}...`;
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, content: navMsg, navigateUrl: chunk.url }
              : m
          ));
          try { localStorage.setItem("ai_chat_history", JSON.stringify(
            [...messages, userMsg, { id: assistantId, role: "assistant", content: navMsg, navigateUrl: chunk.url }]
          )); } catch {}
          setTimeout(() => {
            window.location.href = `/${locale}${chunk.url}`;
          }, 600);
          return;
        }

        // نص عادي
        if (typeof chunk === "string" && chunk.length > 0) {
          fullContent += chunk;
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: fullContent, toolResult, navigateUrl: navigateUrl || undefined } : m
          ));
        }
      }

      // navigate تم تنفيذه فوراً في الـ loop أعلاه

      if (!fullContent && !navigateUrl && !abortRef.current) {
        // الـ AI رد لكن ما فيه نص — ربما tool_result فقط
        if (toolResult) {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: ar ? "تم جلب البيانات." : "Data retrieved.", toolResult } : m
          ));
        } else {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: ar ? "لم يصل رد. حاول مرة أخرى." : "No response received." } : m
          ));
        }
      }
    } catch (err: any) {
      // استخرج الرسالة الصحيحة
      let errMsg = ar ? "حدث خطأ. حاول مرة أخرى." : "An error occurred. Please try again.";
      const msg = err.message || "";
      if (msg.includes("429") || msg.includes("Too Many")) {
        errMsg = ar ? "⚠️ تجاوزت حد الطلبات المجانية. انتظر دقيقة ثم حاول مرة أخرى، أو أضف مفتاحك الخاص من إعدادات AI." : "⚠️ Rate limit exceeded. Wait a minute and try again, or add your own API key in AI Settings.";
      } else if (msg.includes("401") || msg.includes("403")) {
        errMsg = ar ? "⚠️ مفتاح API غير صالح. تحقق من إعدادات AI." : "⚠️ Invalid API key. Check AI Settings.";
      } else if (msg.includes("404")) {
        errMsg = ar ? "⚠️ الموديل غير متاح. غيّر الموديل من إعدادات AI." : "⚠️ Model not available. Change model in AI Settings.";
      } else if (msg) {
        errMsg = msg;
      }
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: errMsg } : m
      ));
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }

  function stopStream() {
    abortRef.current = true;
    setLoading(false);
    setStreaming(false);
  }

  function clearChat() {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  // ── Voice Recording ───────────────────────────────────────────────
  async function toggleRecording() {
    if (recording) {
      mediaRecorder?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mr.ondataavailable = e => chunks.push(e.data);
      mr.onstop = () => {
        // Web Speech API fallback — نستخدم SpeechRecognition إذا متاح
        stream.getTracks().forEach(t => t.stop());
      };
      // استخدام SpeechRecognition للنص
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = ar ? "ar-SA" : "en-US";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = (e: any) => {
          const transcript = e.results[0][0].transcript;
          setInput(prev => prev + (prev ? " " : "") + transcript);
          if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + "px";
          }
        };
        recognition.onend = () => setRecording(false);
        recognition.start();
        setRecording(true);
        setMediaRecorder(mr);
        setTimeout(() => { recognition.stop(); setRecording(false); }, 10000);
      } else {
        mr.start();
        setRecording(true);
        setMediaRecorder(mr);
      }
    } catch {
      alert(ar ? "لا يمكن الوصول للميكروفون" : "Cannot access microphone");
    }
  }

  // ── File Attachment ───────────────────────────────────────────────
  function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.size > 500 * 1024) {
        alert(ar ? `الملف ${file.name} أكبر من 500KB` : `File ${file.name} exceeds 500KB`);
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        const content = ev.target?.result as string;
        setAttachedFiles(prev => [...prev, { name: file.name, content: content.substring(0, 3000) }]);
      };
      reader.readAsText(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const currentFeature = AIFeatures.find(f => f.key === feature);
  const suggestions = SUGGESTIONS[feature] || SUGGESTIONS.general;
  const isEmpty = messages.length === 0;

  // ── Disabled state ────────────────────────────────────────────────
  if (aiEnabled === false) {
    return (
      <AppLayout locale={locale}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 20, textAlign: "center" }}>
          <AILogo size={80} />
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>
            {ar ? "المساعد الذكي غير مفعّل" : "AI Assistant Not Enabled"}
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 400 }}>
            {ar ? "تواصل مع مدير النظام لتفعيل خدمة الذكاء الاصطناعي لحسابك." : "Contact your system administrator to enable AI for your account."}
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout locale={locale}>
      <style>{`
        @keyframes ai-spin {
          from { transform: rotate(0deg) scale(1); }
          to   { transform: rotate(360deg) scale(1); }
        }
        .ai-input:focus { outline: none; }
        .ai-input::placeholder { color: var(--text-muted); }
        .feature-chip { transition: all 0.15s; }
        .feature-chip:hover { border-color: var(--primary) !important; color: var(--primary) !important; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--header-height) - 48px)", gap: 0 }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <AILogo size={40} />
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>
                {ar ? "المساعد الذكي" : "AI Assistant"}
              </h1>
              <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {ar ? `وضع: ${currentFeature?.ar}` : `Mode: ${currentFeature?.en}`}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {messages.length > 0 && (
              <button onClick={clearChat} className="btn btn-secondary btn-sm">
                <IcTrash /> {ar ? "مسح المحادثة" : "Clear Chat"}
              </button>
            )}
            <a href={`/${locale}/settings/ai`} className="btn btn-secondary btn-sm">
              <IcSettings /> {ar ? "إعدادات AI" : "AI Settings"}
            </a>
          </div>
        </div>

        {/* ── Feature Tabs ───────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {AIFeatures.filter(f => enabledFeatures.includes(f.key) || f.key === "general").map(f => (
            <button key={f.key} onClick={() => setFeature(f.key as FeatureKey)}
              className="feature-chip"
              style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${feature === f.key ? "var(--primary)" : "var(--border)"}`,
                background: feature === f.key ? "var(--primary-light)" : "var(--surface)",
                color: feature === f.key ? "var(--primary)" : "var(--text-secondary)",
                cursor: "pointer",
              }}>
              {ar ? f.ar : f.en}
            </button>
          ))}
        </div>

        {/* ── Chat Area ──────────────────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "8px 4px",
          display: "flex", flexDirection: "column",
        }}>

          {/* Empty state */}
          {isEmpty && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 20, paddingTop: 40 }}
            >
              <AILogo size={80} />
              <div style={{ textAlign: "center" }}>
                <motion.h2
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}
                >
                  <span style={{ background: "linear-gradient(135deg, #2563EB, #60A5FA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {ar ? "كيف يمكنني مساعدتك؟" : "How can I help you?"}
                  </span>
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  style={{ fontSize: 14, color: "var(--text-secondary)" }}
                >
                  {ar ? "اسألني أي شيء عن النظام أو اختر اقتراحاً أدناه" : "Ask me anything about the system or pick a suggestion below"}
                </motion.p>
              </div>

              {/* Suggestions */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: 600 }}
              >
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => send(ar ? s.ar : s.en)}
                    style={{
                      padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 500,
                      border: "1.5px solid var(--border)", background: "var(--surface)",
                      color: "var(--text-primary)", cursor: "pointer", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "var(--primary-light)"; e.currentTarget.style.color = "var(--primary)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                  >
                    {ar ? s.ar : s.en}
                  </button>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* Messages */}
          <AnimatePresence>
            {messages.map(msg => (
              <div key={msg.id}>
                {msg.content === "" && msg.role === "assistant"
                  ? (
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16, flexDirection: ar ? "row-reverse" : "row" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                        <AILogo size={28} />
                      </div>
                      <div style={{ padding: "12px 16px", borderRadius: "18px 18px 18px 4px", background: "white", border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                        <TypingDots />
                      </div>
                    </div>
                  )
                  : <MessageBubble msg={msg} ar={ar} />
                }
              </div>
            ))}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>

        {/* ── Input Area ─────────────────────────────────────────── */}
        <div style={{
          background: "var(--surface)", border: "1.5px solid var(--border)",
          borderRadius: 16, padding: "12px 16px", marginTop: 12,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          {/* Attached files */}
          {attachedFiles.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {attachedFiles.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "var(--bg)", border: "1px solid var(--border)", fontSize: 12 }}>
                  <IcFile />
                  <span style={{ color: "var(--text-primary)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 0 }}>
                    <IcX />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={ar ? `اسأل عن ${currentFeature?.ar}...` : `Ask about ${currentFeature?.en}...`}
            rows={1}
            className="ai-input"
            style={{
              width: "100%", resize: "none", border: "none", background: "transparent",
              fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6,
              fontFamily: "inherit", maxHeight: 160, overflowY: "auto",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {/* File attach */}
              <input ref={fileInputRef} type="file" multiple accept=".txt,.csv,.json,.md,.pdf" style={{ display: "none" }} onChange={handleFileAttach} />
              <button onClick={() => fileInputRef.current?.click()}
                title={ar ? "إرفاق ملف" : "Attach file"}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px 6px", borderRadius: 6, display: "flex", alignItems: "center" }}
                onMouseEnter={e => e.currentTarget.style.color = "var(--primary)"}
                onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>
                <IcPaperclip />
              </button>
              {/* Voice */}
              <button onClick={toggleRecording}
                title={ar ? (recording ? "إيقاف التسجيل" : "تسجيل صوتي") : (recording ? "Stop recording" : "Voice input")}
                style={{ background: recording ? "#FEE2E2" : "none", border: "none", cursor: "pointer", color: recording ? "var(--danger)" : "var(--text-muted)", padding: "4px 6px", borderRadius: 6, display: "flex", alignItems: "center", transition: "all 0.15s" }}
                onMouseEnter={e => { if (!recording) e.currentTarget.style.color = "var(--primary)"; }}
                onMouseLeave={e => { if (!recording) e.currentTarget.style.color = "var(--text-muted)"; }}>
                {recording ? <IcMicOff /> : <IcMic />}
              </button>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {recording ? (ar ? "جاري التسجيل..." : "Recording...") : (ar ? "Enter للإرسال" : "Enter to send")}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {streaming && (
                <button onClick={stopStream} className="btn btn-secondary btn-sm">
                  <IcStop /> {ar ? "إيقاف" : "Stop"}
                </button>
              )}
              <button
                onClick={() => send()}
                disabled={!input.trim() && attachedFiles.length === 0 || loading}
                style={{
                  width: 36, height: 36, borderRadius: "50%", border: "none",
                  background: (input.trim() || attachedFiles.length > 0) && !loading ? "var(--primary)" : "var(--border)",
                  color: (input.trim() || attachedFiles.length > 0) && !loading ? "white" : "var(--text-muted)",
                  cursor: (input.trim() || attachedFiles.length > 0) && !loading ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}
              >
                <IcSend />
              </button>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
