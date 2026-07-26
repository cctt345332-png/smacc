"use client";
import { useEffect, useState, useRef, useCallback } from "react";

import { usePOSStore } from "@/store/posStore";
import api from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────
interface Product {
  id: string; name_ar: string; sku?: string; barcode?: string;
  tracking_type: string; sale_price: number; vat_rate: number; quantity_on_hand: number;
}
interface CartLine {
  id: string; inventory_item_id: string; product_name_ar: string;
  barcode?: string; tracking_type: string; quantity: number;
  unit_price: number; discount_pct: number; vat_rate: number;
  serial_item_id?: string; serial_number?: string;
}

const calcLine = (l: CartLine) => {
  const gross = l.quantity * l.unit_price;
  const disc  = (gross * l.discount_pct) / 100;
  const taxable = gross - disc;
  const vat   = (taxable * l.vat_rate) / 100;
  return { gross, disc, taxable, vat, total: taxable + vat };
};
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CashierPage() {
  const navTo = async (p: string) => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.navigate) {
      await (window as any).electronAPI.navigate("login");
    } else {
      window.location.href = p;
    }
  };
  // router removed - using window.location
  const { token, user, serverUrl, terminalId, setTerminalId, logout } = usePOSStore();

  const [loading,      setLoading]      = useState(true);
  const [terminals,    setTerminals]    = useState<any[]>([]);
  const [session,      setSession]      = useState<any>(null);
  const [terminal,     setTerminal]     = useState<any>(null);

  const [search,       setSearch]       = useState("");
  const [products,     setProducts]     = useState<Product[]>([]);
  const [searching,    setSearching]    = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [cart,         setCart]         = useState<CartLine[]>([]);
  const [payMethod,    setPayMethod]    = useState<"cash"|"mada"|"credit_card"|"stc_pay">("cash");
  const [cashTendered, setCashTendered] = useState("");
  const [completing,   setCompleting]   = useState(false);
  const [receiptData,  setReceiptData]  = useState<any>(null);

  const [showOpenForm,   setShowOpenForm]   = useState(false);
  const [openForm,       setOpenForm]       = useState({ terminal_id: "", opening_cash: "0" });
  const [openingSession, setOpeningSession] = useState(false);
  const [openError,      setOpenError]      = useState("");

  // ── init — حمّل من Electron ثم شغّل ─────────────────────────────
  useEffect(() => {
    const boot = async () => {
      let currentToken = token;

      // حمّل من Electron إذا الـ store فارغ
      if (!currentToken && typeof window !== "undefined" && (window as any).electronAPI) {
        const config = await (window as any).electronAPI.getConfig();
        if (!config.token) {
          (window as any).electronAPI.navigate("login");
          return;
        }
        // حدّث الـ store
        usePOSStore.setState({
          token: config.token,
          user: config.user,
          serverUrl: config.serverUrl,
          terminalId: config.terminalId,
        });
        currentToken = config.token;
      } else if (!currentToken) {
        window.location.href = "/ar/pos-app/login/";
        return;
      }

      init();
    };
    boot();
  }, []);

  const init = async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        api.get("/pos/terminals").catch(() => ({ data: [] })),
        api.get("/pos/sessions?limit=20").catch(() => ({ data: [] })),
      ]);
      const allT: any[] = tRes.data || [];
      const allS: any[] = sRes.data || [];
      setTerminals(allT);

      const openS = allS.find((s: any) => s.status === "open");
      if (openS) {
        setSession(openS);
        const t = allT.find((x: any) => x.id === openS.terminal_id) || null;
        setTerminal(t);
        if (t) setTerminalId(t.id);
      } else {
        const savedT = terminalId ? allT.find((x: any) => x.id === terminalId) : null;
        if (savedT) setOpenForm((f) => ({ ...f, terminal_id: savedT.id }));
        setShowOpenForm(true);
      }
    } finally { setLoading(false); }
  };

  // ── search ─────────────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setProducts([]); return; }
    setSearching(true);
    try {
      const r = await api.get(`/inventory/items?search=${encodeURIComponent(q)}&pos_enabled=true&limit=20`);
      setProducts(r.data || []);
    } catch { setProducts([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(t);
  }, [search, doSearch]);

  // ── cart ───────────────────────────────────────────────────────────
  const addToCart = (p: Product) => {
    if (p.tracking_type === "serial") {
      alert("اختر السيريال من النظام الرئيسي");
      return;
    }
    const idx = cart.findIndex((l) => l.inventory_item_id === p.id);
    if (idx >= 0) {
      setCart((c) => c.map((l, i) => i === idx ? { ...l, quantity: l.quantity + 1 } : l));
    } else {
      setCart((c) => [...c, {
        id: Math.random().toString(36).slice(2),
        inventory_item_id: p.id, product_name_ar: p.name_ar,
        barcode: p.barcode, tracking_type: p.tracking_type,
        quantity: 1, unit_price: p.sale_price,
        discount_pct: 0, vat_rate: p.vat_rate,
      }]);
    }
    setSearch(""); setProducts([]);
    searchRef.current?.focus();
  };

  // ── totals ─────────────────────────────────────────────────────────
  const totals = cart.reduce((a, l) => {
    const c = calcLine(l);
    return { sub: a.sub + c.gross, vat: a.vat + c.vat, total: a.total + c.total };
  }, { sub: 0, vat: 0, total: 0 });
  const change = payMethod === "cash" ? Math.max(0, parseFloat(cashTendered || "0") - totals.total) : 0;

  // ── complete sale ──────────────────────────────────────────────────
  const completeSale = async () => {
    if (!session || !cart.length) return;
    if (payMethod === "cash" && parseFloat(cashTendered || "0") < totals.total) {
      alert("المبلغ المدفوع أقل من الإجمالي"); return;
    }
    setCompleting(true);
    try {
      const res = await api.post("/pos/transactions", {
        session_id: session.id,
        lines: cart.map((l) => ({
          inventory_item_id: l.inventory_item_id,
          product_name_ar: l.product_name_ar,
          barcode: l.barcode,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct,
          vat_rate: l.vat_rate,
        })),
        payment_method: payMethod,
        cash_tendered: payMethod === "cash" ? parseFloat(cashTendered || String(totals.total)) : totals.total,
      });
      setReceiptData({ ...res.data, cart: [...cart], totals, change });
      setCart([]); setCashTendered(""); setPayMethod("cash");
      // طباعة تلقائية
      if ((window as any).electronAPI) {
        setTimeout(() => (window as any).electronAPI.printReceipt(), 500);
      }
    } catch (e: any) {
      alert(e?.response?.data?.detail || "حدث خطأ");
    } finally { setCompleting(false); }
  };

  // ── open session ───────────────────────────────────────────────────
  const handleOpenSession = async () => {
    if (!openForm.terminal_id) { setOpenError("اختر الجهاز"); return; }
    setOpeningSession(true); setOpenError("");
    try {
      const r = await api.post("/pos/sessions", {
        terminal_id: openForm.terminal_id,
        opening_cash: parseFloat(openForm.opening_cash) || 0,
      });
      setSession(r.data);
      const t = terminals.find((x) => x.id === openForm.terminal_id) || null;
      setTerminal(t);
      if (t) setTerminalId(t.id);
      setShowOpenForm(false);
    } catch (e: any) { setOpenError(e?.response?.data?.detail || "حدث خطأ"); }
    finally { setOpeningSession(false); }
  };

  // ── loading ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F8FAFC" }}>
      <div style={{ textAlign: "center", color: "#64748B", fontSize: 13 }}>جاري التحميل...</div>
    </div>
  );

  // ── open session screen ────────────────────────────────────────────
  if (showOpenForm) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F8FAFC", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "white", borderRadius: 20, padding: 40, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>فتح جلسة كاشير</h2>
          <p style={{ fontSize: 13, color: "#64748B" }}>مرحباً {user?.full_name}</p>
        </div>
        {openError && <div style={{ background: "#FEF2F2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{openError}</div>}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>الجهاز</label>
          <select value={openForm.terminal_id} onChange={(e) => setOpenForm((f) => ({ ...f, terminal_id: e.target.value }))}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, boxSizing: "border-box" as const }}>
            <option value="">-- اختر الجهاز --</option>
            {terminals.map((t) => <option key={t.id} value={t.id}>{t.name}{t.branch_name ? ` — ${t.branch_name}` : ""}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>رصيد الافتتاح (ريال)</label>
          <input type="number" value={openForm.opening_cash} onChange={(e) => setOpenForm((f) => ({ ...f, opening_cash: e.target.value }))}
            style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, boxSizing: "border-box" as const }} />
        </div>
        <button onClick={handleOpenSession} disabled={openingSession}
          style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: "#2563EB", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          {openingSession ? "جاري الفتح..." : "فتح الجلسة"}
        </button>
        <button onClick={() => { logout(); navTo("/ar/pos-app/login/"); }}
          style={{ width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 10, border: "1.5px solid #E2E8F0", background: "white", fontSize: 13, color: "#64748B", cursor: "pointer" }}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  );

  // ── receipt modal ──────────────────────────────────────────────────
  if (receiptData) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F8FAFC" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 32, maxWidth: 360, width: "100%", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.1)" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>تمت العملية</h3>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#2563EB", margin: "12px 0" }}>{fmt(receiptData.totals.total)} ر.س</div>
        {receiptData.change > 0 && <div style={{ fontSize: 14, color: "#059669", marginBottom: 12 }}>الباقي: {fmt(receiptData.change)} ر.س</div>}
        <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 16, marginTop: 8 }}>
          {receiptData.cart.map((l: CartLine) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span>{l.product_name_ar} x{l.quantity}</span>
              <span style={{ fontWeight: 600 }}>{fmt(l.quantity * l.unit_price)} ر.س</span>
            </div>
          ))}
        </div>
        <button onClick={() => setReceiptData(null)}
          style={{ width: "100%", marginTop: 20, padding: "12px 0", borderRadius: 10, border: "none", background: "#2563EB", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          عملية جديدة
        </button>
      </div>
    </div>
  );

  // ── main cashier UI ────────────────────────────────────────────────
  return (
    <div dir="rtl" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F8FAFC", fontFamily: "Alexandria, sans-serif" }}>

      {/* Top bar */}
      <div style={{ padding: "10px 20px", background: "white", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{terminal?.name || "كاشير"}</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>{user?.full_name} — {user?.tenant_name || "الشركة"}</div>
        </div>
        {session && (
          <div style={{ marginRight: "auto", fontSize: 12, color: "#059669", fontWeight: 600 }}>
            مبيعات الجلسة: {fmt(Number(session.total_sales))} ر.س
          </div>
        )}
        <button onClick={() => { logout(); navTo("/ar/pos-app/login/"); }}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "white", fontSize: 12, color: "#64748B", cursor: "pointer" }}>
          خروج
        </button>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Products */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderLeft: "1px solid #E2E8F0", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #E2E8F0", background: "white" }}>
            <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن صنف أو امسح الباركود..."
              autoFocus
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, outline: "none", boxSizing: "border-box" as const }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {searching && <div style={{ textAlign: "center", padding: 24, color: "#64748B", fontSize: 13 }}>جاري البحث...</div>}
            {!searching && !search && (
              <div style={{ textAlign: "center", padding: 48, color: "#94A3B8" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <div style={{ fontSize: 13 }}>ابحث عن صنف لإضافته للسلة</div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
              {products.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)}
                  style={{ border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "12px 10px", background: "white", cursor: "pointer", textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{p.name_ar}</div>
                  {p.barcode && <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4 }}>{p.barcode}</div>}
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#2563EB" }}>{fmt(p.sale_price)} ر.س</div>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{fmt(p.quantity_on_hand)} قطعة</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cart */}
        <div style={{ width: 340, display: "flex", flexDirection: "column", background: "white", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #E2E8F0", fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>السلة {cart.length > 0 && <span style={{ background: "#2563EB", color: "white", borderRadius: 20, padding: "1px 7px", fontSize: 11 }}>{cart.length}</span>}</span>
            {cart.length > 0 && <button onClick={() => setCart([])} style={{ fontSize: 12, color: "#EF4444", background: "none", border: "none", cursor: "pointer" }}>مسح</button>}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "#94A3B8", fontSize: 12 }}>السلة فارغة</div>
            ) : cart.map((line) => {
              const c = calcLine(line);
              return (
                <div key={line.id} style={{ borderBottom: "1px solid #F1F5F9", padding: "8px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{line.product_name_ar}</div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>{fmt(line.unit_price)} × {line.quantity}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button onClick={() => setCart((c) => c.map((l) => l.id === line.id ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l))}
                      style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <span style={{ fontSize: 13, fontWeight: 600, minWidth: 20, textAlign: "center" }}>{line.quantity}</span>
                    <button onClick={() => setCart((c) => c.map((l) => l.id === line.id ? { ...l, quantity: l.quantity + 1 } : l))}
                      style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#2563EB", minWidth: 60, textAlign: "left" }}>{fmt(c.total)}</span>
                    <button onClick={() => setCart((c) => c.filter((l) => l.id !== line.id))}
                      style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Payment */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B", marginBottom: 4 }}>
              <span>المجموع</span><span>{fmt(totals.sub)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748B", marginBottom: 8 }}>
              <span>ضريبة القيمة المضافة</span><span>{fmt(totals.vat)} ر.س</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
              <span>الإجمالي</span><span style={{ color: "#2563EB" }}>{fmt(totals.total)} ر.س</span>
            </div>

            {/* Payment method */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
              {(["cash", "mada", "credit_card", "stc_pay"] as const).map((m) => (
                <button key={m} onClick={() => setPayMethod(m)}
                  style={{ padding: "8px 0", borderRadius: 8, border: `1.5px solid ${payMethod === m ? "#2563EB" : "#E2E8F0"}`, background: payMethod === m ? "#EFF6FF" : "white", fontSize: 12, fontWeight: payMethod === m ? 700 : 400, color: payMethod === m ? "#2563EB" : "#374151", cursor: "pointer" }}>
                  {m === "cash" ? "نقدي" : m === "mada" ? "مدى" : m === "credit_card" ? "بطاقة" : "STC Pay"}
                </button>
              ))}
            </div>

            {payMethod === "cash" && (
              <div style={{ marginBottom: 10 }}>
                <input type="number" value={cashTendered} onChange={(e) => setCashTendered(e.target.value)}
                  placeholder="المبلغ المستلم"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 14, boxSizing: "border-box" as const }} />
                {change > 0 && <div style={{ fontSize: 13, color: "#059669", fontWeight: 600, marginTop: 4 }}>الباقي: {fmt(change)} ر.س</div>}
              </div>
            )}

            <button onClick={completeSale} disabled={completing || !cart.length || !session}
              style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none", background: cart.length && session ? "#2563EB" : "#CBD5E1", color: "white", fontSize: 15, fontWeight: 700, cursor: cart.length && session ? "pointer" : "not-allowed" }}>
              {completing ? "جاري المعالجة..." : `إتمام البيع — ${fmt(totals.total)} ر.س`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


