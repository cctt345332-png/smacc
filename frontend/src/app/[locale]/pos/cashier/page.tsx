
"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSessions, openSession, getTerminals, getMyTerminal, createTransaction, closeSession, posPurchase } from "@/lib/pos";
import { getItemsForPicker, getAvailableSerials, getBatches, getVariants } from "@/lib/inventory";
import { getCompany } from "@/lib/settings";
import { Icon } from "@/components/ui/Icons";
import ThermalReceipt from "@/components/pos/ThermalReceipt";
import { useAuthStore } from "@/store/authStore";

// ─── Activity config ──────────────────────────────────────────────────
const ACTIVITY_CFG: Record<string, { label: string; icon: any; color: string; bg: string; tracking: string; allowPurchase: boolean }> = {
  mobile_phones: { label: "جوالات وإلكترونيات", icon: "mobile",       color: "#3E0865", bg: "#F4EFF7", tracking: "serial",   allowPurchase: true  },
  spare_parts:   { label: "قطع غيار",            icon: "spareParts",   color: "#365F45", bg: "#EEF4ED", tracking: "serial",   allowPurchase: true  },
  pharmacy:      { label: "صيدلية",              icon: "pharmacy",     color: "#176545", bg: "#EAF5ED", tracking: "batch",    allowPurchase: false },
  grocery:       { label: "بقالة",               icon: "grocery",      color: "#9A6B13", bg: "#FFF8E5", tracking: "quantity", allowPurchase: false },
  spices:        { label: "عطارة وتوابل",         icon: "spices",       color: "#8B651D", bg: "#FCF5E2", tracking: "weight",   allowPurchase: false },
  clothing:      { label: "ملابس وأزياء",         icon: "clothing",     color: "#516A5B", bg: "#EDF2EC", tracking: "variant",  allowPurchase: false },
  construction:  { label: "مواد بناء",            icon: "construction", color: "#4D5C54", bg: "#E9ECE6", tracking: "quantity", allowPurchase: false },
  general:       { label: "عام",                 icon: "general",      color: "#3E0865", bg: "#F2F6F1", tracking: "quantity", allowPurchase: false },
};

interface CartLine {
  id: string; inventory_item_id: string; product_name_ar: string;
  barcode?: string; tracking_type: string; quantity: number;
  unit_price: number; discount_pct: number; vat_rate: number;
  serial_item_id?: string; serial_number?: string;
  variant_id?: string; variant_label?: string;
  batch_id?: string; batch_label?: string;
}
interface Product {
  id: string; name_ar: string; sku?: string; barcode?: string;
  tracking_type: string; sale_price: number; vat_rate: number; quantity_on_hand: number;
}

const calcLine = (l: CartLine) => {
  const gross = l.quantity * l.unit_price;
  const disc  = (gross * l.discount_pct) / 100;
  const taxable = gross - disc;
  const vat   = (taxable * l.vat_rate) / 100;
  return { gross, disc, taxable, vat, total: taxable + vat };
};
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAYMENT_LABELS: Record<string, string> = { cash: "نقدي", mada: "مدى", credit_card: "بطاقة ائتمان", stc_pay: "STC Pay", split: "مقسّم" };

export default function POSCashierPage() {
  const params        = useParams();
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const locale        = (params?.locale as string) || "ar";
  const isAr          = locale === "ar";
  const dir           = isAr ? "rtl" : "ltr";
  const terminalParam = searchParams?.get("terminal");
  const sar           = isAr ? "ر.س" : "SAR";
  const { user }      = useAuthStore();
  const isCashierRole = user?.role === "cashier";

  // ── state ──────────────────────────────────────────────────────────
  const [loading,      setLoading]      = useState(true);
  const [terminal,     setTerminal]     = useState<any>(null);
  const [terminals,    setTerminals]    = useState<any[]>([]);
  const [session,      setSession]      = useState<any>(null);
  const [actCfg,       setActCfg]       = useState(ACTIVITY_CFG.general);

  const [search,       setSearch]       = useState("");
  const [products,     setProducts]     = useState<Product[]>([]);
  const [searching,    setSearching]    = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [cart,         setCart]         = useState<CartLine[]>([]);
  const [payMethod,    setPayMethod]    = useState<"cash"|"mada"|"credit_card"|"stc_pay"|"split">("cash");
  const [cashTendered, setCashTendered] = useState("");
  const [cardAmount,   setCardAmount]   = useState("");
  const [custName,     setCustName]     = useState("");
  const [custPhone,    setCustPhone]    = useState("");
  const [overallDisc,  setOverallDisc]  = useState("0");
  const [completing,   setCompleting]   = useState(false);
  const [receiptModal, setReceiptModal] = useState<any>(null);

  // open session form
  const [showOpenForm,   setShowOpenForm]   = useState(false);
  const [openForm,       setOpenForm]       = useState({ terminal_id: "", opening_cash: "0" });
  const [openingSession, setOpeningSession] = useState(false);
  const [openError,      setOpenError]      = useState("");

  // close session
  const [showCloseForm,  setShowCloseForm]  = useState(false);
  const [closingCash,    setClosingCash]    = useState("");
  const [closingSession, setClosingSession] = useState(false);

  // modals for tracking types
  const [serialModal,  setSerialModal]  = useState<{ product: Product; serials: any[] } | null>(null);
  const [variantModal, setVariantModal] = useState<{ product: Product; variants: any[] } | null>(null);
  const [weightModal,  setWeightModal]  = useState<{ product: Product } | null>(null);
  const [weightInput,  setWeightInput]  = useState("");

  // purchase modal (جوالات / قطع غيار)
  const [showPurchase,   setShowPurchase]   = useState(false);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [purchaseProds,  setPurchaseProds]  = useState<Product[]>([]);
  const [purchaseProd,   setPurchaseProd]   = useState<Product | null>(null);
  const [purchaseForm,   setPurchaseForm]   = useState({ serial_number: "", condition: "new", cost_price: "", sale_price: "", notes: "" });
  const [savingPurchase, setSavingPurchase] = useState(false);

  // بيانات الشركة للفاتورة الحرارية
  const [company, setCompany] = useState<any>(null);

  // ── init ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [tRes, sRes] = await Promise.all([
          getTerminals().catch(() => ({ data: [] })),
          getSessions({ limit: 20 }).catch(() => ({ data: [] })),
          getCompany().then((r) => setCompany(r.data)).catch(() => {}),
        ]);
        const allT: any[] = tRes.data || [];
        const allS: any[] = sRes.data || [];
        setTerminals(allT);

        const openS = allS.find((s: any) => s.status === "open");
        if (openS) {
          setSession(openS);
          const t = allT.find((x: any) => x.id === openS.terminal_id) || null;
          setTerminal(t);
          setActCfg(ACTIVITY_CFG[t?.business_type || "general"] || ACTIVITY_CFG.general);
        } else if (terminalParam) {
          const t = allT.find((x: any) => x.id === terminalParam) || null;
          setTerminal(t);
          setActCfg(ACTIVITY_CFG[t?.business_type || "general"] || ACTIVITY_CFG.general);
          setOpenForm((f) => ({ ...f, terminal_id: terminalParam }));
          setShowOpenForm(true);
        } else if (isCashierRole) {
          // الكاشير — ابحث عن الجهاز المخصص له
          try {
            const myRes = await getMyTerminal();
            if (myRes?.data?.id) {
              const t = allT.find((x: any) => x.id === myRes.data.id) || myRes.data;
              setTerminal(t);
              setActCfg(ACTIVITY_CFG[t?.business_type || "general"] || ACTIVITY_CFG.general);
              setOpenForm((f) => ({ ...f, terminal_id: myRes.data.id }));
              setShowOpenForm(true);
              return;
            }
          } catch {}
          setShowOpenForm(true);
        } else {
          setShowOpenForm(true);
        }
      } finally { setLoading(false); }
    })();
  }, []);

  // ── search products ────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setProducts([]); return; }
    setSearching(true);
    try {
      const r = await getItemsForPicker({ search: q });
      const items = (r.data || []).filter((p: any) => p.pos_enabled !== false);
      setProducts(items);
      // باركود مطابق تماماً → أضف مباشرة بدون انتظار
      const exact = items.find((p: any) =>
        p.barcode && p.barcode.trim() === q.trim()
      );
      if (exact && items.length === 1) {
        await addToCart(exact);
        setSearch("");
        setProducts([]);
      }
    } catch { setProducts([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(t);
  }, [search, doSearch]);

  // ── purchase search ────────────────────────────────────────────────
  useEffect(() => {
    if (!purchaseSearch.trim()) { setPurchaseProds([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await getItemsForPicker({ search: purchaseSearch });
        setPurchaseProds((r.data || []).filter((p: any) => p.tracking_type === "serial"));
      } catch { setPurchaseProds([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [purchaseSearch]);

  // ── add to cart ────────────────────────────────────────────────────
  const addToCart = async (p: Product) => {
    if (p.tracking_type === "serial") {
      const r = await getAvailableSerials(p.id).catch(() => ({ data: [] }));
      const serials = r.data || [];
      if (!serials.length) { alert(isAr ? "لا يوجد مخزون متاح" : "No stock available"); return; }
      setSerialModal({ product: p, serials });
      return;
    }
    if (p.tracking_type === "variant") {
      const r = await getVariants(p.id).catch(() => ({ data: [] }));
      const variants = r.data || [];
      if (!variants.length) { alert(isAr ? "لا توجد متغيرات" : "No variants"); return; }
      setVariantModal({ product: p, variants });
      return;
    }
    if (p.tracking_type === "weight") {
      setWeightModal({ product: p }); setWeightInput(""); return;
    }
    if (p.tracking_type === "batch") {
      const r = await getBatches(p.id).catch(() => ({ data: [] }));
      const batches: any[] = (r.data || []).filter((b: any) => Number(b.quantity) > 0);
      if (!batches.length) { alert(isAr ? "لا يوجد مخزون متاح" : "No stock available"); return; }
      batches.sort((a, b) => (!a.expiry_date ? 1 : !b.expiry_date ? -1 : new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()));
      const b = batches[0];
      const days = b.expiry_date ? Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86400000) : null;
      if (days !== null && days < 30 && !confirm(isAr ? `ينتهي خلال ${days} يوم. متابعة؟` : `Expires in ${days} days. Continue?`)) return;
      addLine(p, { batch_id: b.id, batch_label: `${b.batch_number}${b.expiry_date ? ` — ${new Date(b.expiry_date).toLocaleDateString()}` : ""}` });
      return;
    }
    addLine(p);
  };

  const addLine = (p: Product, extra: Partial<CartLine> = {}) => {
    const price = (extra as any).sale_price ?? p.sale_price;
    if (extra.serial_item_id && cart.find((l) => l.serial_item_id === extra.serial_item_id)) {
      alert(isAr ? "السيريال موجود بالفعل في السلة" : "Serial already in cart"); return;
    }
    if (!extra.serial_item_id && !extra.variant_id) {
      const idx = cart.findIndex((l) => l.inventory_item_id === p.id && !l.serial_item_id && !l.variant_id);
      if (idx >= 0) { setCart((c) => c.map((l, i) => i === idx ? { ...l, quantity: l.quantity + 1 } : l)); setSearch(""); setProducts([]); return; }
    }
    setCart((c) => [...c, {
      id: Math.random().toString(36).slice(2),
      inventory_item_id: p.id, product_name_ar: p.name_ar,
      barcode: p.barcode, tracking_type: p.tracking_type,
      quantity: 1, unit_price: price,
      discount_pct: 0, vat_rate: p.vat_rate, ...extra,
    }]);
    setSearch(""); setProducts([]);
    searchRef.current?.focus();
  };

  // ── totals ─────────────────────────────────────────────────────────
  const totals = cart.reduce((a, l) => {
    const c = calcLine(l);
    return { sub: a.sub + c.gross, disc: a.disc + c.disc, vat: a.vat + c.vat, total: a.total + c.total };
  }, { sub: 0, disc: 0, vat: 0, total: 0 });
  const overallDiscAmt = (totals.sub * parseFloat(overallDisc || "0")) / 100;
  const grandTotal     = Math.max(0, totals.total - overallDiscAmt);
  const change         = payMethod === "cash" ? Math.max(0, parseFloat(cashTendered || "0") - grandTotal) : 0;

  // ── complete sale ──────────────────────────────────────────────────
  const completeSale = async () => {
    if (!session)     { alert(isAr ? "لا توجد جلسة مفتوحة" : "No open session"); return; }
    if (!cart.length) { alert(isAr ? "السلة فارغة" : "Cart is empty"); return; }
    if (payMethod === "cash" && parseFloat(cashTendered || "0") < grandTotal) {
      alert(isAr ? "المبلغ المدفوع أقل من الإجمالي" : "Insufficient cash"); return;
    }
    setCompleting(true);
    try {
      const res = await createTransaction({
        session_id: session.id,
        lines: cart.map((l) => ({
          inventory_item_id: l.inventory_item_id,
          product_name_ar: l.product_name_ar,
          barcode: l.barcode,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct,
          vat_rate: l.vat_rate,
          serial_item_id: l.serial_item_id,
          variant_id: l.variant_id,
          batch_id: l.batch_id,
        })),
        payment_method: payMethod,
        cash_tendered: payMethod === "cash" ? parseFloat(cashTendered || String(grandTotal)) : grandTotal,
        card_amount: payMethod === "split" ? parseFloat(cardAmount || "0") : undefined,
        customer_name: custName || undefined,
        customer_phone: custPhone || undefined,
        discount_amount: overallDiscAmt,
      });
      setReceiptModal({ ...res.data, cart: [...cart], grandTotal, change, payMethod });
      setCart([]); setCashTendered(""); setCardAmount(""); setCustName(""); setCustPhone(""); setOverallDisc("0"); setPayMethod("cash");
      // طباعة تلقائية إذا كان الجهاز مضبوط على الطباعة
      if (terminal?.print_receipt) {
        setTimeout(() => window.print(), 800);
      }
      const sr = await getSessions({ limit: 20 });
      const up = (sr.data || []).find((s: any) => s.id === session.id);
      if (up) setSession(up);
    } catch (e: any) { alert(e?.response?.data?.detail || (isAr ? "حدث خطأ" : "Error")); }
    finally { setCompleting(false); }
  };

  // ── open session ───────────────────────────────────────────────────
  const handleOpenSession = async () => {
    if (!openForm.terminal_id) { setOpenError(isAr ? "اختر الجهاز" : "Select terminal"); return; }
    setOpeningSession(true); setOpenError("");
    try {
      const r = await openSession({ terminal_id: openForm.terminal_id, opening_cash: parseFloat(openForm.opening_cash) || 0 });
      setSession(r.data);
      const t = terminals.find((x) => x.id === openForm.terminal_id) || null;
      setTerminal(t);
      setActCfg(ACTIVITY_CFG[t?.business_type || "general"] || ACTIVITY_CFG.general);
      setShowOpenForm(false);
    } catch (e: any) { setOpenError(e?.response?.data?.detail || (isAr ? "حدث خطأ" : "Error")); }
    finally { setOpeningSession(false); }
  };

  // ── close session ──────────────────────────────────────────────────
  const handleCloseSession = async () => {
    if (!session) return;
    setClosingSession(true);
    try {
      await closeSession(session.id, { closing_cash: parseFloat(closingCash || "0") });
      if (isCashierRole) {
        // الكاشير — أعد تعيين الجلسة وافتح نموذج جلسة جديدة
        setSession(null);
        setShowCloseForm(false);
        setCart([]);
        setShowOpenForm(true);
      } else {
        // المدير — وجّه لتقرير الجلسة
        router.push(`/${locale}/pos/sessions/${session.id}`);
      }
    } catch (e: any) { alert(e?.response?.data?.detail || (isAr ? "حدث خطأ" : "Error")); }
    finally { setClosingSession(false); }
  };

  // ── pos purchase ───────────────────────────────────────────────────
  const handlePurchase = async () => {
    if (!purchaseProd || !purchaseForm.serial_number || !purchaseForm.cost_price) {
      alert(isAr ? "أكمل الحقول المطلوبة" : "Fill required fields"); return;
    }
    setSavingPurchase(true);
    try {
      await posPurchase({
        inventory_item_id: purchaseProd.id,
        serial_number: purchaseForm.serial_number,
        condition: purchaseForm.condition,
        cost_price: parseFloat(purchaseForm.cost_price),
        sale_price: purchaseForm.sale_price ? parseFloat(purchaseForm.sale_price) : undefined,
        notes: purchaseForm.notes || undefined,
      });
      alert(isAr ? "تم إضافة السيريال للمخزون بنجاح" : "Serial added to stock successfully");
      setPurchaseProd(null); setPurchaseSearch(""); setPurchaseProds([]);
      setPurchaseForm({ serial_number: "", condition: "new", cost_price: "", sale_price: "", notes: "" });
      setShowPurchase(false);
    } catch (e: any) { alert(e?.response?.data?.detail || (isAr ? "حدث خطأ" : "Error")); }
    finally { setSavingPurchase(false); }
  };

  // ── loading ────────────────────────────────────────────────────────
  if (loading) return (
    <div dir={dir} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh" }}>
      <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
        <div style={{ color: "var(--primary)", marginBottom: 12, display: "flex", justifyContent: "center" }}>
          <Icon name="pos" size={40} />
        </div>
        <div style={{ fontSize: 13 }}>{isAr ? "جاري التحميل..." : "Loading..."}</div>
      </div>
    </div>
  );

  // ── open session screen ────────────────────────────────────────────
  if (showOpenForm) return (
    <div dir={dir} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
      <div className="card" style={{ width: "100%", maxWidth: 440, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: actCfg.bg, display: "flex", alignItems: "center", justifyContent: "center", color: actCfg.color, margin: "0 auto 12px" }}>
            <Icon name={actCfg.icon} size={32} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            {isAr ? "فتح الصندوق" : "Open Cash Register"}
          </h2>
          {terminal ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {terminal.name}{terminal.branch_name ? ` — ${terminal.branch_name}` : ""}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{isAr ? "اختر الجهاز وأدخل رصيد الافتتاح" : "Select terminal and enter opening cash"}</p>
          )}
          {isCashierRole && user && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
              {isAr ? "مرحباً" : "Welcome"}, <strong>{user.id}</strong>
            </div>
          )}
        </div>
        {openError && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="warning" size={14} />{openError}
          </div>
        )}

        {/* اختيار الجهاز — للمدير فقط أو إذا ما في جهاز محدد */}
        {(!isCashierRole || !openForm.terminal_id) && (
          <div className="form-group">
            <label className="form-label">{isAr ? "الجهاز" : "Terminal"} <span className="required">*</span></label>
            <select className="form-input form-select" value={openForm.terminal_id}
              onChange={(e) => {
                const t = terminals.find((x) => x.id === e.target.value);
                setOpenForm((f) => ({ ...f, terminal_id: e.target.value }));
                if (t) { setTerminal(t); setActCfg(ACTIVITY_CFG[t.business_type] || ACTIVITY_CFG.general); }
              }}>
              <option value="">{isAr ? "-- اختر الجهاز --" : "-- Select Terminal --"}</option>
              {terminals.map((t) => {
                const cfg = ACTIVITY_CFG[t.business_type] || ACTIVITY_CFG.general;
                return <option key={t.id} value={t.id}>{t.name}{t.branch_name ? ` — ${t.branch_name}` : ""} ({cfg.label})</option>;
              })}
            </select>
          </div>
        )}

        {/* رصيد الافتتاح */}
        <div className="form-group">
          <label className="form-label">{isAr ? "رصيد الافتتاح (ريال)" : "Opening Cash (SAR)"}</label>
          <input type="number" className="form-input" min={0} step={0.01} value={openForm.opening_cash}
            onChange={(e) => setOpenForm((f) => ({ ...f, opening_cash: e.target.value }))}
            autoFocus />
        </div>

        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px 0", fontSize: 15 }}
          onClick={handleOpenSession} disabled={openingSession}>
          <Icon name="session" size={16} />
          {openingSession ? (isAr ? "جاري الفتح..." : "Opening...") : (isAr ? "فتح الصندوق" : "Open Register")}
        </button>

        {/* زر الرجوع — للمدير فقط */}
        {!isCashierRole && (
          <button className="btn btn-secondary" style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
            onClick={() => router.push(`/${locale}/pos`)}>
            <Icon name="arrowLeft" size={16} />
            {isAr ? "رجوع" : "Back"}
          </button>
        )}
      </div>
    </div>
  );

  // ── main cashier UI ────────────────────────────────────────────────
  return (
    <div dir={dir} className="legacy-pos" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--header-height))", overflow: "hidden" }}>

      {/* ── Top bar ── */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--surface)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {/* زر الرجوع — للمدير فقط */}
        {!isCashierRole && (
          <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/${locale}/pos`)}>
            <Icon name={isAr ? "arrowRight" : "arrowLeft"} size={16} />
          </button>
        )}
        {terminal && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: actCfg.bg, display: "flex", alignItems: "center", justifyContent: "center", color: actCfg.color }}>
              <Icon name={actCfg.icon} size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{terminal.name}</div>
              <div style={{ fontSize: 11, color: actCfg.color, fontWeight: 600 }}>{actCfg.label}</div>
            </div>
          </div>
        )}
        {session && (
          <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {isAr ? "مبيعات الجلسة:" : "Session sales:"}{" "}
              <span style={{ fontWeight: 700, color: "var(--success)" }}>{fmt(Number(session.total_sales))} {sar}</span>
            </div>
            {actCfg.allowPurchase && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowPurchase(true)}>
                <Icon name="purchase" size={14} />
                {isAr ? "شراء" : "Purchase"}
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => { setClosingCash(String(session.total_cash || 0)); setShowCloseForm(true); }}>
              <Icon name="lock" size={14} />
              {isAr ? "إغلاق الجلسة" : "Close Session"}
            </button>
          </div>
        )}
        {/* زر تسجيل الخروج للكاشير */}
        {isCashierRole && (
          <div style={{ marginInlineStart: session ? 8 : "auto" }}>
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", fontSize: 12 }}
              onClick={() => {
                if (confirm(isAr ? "تسجيل الخروج؟" : "Log out?")) {
                  useAuthStore.getState().logout();
                  router.replace(`/${locale}/login`);
                }
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              {isAr ? "خروج" : "Logout"}
            </button>
          </div>
        )}
      </div>

      {/* ── Body: products + cart ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Left: product search ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderInlineEnd: "1px solid var(--border)", overflow: "hidden" }}>
          {/* Search bar */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", insetInlineStart: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}>
                <Icon name="search" size={16} />
              </span>
              <input
                ref={searchRef}
                className="form-input"
                style={{ paddingInlineStart: 34 }}
                placeholder={isAr ? "ابحث عن صنف أو امسح الباركود..." : "Search item or scan barcode..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Product results */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {searching && (
              <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 13 }}>
                {isAr ? "جاري البحث..." : "Searching..."}
              </div>
            )}
            {!searching && search && products.length === 0 && (
              <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 13 }}>
                <Icon name="search" size={24} />
                <div style={{ marginTop: 8 }}>{isAr ? "لا توجد نتائج" : "No results"}</div>
              </div>
            )}
            {!searching && !search && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: actCfg.color, opacity: 0.4 }}>
                  <Icon name={actCfg.icon} size={48} />
                </div>
                <div style={{ fontSize: 13 }}>{isAr ? "ابحث عن صنف لإضافته للسلة" : "Search for an item to add to cart"}</div>
                <div style={{ fontSize: 11, color: actCfg.color, fontWeight: 600, marginTop: 4 }}>{actCfg.label}</div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
              {products.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)}
                  style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 10px", background: "var(--surface)", cursor: "pointer", textAlign: isAr ? "right" : "left", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = actCfg.color; e.currentTarget.style.background = actCfg.bg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{p.name_ar}</div>
                  {p.barcode && <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{p.barcode}</div>}
                  <div style={{ fontSize: 13, fontWeight: 700, color: actCfg.color }}>{fmt(p.sale_price)} {sar}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                    {p.tracking_type === "serial" ? (isAr ? `${p.quantity_on_hand} سيريال` : `${p.quantity_on_hand} serials`) :
                     p.tracking_type === "batch"  ? (isAr ? "تشغيلة" : "Batch") :
                     p.tracking_type === "variant" ? (isAr ? "متغيرات" : "Variants") :
                     p.tracking_type === "weight"  ? (isAr ? "وزن" : "Weight") :
                     `${fmt(p.quantity_on_hand)} ${isAr ? "قطعة" : "pcs"}`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: cart + payment ── */}
        <div style={{ width: 360, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
          {/* Cart header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14 }}>
              <Icon name="cart" size={16} />
              {isAr ? "السلة" : "Cart"}
              {cart.length > 0 && <span style={{ background: actCfg.color, color: "white", borderRadius: 20, padding: "1px 7px", fontSize: 11 }}>{cart.length}</span>}
            </div>
            {cart.length > 0 && (
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", fontSize: 12 }} onClick={() => setCart([])}>
                <Icon name="trash" size={13} />
                {isAr ? "مسح" : "Clear"}
              </button>
            )}
          </div>

          {/* Cart lines */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, opacity: 0.3 }}><Icon name="cart" size={36} /></div>
                <div style={{ fontSize: 12 }}>{isAr ? "السلة فارغة" : "Cart is empty"}</div>
              </div>
            ) : (
              cart.map((line) => {
                const c = calcLine(line);
                return (
                  <div key={line.id} style={{ borderBottom: "1px solid var(--border)", padding: "8px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{line.product_name_ar}</div>
                        {line.serial_number && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>SN: {line.serial_number}</div>}
                        {line.variant_label  && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{line.variant_label}</div>}
                        {line.batch_label    && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{line.batch_label}</div>}
                      </div>
                      <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "var(--danger)", flexShrink: 0 }}
                        onClick={() => setCart((c) => c.filter((l) => l.id !== line.id))}>
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                      {line.tracking_type !== "serial" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button className="btn btn-ghost btn-sm btn-icon" style={{ width: 22, height: 22, fontSize: 14 }}
                            onClick={() => setCart((c) => c.map((l) => l.id === line.id ? { ...l, quantity: Math.max(0.001, l.quantity - 1) } : l))}>−</button>
                          <input type="number" style={{ width: 48, textAlign: "center", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 4px", fontSize: 12 }}
                            value={line.quantity} min={0.001} step={line.tracking_type === "weight" ? 0.1 : 1}
                            onChange={(e) => setCart((c) => c.map((l) => l.id === line.id ? { ...l, quantity: parseFloat(e.target.value) || 1 } : l))} />
                          <button className="btn btn-ghost btn-sm btn-icon" style={{ width: 22, height: 22, fontSize: 14 }}
                            onClick={() => setCart((c) => c.map((l) => l.id === line.id ? { ...l, quantity: l.quantity + 1 } : l))}>+</button>
                        </div>
                      )}
                      <div style={{ marginInlineStart: "auto", fontSize: 13, fontWeight: 700, color: actCfg.color }}>{fmt(c.total)} {sar}</div>
                    </div>
                    {terminal?.allow_discount && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <Icon name="discount" size={11} color="var(--text-muted)" />
                        <input type="number" style={{ width: 52, border: "1px solid var(--border)", borderRadius: 6, padding: "2px 4px", fontSize: 11 }}
                          placeholder="0%" min={0} max={terminal?.max_discount_pct || 100}
                          value={line.discount_pct || ""}
                          onChange={(e) => setCart((c) => c.map((l) => l.id === line.id ? { ...l, discount_pct: parseFloat(e.target.value) || 0 } : l))} />
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>%</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Totals + payment */}
          <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", flexShrink: 0, background: "var(--surface)" }}>
            {/* Customer */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", insetInlineStart: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}><Icon name="user" size={13} /></span>
                <input className="form-input" style={{ paddingInlineStart: 26, fontSize: 12, height: 32 }} placeholder={isAr ? "اسم العميل" : "Customer name"} value={custName} onChange={(e) => setCustName(e.target.value)} />
              </div>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{ position: "absolute", insetInlineStart: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}><Icon name="phone" size={13} /></span>
                <input className="form-input" style={{ paddingInlineStart: 26, fontSize: 12, height: 32 }} placeholder={isAr ? "الجوال" : "Phone"} value={custPhone} onChange={(e) => setCustPhone(e.target.value)} />
              </div>
            </div>

            {/* Totals */}
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
              {[
                { label: isAr ? "المجموع" : "Subtotal", val: fmt(totals.sub) },
                { label: isAr ? "ضريبة القيمة المضافة" : "VAT", val: fmt(totals.vat) },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span>{label}</span><span>{val} {sar}</span>
                </div>
              ))}
              {terminal?.allow_discount && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Icon name="discount" size={12} color="var(--text-muted)" />
                  <span style={{ fontSize: 11 }}>{isAr ? "خصم إجمالي %" : "Overall disc %"}</span>
                  <input type="number" style={{ width: 52, border: "1px solid var(--border)", borderRadius: 6, padding: "2px 4px", fontSize: 11, marginInlineStart: "auto" }}
                    min={0} max={terminal?.max_discount_pct || 100} value={overallDisc}
                    onChange={(e) => setOverallDisc(e.target.value)} />
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, marginBottom: 10, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
              <span>{isAr ? "الإجمالي" : "Total"}</span>
              <span style={{ color: actCfg.color }}>{fmt(grandTotal)} {sar}</span>
            </div>

            {/* Payment method */}
            <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
              {(["cash","mada","credit_card","stc_pay","split"] as const).map((m) => (
                <button key={m} onClick={() => setPayMethod(m)}
                  style={{ flex: 1, minWidth: 60, padding: "5px 4px", borderRadius: 8, border: `1.5px solid ${payMethod === m ? actCfg.color : "var(--border)"}`, background: payMethod === m ? actCfg.bg : "white", color: payMethod === m ? actCfg.color : "var(--text-secondary)", fontSize: 10, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                  <Icon name={m === "cash" ? "cash" : "card"} size={12} />
                  {m === "cash" ? (isAr ? "نقدي" : "Cash") : m === "mada" ? "مدى" : m === "credit_card" ? (isAr ? "بطاقة" : "Card") : m === "stc_pay" ? "STC" : (isAr ? "مقسّم" : "Split")}
                </button>
              ))}
            </div>

            {payMethod === "cash" && (
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input type="number" className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder={isAr ? "المبلغ المدفوع" : "Cash tendered"} value={cashTendered} onChange={(e) => setCashTendered(e.target.value)} />
                {change > 0 && <div style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 700, color: "#6F4A84", whiteSpace: "nowrap" }}>{isAr ? "الباقي:" : "Change:"} {fmt(change)} {sar}</div>}
              </div>
            )}
            {payMethod === "split" && (
              <input type="number" className="form-input" style={{ marginBottom: 8, fontSize: 13 }} placeholder={isAr ? "مبلغ البطاقة" : "Card amount"} value={cardAmount} onChange={(e) => setCardAmount(e.target.value)} />
            )}

            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: 15, height: 44 }}
              onClick={completeSale} disabled={completing || !cart.length || !session}>
              <Icon name="check" size={18} />
              {completing ? (isAr ? "جاري الحفظ..." : "Processing...") : (isAr ? "إتمام البيع" : "Complete Sale")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Serial Modal ── */}
      {serialModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div className="card-header">
              <h3 className="card-title"><Icon name="serial" size={16} />{isAr ? "اختر السيريال" : "Select Serial"}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setSerialModal(null)}><Icon name="close" size={18} /></button>
            </div>
            <div style={{ padding: "8px 16px 4px", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{serialModal.product.name_ar}</div>
            <div style={{ overflowY: "auto", flex: 1, padding: "8px 16px 16px" }}>
              {serialModal.serials.map((s: any) => (
                <button key={s.id} onClick={() => { addLine(serialModal.product, { serial_item_id: s.id, serial_number: s.serial_number, unit_price: s.sale_price || serialModal.product.sale_price }); setSerialModal(null); }}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6, background: "white", cursor: "pointer", textAlign: isAr ? "right" : "left" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = actCfg.color; e.currentTarget.style.background = actCfg.bg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "white"; }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.serial_number}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.condition === "new" ? (isAr ? "جديد" : "New") : s.condition === "used" ? (isAr ? "مستخدم" : "Used") : (isAr ? "مجدد" : "Refurbished")}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: actCfg.color, fontSize: 13 }}>{fmt(s.sale_price || serialModal.product.sale_price)} {sar}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Variant Modal ── */}
      {variantModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div className="card-header">
              <h3 className="card-title"><Icon name="variant" size={16} />{isAr ? "اختر المتغير" : "Select Variant"}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setVariantModal(null)}><Icon name="close" size={18} /></button>
            </div>
            <div style={{ padding: "8px 16px 4px", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>{variantModal.product.name_ar}</div>
            <div style={{ overflowY: "auto", flex: 1, padding: "8px 16px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
              {variantModal.variants.map((v: any) => (
                <button key={v.id} onClick={() => { addLine(variantModal.product, { variant_id: v.id, variant_label: [v.size, v.color, v.other_attribute].filter(Boolean).join(" / "), unit_price: v.sale_price || variantModal.product.sale_price }); setVariantModal(null); }}
                  style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 8px", background: "white", cursor: "pointer", textAlign: "center" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = actCfg.color; e.currentTarget.style.background = actCfg.bg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "white"; }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{[v.size, v.color].filter(Boolean).join(" / ") || v.sku}</div>
                  {v.other_attribute && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{v.other_attribute}</div>}
                  <div style={{ fontSize: 12, fontWeight: 700, color: actCfg.color, marginTop: 4 }}>{fmt(v.sale_price || variantModal.product.sale_price)} {sar}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{isAr ? `متاح: ${v.quantity}` : `Avail: ${v.quantity}`}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Weight Modal ── */}
      {weightModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 360 }}>
            <div className="card-header">
              <h3 className="card-title"><Icon name="weight" size={16} />{isAr ? "أدخل الوزن" : "Enter Weight"}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setWeightModal(null)}><Icon name="close" size={18} /></button>
            </div>
            <div className="card-body">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{weightModal.product.name_ar}</div>
              <div className="form-group">
                <label className="form-label">{isAr ? "الوزن (كجم)" : "Weight (kg)"}</label>
                <input type="number" className="form-input" min={0.001} step={0.1} value={weightInput} onChange={(e) => setWeightInput(e.target.value)} autoFocus />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setWeightModal(null)}>{isAr ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={() => { if (!weightInput || parseFloat(weightInput) <= 0) return; addLine(weightModal.product, { quantity: parseFloat(weightInput) }); setWeightModal(null); }}>
                  {isAr ? "إضافة" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── POS Purchase Modal (جوالات / قطع غيار) ── */}
      {showPurchase && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="card-header">
              <h3 className="card-title">
                <Icon name="purchase" size={16} />
                {isAr ? "شراء من نقطة البيع" : "POS Purchase"}
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginInlineStart: 6 }}>
                  {isAr ? "(إضافة سيريال للمخزون)" : "(add serial to stock)"}
                </span>
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => { setShowPurchase(false); setPurchaseProd(null); setPurchaseSearch(""); setPurchaseProds([]); }}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: 20 }}>
              {/* Step 1: search product */}
              {!purchaseProd ? (
                <>
                  <div className="form-group">
                    <label className="form-label">{isAr ? "ابحث عن المنتج" : "Search Product"}</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", insetInlineStart: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}><Icon name="search" size={15} /></span>
                      <input className="form-input" style={{ paddingInlineStart: 32 }} placeholder={isAr ? "اسم المنتج أو الباركود..." : "Product name or barcode..."} value={purchaseSearch} onChange={(e) => setPurchaseSearch(e.target.value)} autoFocus />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {purchaseProds.map((p) => (
                      <button key={p.id} onClick={() => setPurchaseProd(p)}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "white", cursor: "pointer", textAlign: isAr ? "right" : "left" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = actCfg.color; e.currentTarget.style.background = actCfg.bg; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "white"; }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name_ar}</div>
                          {p.barcode && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.barcode}</div>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{isAr ? `${p.quantity_on_hand} سيريال` : `${p.quantity_on_hand} serials`}</span>
                          <Icon name="arrowRight" size={14} color={actCfg.color} />
                        </div>
                      </button>
                    ))}
                    {purchaseSearch && purchaseProds.length === 0 && (
                      <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 13 }}>
                        {isAr ? "لا توجد نتائج" : "No results"}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Step 2: enter serial details */
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: actCfg.bg, borderRadius: 10, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "white", display: "flex", alignItems: "center", justifyContent: "center", color: actCfg.color }}>
                      <Icon name={actCfg.icon} size={18} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{purchaseProd.name_ar}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{purchaseProd.barcode}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPurchaseProd(null)}>
                      <Icon name="edit" size={13} />
                    </button>
                  </div>

                  <div className="grid-2">
                    <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                      <label className="form-label">{isAr ? "رقم السيريال" : "Serial Number"} <span className="required">*</span></label>
                      <input className="form-input" value={purchaseForm.serial_number} onChange={(e) => setPurchaseForm((f) => ({ ...f, serial_number: e.target.value }))} placeholder="IMEI / S/N" autoFocus />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{isAr ? "الحالة" : "Condition"}</label>
                      <select className="form-input form-select" value={purchaseForm.condition} onChange={(e) => setPurchaseForm((f) => ({ ...f, condition: e.target.value }))}>
                        <option value="new">{isAr ? "جديد" : "New"}</option>
                        <option value="used">{isAr ? "مستخدم" : "Used"}</option>
                        <option value="refurbished">{isAr ? "مجدد" : "Refurbished"}</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{isAr ? "سعر الشراء" : "Cost Price"} <span className="required">*</span></label>
                      <input type="number" className="form-input" min={0} step={0.01} value={purchaseForm.cost_price} onChange={(e) => setPurchaseForm((f) => ({ ...f, cost_price: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{isAr ? "سعر البيع" : "Sale Price"}</label>
                      <input type="number" className="form-input" min={0} step={0.01} value={purchaseForm.sale_price} onChange={(e) => setPurchaseForm((f) => ({ ...f, sale_price: e.target.value }))} placeholder={isAr ? "اختياري" : "Optional"} />
                    </div>
                    <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                      <label className="form-label">{isAr ? "ملاحظات" : "Notes"}</label>
                      <input className="form-input" value={purchaseForm.notes} onChange={(e) => setPurchaseForm((f) => ({ ...f, notes: e.target.value }))} placeholder={isAr ? "اختياري" : "Optional"} />
                    </div>
                  </div>
                </>
              )}
            </div>
            {purchaseProd && (
              <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setPurchaseProd(null)}>{isAr ? "رجوع" : "Back"}</button>
                <button className="btn btn-primary" onClick={handlePurchase} disabled={savingPurchase}>
                  <Icon name="check" size={15} />
                  {savingPurchase ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "إضافة للمخزون" : "Add to Stock")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Close Session Modal ── */}
      {showCloseForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 400 }}>
            <div className="card-header">
              <h3 className="card-title"><Icon name="lock" size={16} />{isAr ? "إغلاق الجلسة" : "Close Session"}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCloseForm(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16, fontSize: 13 }}>
                {[
                  { label: isAr ? "إجمالي المبيعات" : "Total Sales", val: `${fmt(Number(session?.total_sales))} ${sar}`, color: "var(--success)" },
                  { label: isAr ? "عدد المعاملات" : "Transactions",  val: String(session?.transaction_count), color: "var(--primary)" },
                  { label: isAr ? "نقدي" : "Cash",                   val: `${fmt(Number(session?.total_cash))} ${sar}`, color: "var(--text-primary)" },
                  { label: isAr ? "بطاقة" : "Card",                  val: `${fmt(Number(session?.total_card))} ${sar}`, color: "var(--text-primary)" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: "var(--bg)", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 700, color }}>{val}</div>
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">{isAr ? "النقد الفعلي في الصندوق" : "Actual Cash in Drawer"}</label>
                <input type="number" className="form-input" min={0} step={0.01} value={closingCash} onChange={(e) => setClosingCash(e.target.value)} autoFocus />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setShowCloseForm(false)}>{isAr ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-danger" onClick={handleCloseSession} disabled={closingSession}>
                  <Icon name="lock" size={15} />
                  {closingSession ? (isAr ? "جاري الإغلاق..." : "Closing...") : (isAr ? "إغلاق الجلسة" : "Close Session")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Modal ── */}
      {receiptModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 420, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F4EFF7", display: "flex", alignItems: "center", justifyContent: "center", color: "#6F4A84" }}>
                  <Icon name="check" size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{isAr ? "تمت العملية بنجاح" : "Sale Completed"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{receiptModal.transaction_number}</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setReceiptModal(null)}>
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Thermal Receipt Preview */}
            <div style={{ overflowY: "auto", flex: 1, padding: 16, background: "#F8FAFC", display: "flex", justifyContent: "center" }}>
              <div style={{ background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.1)", borderRadius: 4 }}>
                <ThermalReceipt
                  transaction_number={receiptModal.transaction_number}
                  uuid={receiptModal.uuid}
                  created_at={receiptModal.created_at || new Date().toISOString()}
                  company={company || { name: "الشركة" }}
                  receipt_header={terminal?.receipt_header}
                  receipt_footer={terminal?.receipt_footer}
                  lines={receiptModal.cart?.map((l: CartLine) => {
                    const c = calcLine(l);
                    return {
                      product_name_ar: l.product_name_ar,
                      quantity: l.quantity,
                      unit_price: l.unit_price,
                      discount_pct: l.discount_pct,
                      vat_rate: l.vat_rate,
                      vat_amount: c.vat,
                      total: c.total,
                      serial_number: l.serial_number,
                      variant_label: l.variant_label,
                      batch_label: l.batch_label,
                    };
                  }) || []}
                  subtotal={receiptModal.cart?.reduce((s: number, l: CartLine) => s + l.quantity * l.unit_price, 0) || 0}
                  discount_amount={receiptModal.cart?.reduce((s: number, l: CartLine) => s + (l.quantity * l.unit_price * l.discount_pct / 100), 0) || 0}
                  vat_amount={receiptModal.vat_amount || 0}
                  total={receiptModal.grandTotal}
                  payment_method={receiptModal.payMethod}
                  cash_tendered={receiptModal.payMethod === "cash" ? parseFloat(receiptModal.cashTendered || String(receiptModal.grandTotal)) : undefined}
                  change_amount={receiptModal.change}
                  card_amount={receiptModal.payMethod === "split" ? parseFloat(receiptModal.cardAmount || "0") : undefined}
                  customer_name={receiptModal.customer_name}
                  customer_phone={receiptModal.customer_phone}
                  qr_code={receiptModal.qr_code}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => {
                  // طباعة الفاتورة الحرارية
                  const printArea = document.getElementById("thermal-print-area");
                  if (printArea) {
                    printArea.style.display = "block";
                    document.body.classList.add("thermal-print-mode");
                    setTimeout(() => {
                      window.print();
                      setTimeout(() => {
                        printArea.style.display = "none";
                        document.body.classList.remove("thermal-print-mode");
                      }, 1000);
                    }, 100);
                  }
                }}
              >
                <Icon name="print" size={15} />
                {isAr ? "طباعة" : "Print"}
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => { setReceiptModal(null); searchRef.current?.focus(); }}
              >
                <Icon name="plus" size={15} />
                {isAr ? "عملية جديدة" : "New Sale"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── منطقة الطباعة الحرارية (مخفية في الشاشة) ── */}
      {receiptModal && (
        <div id="thermal-print-area" className="thermal-print-area">
          <ThermalReceipt
            transaction_number={receiptModal.transaction_number}
            uuid={receiptModal.uuid}
            created_at={receiptModal.created_at || new Date().toISOString()}
            company={company || { name: "الشركة" }}
            receipt_header={terminal?.receipt_header}
            receipt_footer={terminal?.receipt_footer}
            lines={receiptModal.cart?.map((l: CartLine) => {
              const c = calcLine(l);
              return {
                product_name_ar: l.product_name_ar,
                quantity: l.quantity,
                unit_price: l.unit_price,
                discount_pct: l.discount_pct,
                vat_rate: l.vat_rate,
                vat_amount: c.vat,
                total: c.total,
                serial_number: l.serial_number,
                variant_label: l.variant_label,
                batch_label: l.batch_label,
              };
            }) || []}
            subtotal={receiptModal.cart?.reduce((s: number, l: CartLine) => s + l.quantity * l.unit_price, 0) || 0}
            discount_amount={receiptModal.cart?.reduce((s: number, l: CartLine) => s + (l.quantity * l.unit_price * l.discount_pct / 100), 0) || 0}
            vat_amount={receiptModal.vat_amount || 0}
            total={receiptModal.grandTotal}
            payment_method={receiptModal.payMethod}
            cash_tendered={receiptModal.payMethod === "cash" ? parseFloat(receiptModal.cashTendered || String(receiptModal.grandTotal)) : undefined}
            change_amount={receiptModal.change}
            card_amount={receiptModal.payMethod === "split" ? parseFloat(receiptModal.cardAmount || "0") : undefined}
            customer_name={receiptModal.customer_name}
            customer_phone={receiptModal.customer_phone}
            qr_code={receiptModal.qr_code}
          />
        </div>
      )}
    </div>
  );
}
