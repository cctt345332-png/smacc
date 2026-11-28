
"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSessions, openSession, getTerminals, getMyTerminal, getTerminalSerials, createTransaction, closeSession, posPurchase, getMyTransactions, getTransaction, createCashOutflow, createPOSReceipt } from "@/lib/pos";
import { getItemsForPicker, getAvailableSerials, searchSerial, getBatches, getVariants } from "@/lib/inventory";
import { getCompany } from "@/lib/settings";
import { getCustomers, createCustomer } from "@/lib/sales";
import { Icon } from "@/components/ui/Icons";
import ThermalReceipt from "@/components/pos/ThermalReceipt";
import { useAuthStore } from "@/store/authStore";

// ─── Activity config ──────────────────────────────────────────────────
const ACTIVITY_CFG: Record<string, { label: string; icon: any; color: string; bg: string; tracking: string; allowPurchase: boolean }> = {
  mobile_phones: { label: "جوالات وإلكترونيات", icon: "mobile",       color: "#3E0865", bg: "#F4EFF7", tracking: "serial",   allowPurchase: true  },
  spare_parts:   { label: "قطع غيار",            icon: "spareParts",   color: "#6F4A84", bg: "#F4EFF7", tracking: "serial",   allowPurchase: true  },
  pharmacy:      { label: "صيدلية",              icon: "pharmacy",     color: "#6F4A84", bg: "#F4EFF7", tracking: "batch",    allowPurchase: false },
  grocery:       { label: "بقالة",               icon: "grocery",      color: "#9A6B13", bg: "#FFF8E5", tracking: "quantity", allowPurchase: false },
  spices:        { label: "عطارة وتوابل",         icon: "spices",       color: "#8B651D", bg: "#FCF5E2", tracking: "weight",   allowPurchase: false },
  clothing:      { label: "ملابس وأزياء",         icon: "clothing",     color: "#6F4A84", bg: "#F4EFF7", tracking: "variant",  allowPurchase: false },
  construction:  { label: "مواد بناء",            icon: "construction", color: "#6F4A84", bg: "#EFE8F3", tracking: "quantity", allowPurchase: false },
  general:       { label: "عام",                 icon: "general",      color: "#3E0865", bg: "#F4EFF7", tracking: "quantity", allowPurchase: false },
};

interface CartLine {
  id: string; inventory_item_id: string; product_name_ar: string;
  barcode?: string; tracking_type: string; quantity: number;
  wholesale_price: number; unit_price: number; discount_pct: number; vat_rate: number; prices_include_vat: boolean;
  serial_item_id?: string; serial_number?: string;
  variant_id?: string; variant_label?: string;
  batch_id?: string; batch_label?: string;
}
interface Product {
  id: string; name_ar: string; sku?: string; barcode?: string;
  tracking_type: string; sale_price: number; pos_sale_price?: number | null; vat_rate: number; quantity_on_hand: number;
}

const posPrice = (p: Product | any) => Number(p?.pos_sale_price ?? p?.sale_price ?? 0);

const calcLine = (l: CartLine) => {
  const gross = l.quantity * l.unit_price;
  const disc  = (gross * l.discount_pct) / 100;
  const beforeVat = gross - disc;
  const vat = l.vat_rate > 0 ? (l.prices_include_vat ? beforeVat * l.vat_rate / (100 + l.vat_rate) : beforeVat * l.vat_rate / 100) : 0;
  const taxable = l.prices_include_vat ? beforeVat - vat : beforeVat;
  const total = l.prices_include_vat ? beforeVat : beforeVat + vat;
  return { gross, disc, taxable, vat, total };
};
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAYMENT_LABELS: Record<string, string> = { cash: "نقدي", mada: "شبكة", tabby: "تابي", tamara: "تمارا", bank_transfer: "تحويل بنكي", split: "مقسّم" };
const POS_SHORTCUTS = [
  { key: "F2", label: "تركيز البحث عن صنف أو مسح الباركود" },
  { key: "F4", label: "اختيار الدفع نقدي" },
  { key: "F5", label: "اختيار الدفع شبكة" },
  { key: "F6", label: "اختيار الدفع مقسّم" },
  { key: "Alt + T", label: "اختيار الدفع تابي" },
  { key: "Alt + M", label: "اختيار الدفع تمارا" },
  { key: "Alt + B", label: "اختيار الدفع تحويل بنكي" },
  { key: "F8", label: "إتمام البيع" },
  { key: "Esc", label: "إغلاق النافذة أو إلغاء البحث" },
  { key: "Ctrl + Backspace", label: "مسح السلة بالكامل" },
];

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
  const [allProducts,  setAllProducts]  = useState<Product[]>([]);
  const [searching,    setSearching]    = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [cart,         setCart]         = useState<CartLine[]>([]);
  const [payMethod,    setPayMethod]    = useState<"cash"|"mada"|"tabby"|"tamara"|"bank_transfer"|"split">("cash");
  const [cashTendered, setCashTendered] = useState("");
  const [cardAmount,   setCardAmount]   = useState("");
  const [custName,     setCustName]     = useState("");
  const [custPhone,    setCustPhone]    = useState("");
  const [customerId,   setCustomerId]   = useState<string | undefined>();
  const [customers,    setCustomers]    = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState<any>({
    customer_type: "company", name_ar: "", name_en: "", vat_number: "", cr_number: "",
    national_id: "", owner_name: "", owner_national_id: "", license_number: "", activity_type: "",
    address_building: "", address_street: "", address_district: "", address_city: "",
    address_postal: "", address_additional: "", address_country: "SA", phone: "", phone2: "",
    email: "", website: "", payment_terms_days: "30", credit_limit: "0", ar_account_id: "", notes: "",
  });
  const [overallDisc,  setOverallDisc]  = useState("0");
  const [completing,   setCompleting]   = useState(false);
  const [receiptModal, setReceiptModal] = useState<any>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // open session form
  const [showOpenForm,   setShowOpenForm]   = useState(false);
  const [openForm,       setOpenForm]       = useState({ terminal_id: "", opening_cash: "0" });
  const [openingSession, setOpeningSession] = useState(false);
  const [openError,      setOpenError]      = useState("");

  // close session
  const [showCloseForm,  setShowCloseForm]  = useState(false);
  const [closingCash,    setClosingCash]    = useState("");
  const [closePin,       setClosePin]       = useState("");
  const [closingSession, setClosingSession] = useState(false);
  const [showCashOutflow, setShowCashOutflow] = useState(false);
  const [cashOutflowForm, setCashOutflowForm] = useState({ outflow_type: "donation", amount: "", description: "" });
  const [savingCashOutflow, setSavingCashOutflow] = useState(false);
  const [showPOSReceipt, setShowPOSReceipt] = useState(false);
  const [posReceiptForm, setPosReceiptForm] = useState({ customer_id: "", amount: "", payment_method: "cash", invoice_id: "", description: "" });
  const [savingPOSReceipt, setSavingPOSReceipt] = useState(false);

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

  const loadPosCustomers = async (search?: string) => {
    if (!terminal?.customer_account_parent_id) { setCustomers([]); return; }
    try { const r = await getCustomers(search || undefined, terminal?.customer_account_parent_id); setCustomers(r.data || []); } catch { setCustomers([]); }
  };
  const selectCustomer = (customer: any) => {
    setCustomerId(customer.id); setCustName(customer.name_ar || ""); setCustPhone(customer.phone || "");
    setCustomerSearch("");
  };
  const savePosCustomer = async () => {
    if (!customerForm.name_ar) { alert(isAr ? "اسم العميل مطلوب" : "Customer name is required"); return; }
    if (!terminal?.customer_account_parent_id) { alert(isAr ? "لم يتم تحديد حساب العملاء الرئيسي لهذا الجهاز. اطلب من المدير ضبطه من إعدادات أجهزة POS." : "This terminal has no customer account configured. Ask a manager to set it in POS terminal settings."); return; }
    setSavingCustomer(true);
    try {
      const payload = { ...customerForm, customer_type: "company", payment_terms_days: 30,
        credit_limit: parseFloat(customerForm.credit_limit) || 0, opening_balance: 0,
        ar_account_id: terminal.customer_account_parent_id,
        ...Object.fromEntries(["name_en","vat_number","cr_number","national_id","owner_name","owner_national_id","license_number","activity_type","address_building","address_street","address_district","address_city","address_postal","address_additional","phone","phone2","email","website","notes"].map(k => [k, customerForm[k] || null])) };
      const r = await createCustomer(payload);
      selectCustomer(r.data); setCustomers((items) => [r.data, ...items]); setShowCustomerForm(false);
    } catch (e: any) { alert(e?.response?.data?.detail || (isAr ? "تعذر حفظ العميل" : "Could not save customer")); }
    finally { setSavingCustomer(false); }
  };

  // طباعة الإيصال فقط، وليس صفحة الكاشير كاملة.
  const printThermalReceipt = useCallback(() => {
    const printArea = document.getElementById("thermal-print-area");
    if (!printArea) return;

    printArea.style.display = "block";
    document.body.classList.add("thermal-print-mode");

    const cleanup = () => {
      printArea.style.display = "none";
      document.body.classList.remove("thermal-print-mode");
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(() => window.print(), 100);
  }, []);

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

        // لا نأخذ أول جلسة مفتوحة من جميع الأجهزة؛ ذلك كان يسبب عرض
        // مستودع وحسابات جهاز آخر عند وجود أكثر من جهاز POS.
        let assignedTerminalId = terminalParam || "";
        if (!assignedTerminalId && isCashierRole) {
          try {
            const myRes = await getMyTerminal();
            assignedTerminalId = myRes?.data?.id || "";
          } catch {}
        }

        const openSessions = allS.filter((s: any) => s.status === "open");
        const selectedOpenSession = assignedTerminalId
          ? openSessions.find((s: any) => s.terminal_id === assignedTerminalId)
          : openSessions.length === 1 ? openSessions[0] : null;
        const selectedTerminalId = assignedTerminalId || selectedOpenSession?.terminal_id || "";
        const selectedTerminal = allT.find((x: any) => x.id === selectedTerminalId) || null;

        if (selectedOpenSession && selectedTerminal) {
          setSession(selectedOpenSession);
          setTerminal(selectedTerminal);
          setActCfg(ACTIVITY_CFG[selectedTerminal.business_type || "general"] || ACTIVITY_CFG.general);
        } else {
          if (selectedTerminal) {
            setTerminal(selectedTerminal);
            setActCfg(ACTIVITY_CFG[selectedTerminal.business_type || "general"] || ACTIVITY_CFG.general);
          }
          setOpenForm((f) => ({ ...f, terminal_id: selectedTerminalId }));
          setShowOpenForm(true);
        }
      } finally { setLoading(false); }
    })();
  }, []);

  // شاشة POS تبدأ بقائمة الأصناف المتاحة، ولا تنتظر كتابة بحث.
  useEffect(() => {
    if (!terminal?.id) return;
    let cancelled = false;
    setSearching(true);
    getItemsForPicker({ warehouse_id: terminal.warehouse_id || undefined })
      .then((r) => {
        if (cancelled) return;
        const items = (r.data || []).filter((p: any) => p.pos_enabled !== false);
        setAllProducts(items);
        if (!search.trim()) setProducts(items);
      })
      .catch(() => {
        if (!cancelled) {
          setAllProducts([]);
          setProducts([]);
        }
      })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [terminal?.id, terminal?.warehouse_id]);

  // ── search products ────────────────────────────────────────────────
  const doSearch = useCallback(async (q: string) => {
    const value = q.trim();
    if (!value) { setProducts(allProducts); return; }
    setSearching(true);
    try {
      // قارئ السيريال يرسل الرقم مباشرة؛ افحص السيريال أولاً قبل بحث اسم/باركود الصنف.
      if (value.length >= 3) {
        const serialResult = await searchSerial(value).catch(() => ({ data: [] }));
        const serialHit = (serialResult.data || []).find((s: any) =>
          String(s.serial_number || "").trim().toLowerCase() === value.toLowerCase() && s.status === "in_stock"
        );
        if (serialHit) {
          let product = allProducts.find((p) => p.id === serialHit.product_id);
          if (!product) {
            const productResult = await getItemsForPicker({
              search: serialHit.product_name,
              warehouse_id: terminal?.warehouse_id || undefined,
            });
            product = (productResult.data || []).find((p: Product) => p.id === serialHit.product_id);
          }
          if (product && product.tracking_type === "serial") {
            const availableResult = terminal?.id
              ? await getTerminalSerials(terminal.id, product.id, true).catch(() => ({ data: [] }))
              : await getAvailableSerials(product.id).catch(() => ({ data: [] }));
            const selectedSerial = (availableResult.data || []).find((s: any) =>
              String(s.id) === String(serialHit.serial_id) ||
              String(s.serial_number || "").trim().toLowerCase() === value.toLowerCase()
            );
            if (!selectedSerial) {
              throw new Error(isAr ? "السيريال غير متاح في مستودع نقطة البيع" : "Serial is not available at this POS warehouse");
            }
            addLine(product, {
              serial_item_id: selectedSerial.id,
              serial_number: selectedSerial.serial_number,
              wholesale_price: selectedSerial.sale_price || posPrice(product),
              unit_price: selectedSerial.sale_price || posPrice(product),
            });
            setSearch("");
            setProducts(allProducts);
            return;
          }
        }
      }

      const r = await getItemsForPicker({
        search: value,
        warehouse_id: terminal?.warehouse_id || undefined,
      });
      const items = (r.data || []).filter((p: any) => p.pos_enabled !== false);
      setProducts(items);
      // باركود مطابق تماماً → أضف مباشرة بدون انتظار
      const exact = items.find((p: any) =>
        p.barcode && p.barcode.trim() === value
      );
      if (exact && items.length === 1) {
        await addToCart(exact);
        setSearch("");
        setProducts(allProducts);
      }
    } catch (e: any) {
      if (e?.message) alert(e.message);
      setProducts([]);
    }
    finally { setSearching(false); }
  }, [allProducts, terminal?.id, terminal?.warehouse_id, isAr]);

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
      const r = terminal?.id
        ? await getTerminalSerials(terminal.id, p.id, true).catch(() => ({ data: [] }))
        : await getAvailableSerials(p.id).catch(() => ({ data: [] }));
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
    if (extra.serial_item_id && cart.find((l) => l.serial_item_id === extra.serial_item_id)) {
      alert(isAr ? "السيريال موجود بالفعل في السلة" : "Serial already in cart"); return;
    }
    if (!extra.serial_item_id && !extra.variant_id) {
      const idx = cart.findIndex((l) => l.inventory_item_id === p.id && !l.serial_item_id && !l.variant_id);
      if (idx >= 0) { setCart((c) => c.map((l, i) => i === idx ? { ...l, quantity: l.quantity + 1 } : l)); setSearch(""); setProducts(allProducts); return; }
    }
    setCart((c) => [...c, {
      id: Math.random().toString(36).slice(2),
      inventory_item_id: p.id, product_name_ar: p.name_ar,
      barcode: p.barcode, tracking_type: p.tracking_type,
      wholesale_price: posPrice(p),
      quantity: 1, unit_price: posPrice(p),
      discount_pct: 0, vat_rate: p.vat_rate, prices_include_vat: true, ...extra,
    }]);
    setSearch(""); setProducts(allProducts);
    searchRef.current?.focus();
  };

  // ── totals ─────────────────────────────────────────────────────────
  const totals = cart.reduce((a, l) => {
    const c = calcLine(l);
    return { sub: a.sub + c.gross, disc: a.disc + c.disc, vat: a.vat + c.vat, total: a.total + c.total };
  }, { sub: 0, disc: 0, vat: 0, total: 0 });
  const overallDiscAmt = (totals.sub * parseFloat(overallDisc || "0")) / 100;
  const grandTotal     = Math.max(0, totals.total - overallDiscAmt);
  const enteredPayment = payMethod === "cash" ? parseFloat(cashTendered || "0") : payMethod === "split" ? parseFloat(cashTendered || "0") + parseFloat(cardAmount || "0") : parseFloat(cardAmount || "0");
  const paymentRemaining = Math.max(0, grandTotal - enteredPayment);
  const change         = payMethod === "cash" ? Math.max(0, parseFloat(cashTendered || "0") - grandTotal) : 0;

  // ── complete sale ──────────────────────────────────────────────────
  const completeSale = async () => {
    if (!session)     { alert(isAr ? "لا توجد جلسة مفتوحة" : "No open session"); return; }
    if (!cart.length) { alert(isAr ? "السلة فارغة" : "Cart is empty"); return; }
    const enteredCash = parseFloat(cashTendered || "0");
    const enteredCard = parseFloat(cardAmount || "0");
    const enteredPaid = payMethod === "cash" ? enteredCash : payMethod === "split" ? enteredCash + enteredCard : enteredCard;
    if (enteredPaid <= 0 || enteredPaid > grandTotal + 0.01) {
      alert(isAr ? "أدخل مبلغ تحصيل صحيح" : "Enter a valid payment amount"); return;
    }
    if (enteredPaid < grandTotal - 0.01 && !customerId) {
      alert(isAr ? "اختر عميلاً أولاً لتسجيل دفعة جزئية" : "Select a customer before recording a partial payment"); return;
    }
    if (payMethod === "split") {
      if (enteredCash < 0 || enteredCard < 0) {
        alert(isAr ? "أدخل مبالغ صحيحة" : "Enter valid amounts"); return;
      }
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
          prices_include_vat: l.prices_include_vat,
          serial_item_id: l.serial_item_id,
          variant_id: l.variant_id,
          batch_id: l.batch_id,
        })),
        payment_method: payMethod,
        customer_id: customerId,
        cash_tendered: payMethod === "cash" ? parseFloat(cashTendered || String(grandTotal)) : payMethod === "split" ? parseFloat(cashTendered || "0") : 0,
        card_amount: (["mada", "tabby", "tamara", "bank_transfer"] as string[]).includes(payMethod) ? enteredCard : payMethod === "split" ? parseFloat(cardAmount || "0") : undefined,
        customer_name: custName || undefined,
        customer_phone: custPhone || undefined,
        discount_amount: overallDiscAmt,
      });
      // نعتمد على المبلغ الذي ثبّته الخادم، لا على قيمة الحقل في الواجهة.
      // هذا يمنع عرض الدفعة الجزئية كأنها كاملة عند اختلاف التقريب أو طريقة الدفع.
      const serverPaid = Number(res.data?.paid_amount ?? enteredPaid);
      const serverRemaining = Number(res.data?.remaining_amount ?? Math.max(0, grandTotal - serverPaid));
      setReceiptModal({ ...res.data, cart: [...cart], grandTotal, change, payMethod, cashTendered, cardAmount, paidNow: serverPaid, remaining: serverRemaining });
      setCart([]); setCashTendered(""); setCardAmount(""); setCustName(""); setCustPhone(""); setCustomerId(undefined); setCustomerSearch(""); setOverallDisc("0"); setPayMethod("cash");
      // طباعة تلقائية إذا كان الجهاز مضبوطاً على الطباعة — الإيصال فقط.
      if (terminal?.print_receipt) {
        setTimeout(() => printThermalReceipt(), 800);
      }
      const sr = await getSessions({ limit: 20 });
      const up = (sr.data || []).find((s: any) => s.id === session.id);
      if (up) setSession(up);
      // تحديث قائمة الأصناف بعد الخصم بدون إعادة تحميل الصفحة.
      const inventoryResult = await getItemsForPicker({ warehouse_id: terminal?.warehouse_id || undefined });
      const refreshedProducts = (inventoryResult.data || []).filter((p: any) => p.pos_enabled !== false);
      setAllProducts(refreshedProducts);
      setProducts(refreshedProducts);
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

  // اختصارات شاشة POS — تُحفظ محليًا حتى تبقى متاحة على نفس الجهاز.
  useEffect(() => {
    try { localStorage.setItem("masar_pos_shortcuts", JSON.stringify(POS_SHORTCUTS)); } catch {}
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F2") { event.preventDefault(); searchRef.current?.focus(); return; }
      if (event.key === "F4") { event.preventDefault(); setPayMethod("cash"); return; }
      if (event.key === "F5") { event.preventDefault(); setPayMethod("mada"); return; }
      if (event.key === "F6") { event.preventDefault(); setPayMethod("split"); return; }
      if (event.altKey && event.key.toLowerCase() === "b") { event.preventDefault(); setPayMethod("bank_transfer"); return; }
      if (event.key === "F8") { event.preventDefault(); void completeSale(); return; }
      if (event.key === "Escape") { setShowShortcuts(false); return; }
      if (event.ctrlKey && event.key === "Backspace") { event.preventDefault(); setCart([]); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // ── close session ──────────────────────────────────────────────────
  const handleCloseSession = async () => {
    if (!session) return;
    if (!/^\d{4}$/.test(closePin)) {
      alert(isAr ? "أدخل كلمة مرور الإغلاق المكونة من 4 أرقام" : "Enter the 4-digit close PIN");
      return;
    }
    setClosingSession(true);
    try {
      await closeSession(session.id, { closing_cash: parseFloat(closingCash || "0"), close_pin: closePin });
      if (isCashierRole) {
        // الكاشير — أعد تعيين الجلسة وافتح نموذج جلسة جديدة
        setSession(null);
        setShowCloseForm(false);
        setClosePin("");
        setCart([]);
        setShowOpenForm(true);
      } else {
        // المدير — وجّه لتقرير الجلسة
        router.push(`/${locale}/pos/sessions/${session.id}`);
      }
    } catch (e: any) { alert(e?.response?.data?.detail || (isAr ? "حدث خطأ" : "Error")); }
    finally { setClosingSession(false); }
  };
  const handleCashOutflow = async () => {
    if (!session) return;
    const amount = parseFloat(cashOutflowForm.amount);
    if (!amount || amount <= 0) { alert(isAr ? "أدخل مبلغًا صحيحًا" : "Enter a valid amount"); return; }
    setSavingCashOutflow(true);
    try {
      await createCashOutflow(session.id, cashOutflowForm);
      const total = Number(session.total_cash_outflows || 0) + amount;
      setSession({ ...session, total_cash_outflows: total });
      setCashOutflowForm({ outflow_type: "donation", amount: "", description: "" });
      setShowCashOutflow(false);
    } catch (e: any) { alert(e?.response?.data?.detail || (isAr ? "تعذر تسجيل المخرج النقدي" : "Could not save cash outflow")); }
    finally { setSavingCashOutflow(false); }
  };
  const handlePOSReceipt = async () => {
    if (!session) return;
    const amount = parseFloat(posReceiptForm.amount);
    if (!posReceiptForm.customer_id || !amount || amount <= 0) { alert(isAr ? "اختر العميل وأدخل مبلغًا صحيحًا" : "Select a customer and enter a valid amount"); return; }
    setSavingPOSReceipt(true);
    try {
      const { data } = await createPOSReceipt(session.id, { ...posReceiptForm, amount });
      alert(`${isAr ? "تم إنشاء سند القبض" : "Receipt created"}: ${data?.receipt_number || data?.payment_number || data?.id || "OK"}`);
      setPosReceiptForm({ customer_id: "", amount: "", payment_method: "cash", invoice_id: "", description: "" });
      setShowPOSReceipt(false);
      if (posReceiptForm.payment_method === "cash") setSession({ ...session, total_cash: Number(session.total_cash || 0) + amount });
    } catch (e: any) { alert(e?.response?.data?.detail || (isAr ? "تعذر تسجيل سند القبض" : "Could not save receipt")); }
    finally { setSavingPOSReceipt(false); }
  };

  const openPreviousInvoices = async () => {
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const { data } = await getMyTransactions(100);
      setHistory(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setHistory([]);
      alert(e?.response?.data?.detail || (isAr ? "تعذر تحميل الفواتير السابقة" : "Could not load previous invoices"));
    } finally { setHistoryLoading(false); }
  };

  const showPreviousInvoice = async (txId: string) => {
    try {
      const { data: tx } = await getTransaction(txId);
      setShowHistory(false);
      setReceiptModal({
        ...tx,
        grandTotal: tx.total,
        payMethod: tx.payment_method,
        cashTendered: String(tx.cash_tendered ?? ""),
        cardAmount: String(tx.card_amount ?? ""),
        change: tx.change_amount,
        cart: (tx.lines || []).map((line: any) => ({
          ...line,
          id: line.inventory_item_id || line.product_name_ar,
          inventory_item_id: line.inventory_item_id || "",
          wholesale_price: Number(line.wholesale_price ?? line.unit_price ?? 0),
          discount_pct: Number(line.discount_pct || 0),
        })),
      });
    } catch (e: any) {
      alert(e?.response?.data?.detail || (isAr ? "تعذر تحميل الفاتورة" : "Could not load invoice"));
    }
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
        <button className="btn btn-ghost btn-sm btn-icon" title={isAr ? "اختصارات POS" : "POS shortcuts"}
          onClick={() => setShowShortcuts(true)} style={{ marginInlineStart: "auto", color: actCfg.color, border: `1px solid ${actCfg.color}40`, borderRadius: 8 }}>
          <Icon name="info" size={17} />
        </button>
        <button className="btn btn-secondary btn-sm" onClick={openPreviousInvoices} title={isAr ? "فواتير هذا المستخدم السابقة فقط" : "This user's previous invoices only"}>
          <Icon name="invoice" size={14} />
          {isAr ? "الفواتير السابقة" : "Previous invoices"}
        </button>
        {terminal && (
          <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/${locale}/pos/maintenance?terminal_id=${encodeURIComponent(terminal.id)}&session_id=${encodeURIComponent(session?.id || "")}`)} title={isAr ? "فتح صيانة هذا الجهاز" : "Open maintenance for this terminal"}>
            <Icon name="settings" size={14} />
            {isAr ? "الصيانة" : "Maintenance"}
          </button>
        )}
        {session && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCashOutflow(true)}>
              <Icon name="cash" size={14} />
              {isAr ? "مخرج نقدي" : "Cash outflow"}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setShowPOSReceipt(true); void loadPosCustomers(); }}>
              <Icon name="receipt" size={14} />
              {isAr ? "سند قبض" : "Receipt"}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setClosingCash(String((Number(session.opening_cash || 0) + Number(session.total_cash || 0) - Number(session.total_cash_outflows || 0)).toFixed(2))); setShowCloseForm(true); }}>
              <Icon name="lock" size={14} />
              {isAr ? "إغلاق الجلسة" : "Close Session"}
            </button>
          </div>
        )}
      </div>

      {showHistory && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 480, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 70 }}>
          <div className="card" style={{ width: "100%", maxWidth: 760, maxHeight: "78vh", display: "flex", flexDirection: "column", boxShadow: "0 16px 45px rgba(0,0,0,.2)" }}>
            <div className="card-header">
              <h3 className="card-title"><Icon name="invoice" size={16} />{isAr ? "فواتير هذا المستخدم السابقة" : "This user's previous invoices"}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowHistory(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="card-body" style={{ padding: 12, overflowY: "auto" }}>
              {historyLoading ? (
                <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>{isAr ? "جاري التحميل..." : "Loading..."}</div>
              ) : history.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>{isAr ? "لا توجد فواتير سابقة لهذا المستخدم" : "No previous invoices for this user"}</div>
              ) : history.map((invoice) => (
                <div key={invoice.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{invoice.transaction_number}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(invoice.created_at).toLocaleString(isAr ? "ar-SA" : "en-US")} — {invoice.customer_name || (isAr ? "عميل نقدي" : "Cash customer")}</div>
                  </div>
                  <div style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(Number(invoice.total))} {sar}</div>
                  <button className="btn btn-primary btn-sm" onClick={() => showPreviousInvoice(invoice.id)}>
                    <Icon name="print" size={14} />{isAr ? "عرض وطباعة" : "View & print"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 500, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", padding: 70 }}>
          <div className="card" style={{ width: "100%", maxWidth: 380, boxShadow: "0 16px 45px rgba(0,0,0,.2)" }}>
            <div className="card-header">
              <h3 className="card-title"><Icon name="info" size={16} />{isAr ? "اختصارات نقطة البيع" : "POS Shortcuts"}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowShortcuts(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="card-body" style={{ padding: 12 }}>
              {POS_SHORTCUTS.map((shortcut) => (
                <div key={shortcut.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 4px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13 }}>{isAr ? shortcut.label : shortcut.key}</span>
                  <kbd style={{ border: "1px solid var(--border)", borderRadius: 5, padding: "3px 7px", background: "var(--bg)", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{isAr ? shortcut.key : shortcut.label}</kbd>
                </div>
              ))}
              <div style={{ marginTop: 12, color: "var(--text-muted)", fontSize: 11 }}>{isAr ? "تم حفظ قائمة الاختصارات على هذا الجهاز تلقائيًا." : "Shortcut settings are saved on this device automatically."}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Body: products + cart ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Products: مساحة مستقلة بجانب السلة ── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", borderInlineEnd: "1px solid var(--border)", overflow: "hidden" }}>
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
            {!searching && !search && products.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: actCfg.color, opacity: 0.4 }}>
                  <Icon name={actCfg.icon} size={48} />
                </div>
                <div style={{ fontSize: 13 }}>{isAr ? "لا توجد أصناف متاحة في مستودع نقطة البيع" : "No products available at this POS warehouse"}</div>
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: actCfg.color }}>{isAr ? "سعر الجملة: " : "Wholesale: "}{fmt(posPrice(p))} {sar}</div>
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

        {/* ── Cart + payment: عمود أكبر لعرض تفاصيل السلة بوضوح ── */}
        <div style={{ width: "42%", minWidth: 430, maxWidth: 560, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0, borderInlineStart: "1px solid var(--border)" }}>
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
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                          {isAr ? "سعر الجملة: " : "Wholesale: "}{fmt(line.wholesale_price)} {sar}
                        </div>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
                      <label style={{ fontSize: 10, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {isAr ? "سعر البيع الفعلي" : "Actual sale price"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="form-input"
                        style={{ flex: 1, height: 27, padding: "2px 6px", fontSize: 12, fontWeight: 700 }}
                        value={line.unit_price}
                        onChange={(e) => setCart((c) => c.map((l) => l.id === line.id ? { ...l, unit_price: Math.max(0, parseFloat(e.target.value) || 0) } : l))}
                      />
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{sar}</span>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 10, color: "var(--text-secondary)" }}>
                      <input type="checkbox" checked={line.prices_include_vat} onChange={(e) => setCart((c) => c.map((l) => l.id === line.id ? { ...l, prices_include_vat: e.target.checked } : l))} />
                      {isAr ? "السعر شامل الضريبة" : "Price includes VAT"}
                    </label>
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
            {/* Customer — نفس بيانات العملاء المستخدمة في الإدارة */}
            {!terminal?.customer_account_parent_id && <div style={{ marginBottom: 8, padding: "7px 9px", borderRadius: 7, background: "#FFF7ED", color: "#9A3412", fontSize: 11 }}>{isAr ? "لم يُضبط حساب العملاء لهذا الجهاز. لن تظهر قائمة العملاء ولن يمكن إضافة عميل حتى يحدده المدير من إعدادات جهاز POS." : "No customer account is configured for this terminal. Customers cannot be listed or added until a manager selects it in POS terminal settings."}</div>}
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input className="form-input" style={{ fontSize: 12, height: 32 }} placeholder={isAr ? "ابحث عن العميل أو اختره" : "Search/select customer"} value={customerId ? custName : customerSearch} onChange={(e) => { setCustomerId(undefined); setCustName(""); setCustomerSearch(e.target.value); void loadPosCustomers(e.target.value); }} onFocus={() => { if (!customers.length) void loadPosCustomers(); }} />
                {!customerId && customerSearch && customers.length > 0 && <div style={{ position: "absolute", zIndex: 20, insetInline: 0, top: 35, background: "white", border: "1px solid var(--border)", borderRadius: 6, maxHeight: 170, overflowY: "auto" }}>
                  {customers.slice(0, 8).map((c: any) => <button key={c.id} type="button" onClick={() => selectCustomer(c)} style={{ display: "block", width: "100%", border: 0, background: "white", padding: "7px 9px", textAlign: isAr ? "right" : "left", cursor: "pointer", fontSize: 12 }}>{c.name_ar} {c.vat_number ? `— ${c.vat_number}` : ""}</button>)}
                </div>}
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setCustomerForm((f: any) => ({ ...f, customer_type: "company", name_ar: "", name_en: "", ar_account_id: terminal?.customer_account_parent_id || "" })); setShowCustomerForm(true); }}><Icon name="plus" size={13} /> {isAr ? "عميل جديد" : "New customer"}</button>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input className="form-input" style={{ flex: 1, fontSize: 12, height: 30 }} placeholder={isAr ? "اسم العميل الظاهر" : "Customer name"} value={custName} onChange={(e) => { setCustomerId(undefined); setCustName(e.target.value); }} />
              <input className="form-input" style={{ flex: 1, fontSize: 12, height: 30 }} placeholder={isAr ? "الجوال" : "Phone"} value={custPhone} onChange={(e) => setCustPhone(e.target.value)} />
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
              {(["cash", "mada", "tabby", "tamara", "bank_transfer", "split"] as const).map((m) => (
                <button key={m} onClick={() => setPayMethod(m)}
                  style={{ flex: 1, minWidth: 60, padding: "5px 4px", borderRadius: 8, border: `1.5px solid ${payMethod === m ? actCfg.color : "var(--border)"}`, background: payMethod === m ? actCfg.bg : "white", color: payMethod === m ? actCfg.color : "var(--text-secondary)", fontSize: 10, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                  <Icon name={m === "cash" ? "cash" : "card"} size={12} />
                  {m === "cash" ? (isAr ? "نقدي" : "Cash") : m === "mada" ? (isAr ? "شبكة" : "Network") : m === "tabby" ? "تابي" : m === "tamara" ? "تمارا" : m === "bank_transfer" ? (isAr ? "تحويل بنكي" : "Bank transfer") : (isAr ? "مقسّم" : "Split")}
                </button>
              ))}
            </div>

            {payMethod === "cash" && (
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <input type="number" className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder={isAr ? "المبلغ المدفوع" : "Cash tendered"} value={cashTendered} onChange={(e) => setCashTendered(e.target.value)} />
                {change > 0 && <div style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 700, color: "#6F4A84", whiteSpace: "nowrap" }}>{isAr ? "الباقي:" : "Change:"} {fmt(change)} {sar}</div>}
              </div>
            )}
            {(["mada", "tabby", "tamara", "bank_transfer"] as string[]).includes(payMethod) && (
              <input type="number" className="form-input" style={{ marginBottom: 8, fontSize: 13 }} placeholder={isAr ? "مبلغ الشبكة" : "Network amount"} value={cardAmount} onChange={(e) => setCardAmount(e.target.value)} />
            )}
            {payMethod === "split" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                <input type="number" className="form-input" style={{ fontSize: 13 }} placeholder={isAr ? "مبلغ النقد" : "Cash amount"} value={cashTendered} onChange={(e) => setCashTendered(e.target.value)} />
                <input type="number" className="form-input" style={{ fontSize: 13 }} placeholder={isAr ? "مبلغ الشبكة" : "Network amount"} value={cardAmount} onChange={(e) => setCardAmount(e.target.value)} />
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 10px", marginBottom: 8, borderRadius: 8, background: paymentRemaining > 0 ? "#FFF7ED" : "#F0FDF4", color: paymentRemaining > 0 ? "#9A3412" : "#166534", fontSize: 12, fontWeight: 700 }}>
              <span>{isAr ? "المدفوع الآن:" : "Paid now:"} {fmt(Math.min(enteredPayment, grandTotal))} {sar}</span>
              <span>{paymentRemaining > 0 ? (isAr ? "المتبقي:" : "Remaining:") : (isAr ? "مكتمل" : "Paid in full")} {paymentRemaining > 0 ? `${fmt(paymentRemaining)} ${sar}` : ""}</span>
            </div>

            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: 15, height: 44 }}
              onClick={completeSale} disabled={completing || !cart.length || !session}>
              <Icon name="check" size={18} />
              {completing ? (isAr ? "جاري الحفظ..." : "Processing...") : (isAr ? "إتمام البيع" : "Complete Sale")}
            </button>
          </div>
        </div>
      </div>

      {showCustomerForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 760, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="card-header"><h3 className="card-title">{isAr ? "إضافة عميل — بيانات الفوترة الكاملة" : "Add customer — Full billing details"}</h3><button className="btn btn-ghost btn-icon" onClick={() => setShowCustomerForm(false)}><Icon name="close" size={18} /></button></div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
              {[["name_ar", isAr ? "اسم الشركة *" : "Company name *"], ["vat_number", isAr ? "الرقم الضريبي" : "VAT number"], ["cr_number", isAr ? "السجل التجاري" : "CR number"], ["phone", isAr ? "الجوال" : "Phone"], ["activity_type", isAr ? "النشاط التجاري" : "Business activity"], ["address_building", isAr ? "رقم المبنى" : "Building"], ["address_street", isAr ? "الشارع" : "Street"], ["address_district", isAr ? "الحي" : "District"], ["address_city", isAr ? "المدينة" : "City"], ["address_postal", isAr ? "الرمز البريدي" : "Postal code"], ["address_additional", isAr ? "الرقم الإضافي" : "Additional number"]].map(([key, label]) => <label key={key} style={{ fontSize: 12 }}>{label}<input className="form-input" value={customerForm[key]} onChange={(e) => setCustomerForm((f: any) => ({ ...f, [key]: e.target.value }))} /></label>)}

              <label style={{ fontSize: 12, gridColumn: "1 / -1" }}>{isAr ? "ملاحظات" : "Notes"}<textarea className="form-input" rows={2} value={customerForm.notes} onChange={(e) => setCustomerForm((f: any) => ({ ...f, notes: e.target.value }))} /></label>
            </div>
            <div className="card-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button className="btn btn-secondary" onClick={() => setShowCustomerForm(false)}>{isAr ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" disabled={savingCustomer} onClick={savePosCustomer}>{savingCustomer ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ واختيار العميل" : "Save and select")}</button></div>
          </div>
        </div>
      )}

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
                <button key={s.id} onClick={() => { addLine(serialModal.product, { serial_item_id: s.id, serial_number: s.serial_number, wholesale_price: s.sale_price || posPrice(serialModal.product), unit_price: s.sale_price || posPrice(serialModal.product) }); setSerialModal(null); }}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6, background: "white", cursor: "pointer", textAlign: isAr ? "right" : "left" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = actCfg.color; e.currentTarget.style.background = actCfg.bg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "white"; }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.serial_number}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.condition === "new" ? (isAr ? "جديد" : "New") : s.condition === "used" ? (isAr ? "مستخدم" : "Used") : (isAr ? "مجدد" : "Refurbished")}</div>
                    <div style={{ fontSize: 10, color: s.will_transfer_to_terminal ? "#b45309" : "var(--text-muted)", marginTop: 2 }}>
                      {s.will_transfer_to_terminal ? (isAr ? "من الرئيسي — سيُنقل للفرع تلقائياً" : "From main — auto-transfer to branch") : (s.warehouse_name || (isAr ? "مستودع الفرع" : "Branch warehouse"))}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: actCfg.color, fontSize: 13 }}>{fmt(s.sale_price || posPrice(serialModal.product))} {sar}</div>
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
                <button key={v.id} onClick={() => { addLine(variantModal.product, { variant_id: v.id, variant_label: [v.size, v.color, v.other_attribute].filter(Boolean).join(" / "), wholesale_price: v.sale_price || posPrice(variantModal.product), unit_price: v.sale_price || posPrice(variantModal.product) }); setVariantModal(null); }}
                  style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 8px", background: "white", cursor: "pointer", textAlign: "center" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = actCfg.color; e.currentTarget.style.background = actCfg.bg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "white"; }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{[v.size, v.color].filter(Boolean).join(" / ") || v.sku}</div>
                  {v.other_attribute && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{v.other_attribute}</div>}
                  <div style={{ fontSize: 12, fontWeight: 700, color: actCfg.color, marginTop: 4 }}>{fmt(v.sale_price || posPrice(variantModal.product))} {sar}</div>
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

      {/* ── POS Receipt Modal ── */}
      {showPOSReceipt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 460 }}>
            <div className="card-header"><h3 className="card-title"><Icon name="receipt" size={16} />{isAr ? "سند قبض من العميل" : "Customer receipt"}</h3><button className="btn btn-ghost btn-icon" onClick={() => setShowPOSReceipt(false)}><Icon name="close" size={18} /></button></div>
            <div className="card-body">
              <div className="form-group"><label className="form-label">{isAr ? "العميل" : "Customer"}</label><select className="form-input form-select" value={posReceiptForm.customer_id} onChange={e => setPosReceiptForm({ ...posReceiptForm, customer_id: e.target.value })}><option value="">{isAr ? "اختر العميل" : "Select customer"}</option>{customers.map((c: any) => <option key={c.id} value={c.id}>{c.name_ar}{c.phone ? ` — ${c.phone}` : ""}</option>)}</select></div>
              <div className="form-group"><label className="form-label">{isAr ? "المبلغ" : "Amount"} ({sar})</label><input type="number" min="0.01" step="0.01" className="form-input" value={posReceiptForm.amount} onChange={e => setPosReceiptForm({ ...posReceiptForm, amount: e.target.value })} autoFocus /></div>
              <div className="form-group"><label className="form-label">{isAr ? "طريقة الدفع" : "Payment method"}</label><select className="form-input form-select" value={posReceiptForm.payment_method} onChange={e => setPosReceiptForm({ ...posReceiptForm, payment_method: e.target.value })}><option value="cash">{isAr ? "نقدي" : "Cash"}</option><option value="mada">{isAr ? "شبكة" : "Mada"}</option><option value="credit_card">{isAr ? "بطاقة ائتمانية" : "Credit card"}</option><option value="stc_pay">STC Pay</option><option value="bank_transfer">{isAr ? "تحويل بنكي" : "Bank transfer"}</option></select></div>
              <div className="form-group"><label className="form-label">{isAr ? "رقم الفاتورة (اختياري)" : "Invoice ID (optional)"}</label><input className="form-input" value={posReceiptForm.invoice_id} onChange={e => setPosReceiptForm({ ...posReceiptForm, invoice_id: e.target.value })} placeholder={isAr ? "اتركه فارغًا للتحصيل من الرصيد العام" : "Leave blank for customer balance"} /></div>
              <div className="form-group"><label className="form-label">{isAr ? "البيان" : "Description"}</label><input className="form-input" value={posReceiptForm.description} onChange={e => setPosReceiptForm({ ...posReceiptForm, description: e.target.value })} /></div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button className="btn btn-secondary" onClick={() => setShowPOSReceipt(false)}>{isAr ? "إلغاء" : "Cancel"}</button><button className="btn btn-primary" onClick={handlePOSReceipt} disabled={savingPOSReceipt}><Icon name="check" size={15} />{savingPOSReceipt ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ وترحيل السند" : "Post receipt")}</button></div>
            </div>
          </div>
        </div>
      )}
      {/* ── Cash Outflow Modal ── */}
      {showCashOutflow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div className="card" style={{ width: "100%", maxWidth: 400 }}>
            <div className="card-header">
              <h3 className="card-title"><Icon name="cash" size={16} />{isAr ? "مخرج نقدي من الدرج" : "Cash outflow"}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCashOutflow(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">{isAr ? "نوع المخرج" : "Outflow type"}</label>
                <select className="form-input form-select" value={cashOutflowForm.outflow_type} onChange={(e) => setCashOutflowForm({ ...cashOutflowForm, outflow_type: e.target.value })}>
                  <option value="donation">{isAr ? "صدقة" : "Donation"}</option>
                  <option value="food">{isAr ? "مصروف أكل" : "Food expense"}</option>
                  <option value="fuel">{isAr ? "مصروف بنزين" : "Fuel expense"}</option>
                  <option value="delivery">{isAr ? "مصروف توصيل" : "Delivery expense"}</option>
                  <option value="employee_advance">{isAr ? "سلفة موظف" : "Employee advance"}</option>
                  <option value="other">{isAr ? "أخرى" : "Other"}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{isAr ? "المبلغ" : "Amount"} ({sar})</label>
                <input type="number" className="form-input" min={0.01} step={0.01} value={cashOutflowForm.amount} onChange={(e) => setCashOutflowForm({ ...cashOutflowForm, amount: e.target.value })} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">{isAr ? "البيان / السبب" : "Description / reason"}</label>
                <textarea className="form-input" rows={2} value={cashOutflowForm.description} onChange={(e) => setCashOutflowForm({ ...cashOutflowForm, description: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setShowCashOutflow(false)}>{isAr ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={handleCashOutflow} disabled={savingCashOutflow}>
                  <Icon name="check" size={15} />
                  {savingCashOutflow ? (isAr ? "جاري الحفظ..." : "Saving...") : (isAr ? "حفظ المخرج" : "Save outflow")}
                </button>
              </div>
            </div>
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
                  { label: isAr ? "رصيد الافتتاح" : "Opening Cash",       val: `${fmt(Number(session?.opening_cash || 0))} ${sar}`, color: "var(--primary)" },
                  { label: isAr ? "إجمالي المبيعات" : "Total Sales", val: `${fmt(Number(session?.total_sales))} ${sar}`, color: "var(--success)" },
                  { label: isAr ? "عدد المعاملات" : "Transactions",  val: String(session?.transaction_count), color: "var(--primary)" },
                  { label: isAr ? "نقدي" : "Cash",                   val: `${fmt(Number(session?.total_cash))} ${sar}`, color: "var(--text-primary)" },
                  { label: isAr ? "شبكة" : "Network",                 val: `${fmt(Number(session?.total_card))} ${sar}`, color: "var(--text-primary)" },
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
              <div className="form-group">
                <label className="form-label">{isAr ? "كلمة مرور إغلاق الجلسة (4 أرقام)" : "Session Close PIN (4 digits)"}</label>
                <input type="password" className="form-input" inputMode="numeric" maxLength={4} value={closePin} onChange={(e) => setClosePin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" />
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

            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, margin: "12px 16px 0", padding: "10px 12px", borderRadius: 8, background: receiptModal.remaining > 0 ? "#FFF7ED" : "#F0FDF4", color: receiptModal.remaining > 0 ? "#9A3412" : "#166534", fontSize: 12, fontWeight: 700 }}>
              <span>{isAr ? "المدفوع:" : "Paid:"} {fmt(receiptModal.paidNow || 0)} {sar}</span>
              <span>{receiptModal.remaining > 0 ? (isAr ? "المتبقي:" : "Remaining:") : (isAr ? "مدفوعة بالكامل" : "Paid in full")} {receiptModal.remaining > 0 ? `${fmt(receiptModal.remaining)} ${sar}` : ""}</span>
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
                  cash_tendered={receiptModal.payMethod === "cash" || receiptModal.payMethod === "split" ? parseFloat(receiptModal.cashTendered || "0") : undefined}
                  change_amount={receiptModal.change}
                  card_amount={["mada", "tabby", "tamara", "bank_transfer"].includes(receiptModal.payMethod) || receiptModal.payMethod === "split" ? parseFloat(receiptModal.cardAmount || "0") : undefined}
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
                onClick={printThermalReceipt}
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
            cash_tendered={receiptModal.payMethod === "cash" || receiptModal.payMethod === "split" ? parseFloat(receiptModal.cashTendered || "0") : undefined}
            change_amount={receiptModal.change}
            card_amount={["mada", "tabby", "tamara", "bank_transfer"].includes(receiptModal.payMethod) || receiptModal.payMethod === "split" ? parseFloat(receiptModal.cardAmount || "0") : undefined}
            customer_name={receiptModal.customer_name}
            customer_phone={receiptModal.customer_phone}
            qr_code={receiptModal.qr_code}
          />
        </div>
      )}
    </div>
  );
}
