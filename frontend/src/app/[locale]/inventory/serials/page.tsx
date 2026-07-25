"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getItems, getSerials, addSerialsBulk, searchSerial, getWarehouses, updateSerial, deleteSerial } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const STATUS_BADGE: Record<string, string> = {
  in_stock: "badge-success", sold: "badge-gray",
  reserved: "badge-warning", damaged: "badge-danger",
};
const STATUS_AR: Record<string, string> = {
  in_stock: "متاح", sold: "مباع", reserved: "محجوز", damaged: "تالف",
};
const COND_AR: Record<string, string> = {
  new: "جديد", used: "مستخدم", refurbished: "مجدد",
};
const COND_BADGE: Record<string, string> = {
  new: "badge-success", used: "badge-warning", refurbished: "badge-info",
};

export default function SerialsPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [serials, setSerials] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState("in_stock");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [editSerial, setEditSerial] = useState<any>(null);
  const [editSerialForm, setEditSerialForm] = useState<any>({});

  // إعدادات الإضافة المجمعة
  const [bulkTab, setBulkTab] = useState<"manual" | "excel">("manual");
  const [bulkForm, setBulkForm] = useState({
    condition: "new",
    cost_price: "",
    sale_price: "",
    warehouse_id: "",
  });
  const [bulkLines, setBulkLines] = useState([{ serial_number: "", cost_price: "", sale_price: "" }]);

  // Excel/CSV paste + file upload
  const [pasteText, setPasteText] = useState("");
  const [excelColumn, setExcelColumn] = useState<"first" | "second">("first"); // العمود المختار
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]); // رؤوس أعمدة الملف

  // استخراج السيريالات من النص مع اختيار العمود
  const parsedFromPaste = (() => {
    const lines = pasteText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
    const result: string[] = [];
    for (const line of lines) {
      // فصل الأعمدة بـ tab أو فاصلة أو مسافة متعددة
      const cols = line.split(/[\t,;]+/).map(c => c.replace(/[^\w\-]/g, "").trim()).filter(c => c.length >= 8);
      const chosen = excelColumn === "second" ? cols[1] : cols[0];
      if (chosen && !result.includes(chosen)) result.push(chosen);
    }
    return result;
  })();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();

    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      // CSV/TXT — قراءة مباشرة
      const text = await file.text();
      setPasteText(text);
      // كشف الرؤوس
      const firstLine = text.split(/[\r\n]+/)[0] || "";
      const cols = firstLine.split(/[\t,;]+/).map(c => c.trim());
      setExcelHeaders(cols);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      // Excel — تحويل لنص عبر FileReader
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = ev.target?.result as ArrayBuffer;
          // قراءة بسيطة — نستخرج النصوص من XML داخل xlsx
          const decoder = new TextDecoder("utf-8");
          const text = decoder.decode(data);
          // استخراج الأرقام الموجودة مباشرة
          const numbers = (text.match(/\b\d{8,20}\b/g) || []);
          const unique = [...new Set(numbers)];
          setPasteText(unique.join("\n"));
          setExcelHeaders(["IMEI1", "IMEI2"]);
        } catch {
          alert(ar ? "تعذر قراءة الملف — جرّب CSV بدلاً من xlsx" : "Could not read file — try CSV instead");
        }
      };
      reader.readAsArrayBuffer(file);
    }
    // إعادة تعيين input
    e.target.value = "";
  };

  useEffect(() => {
    Promise.all([getItems({ tracking_type: "serial" }), getWarehouses()])
      .then(([p, w]) => { setProducts(p.data); setWarehouses(w.data); })
      .catch(() => {});
  }, []);

  const loadSerials = async (productId: string, status?: string) => {
    setLoadingSerials(true);
    try {
      const { data } = await getSerials(productId, status || undefined);
      setSerials(data);
    } catch {} finally { setLoadingSerials(false); }
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
    loadSerials(product.id, filterStatus);
  };

  const handleSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const { data } = await searchSerial(searchQ);
      setSearchResults(data);
    } catch {} finally { setSearching(false); }
  };

  const handleEditSerial = (s: any) => {
    setEditSerial(s);
    setEditSerialForm({
      condition: s.condition,
      status: s.status,
      cost_price: s.cost_price,
      sale_price: s.sale_price || "",
      notes: s.notes || "",
    });
  };

  const handleSaveEditSerial = async () => {
    setSaving(true);
    try {
      await updateSerial(editSerial.id, {
        ...editSerialForm,
        cost_price: parseFloat(editSerialForm.cost_price) || 0,
        sale_price: editSerialForm.sale_price ? parseFloat(editSerialForm.sale_price) : null,
      });
      setEditSerial(null);
      if (selectedProduct) loadSerials(selectedProduct.id, filterStatus);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const handleDeleteSerial = async (s: any) => {
    if (!confirm(ar ? `حذف السيريال ${s.serial_number}؟` : `Delete serial ${s.serial_number}?`)) return;
    try {
      await deleteSerial(s.id);
      if (selectedProduct) loadSerials(selectedProduct.id, filterStatus);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
  };

  const handleBulkSave = async () => {
    if (!selectedProduct) return alert(ar ? "اختر المنتج أولاً" : "Select a product first");

    // تجميع السيريالات حسب الطريقة النشطة
    let serialNumbers: string[] = [];
    if (bulkTab === "manual") {
      serialNumbers = bulkLines.map(l => l.serial_number.trim()).filter(Boolean);
    } else if (bulkTab === "excel") {
      serialNumbers = parsedFromPaste;
    }

    if (serialNumbers.length === 0)
      return alert(ar ? "أدخل سيريال واحد على الأقل" : "Enter at least one serial");

    setSaving(true);
    try {
      const payload = {
        condition: bulkForm.condition,
        cost_price: parseFloat(bulkForm.cost_price) || 0,
        sale_price: parseFloat(bulkForm.sale_price) || 0,
        warehouse_id: bulkForm.warehouse_id || null,
        serials: bulkTab === "manual"
          ? bulkLines.filter(l => l.serial_number.trim()).map(l => ({
              serial_number: l.serial_number.trim(),
              cost_price: l.cost_price ? parseFloat(l.cost_price) : undefined,
              sale_price: l.sale_price ? parseFloat(l.sale_price) : undefined,
            }))
          : serialNumbers.map(sn => ({ serial_number: sn })),
      };
      const { data } = await addSerialsBulk(selectedProduct.id, payload);
      if (data.errors?.length > 0) {
        const errMsg = data.errors.map((e: any) => `${e.serial_number}: ${e.error}`).join('\n');
        alert(ar
          ? `تم إضافة ${data.added} سيريال\nأخطاء:\n${errMsg}`
          : `Added ${data.added} serials\nErrors:\n${errMsg}`);
      } else {
        alert(ar ? `✅ تم إضافة ${data.added} سيريال بنجاح` : `✅ Added ${data.added} serials`);
      }
      if (data.added > 0) {
        setShowBulkModal(false);
        setBulkLines([{ serial_number: "", cost_price: "", sale_price: "" }]);
        setPasteText("");
        loadSerials(selectedProduct.id, filterStatus);
      }
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const inStockCount = serials.filter(s => s.status === "in_stock").length;
  const soldCount = serials.filter(s => s.status === "sold").length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/inventory`}>{ar ? "المخزون" : "Inventory"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "السيريالات" : "Serials"}</span>
          </div>
          <h1 className="page-title">{ar ? "إدارة السيريالات" : "Serial Management"}</h1>
          <p className="page-subtitle">{ar ? "إضافة وتتبع السيريالات لكل منتج" : "Add and track serials per product"}</p>
        </div>
        {selectedProduct && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowBulkModal(true)}>
            <Icon name="plus" size={14} /> {ar ? "إضافة سيريالات" : "Add Serials"}
          </button>
        )}
      </div>

      <div className="grid-2" style={{ marginBottom: 20, alignItems: "start" }}>
        {/* قائمة المنتجات */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{ar ? "المنتجات (بسيريال)" : "Products (Serial)"}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{products.length} {ar ? "منتج" : "products"}</span>
          </div>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {products.length === 0 ? (
              <div className="empty-state" style={{ padding: "24px 16px" }}>
                <div className="empty-state-title" style={{ fontSize: 13 }}>{ar ? "لا توجد منتجات بسيريال" : "No serial products"}</div>
                <Link href={`/${locale}/inventory/items/new`} className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                  {ar ? "إضافة منتج" : "Add Product"}
                </Link>
              </div>
            ) : products.map(p => (
              <div key={p.id}
                onClick={() => handleSelectProduct(p)}
                style={{
                  padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--border)",
                  background: selectedProduct?.id === p.id ? "#EFF6FF" : "white",
                  borderInlineStart: selectedProduct?.id === p.id ? "3px solid var(--primary)" : "3px solid transparent",
                  transition: "all 0.1s",
                }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name_ar}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: 8 }}>
                  <span>{p.sku}</span>
                  {p.color && <span style={{ color: "#6366F1" }}>{p.color}</span>}
                  {p.storage && <span style={{ color: "#059669" }}>{p.storage}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* بحث بالسيريال */}
        <div className="card">
          <div className="card-header"><span className="card-title">{ar ? "بحث بالسيريال" : "Search by Serial"}</span></div>
          <div className="card-body">
            <div style={{ display: "flex", gap: 8 }}>
              <input className="form-input" style={{ flex: 1 }}
                value={searchQ} onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder={ar ? "ابحث بالسيريال أو IMEI..." : "Search by serial or IMEI..."} />
              <button className="btn btn-primary btn-sm" onClick={handleSearch} disabled={searching}>
                {searching ? "..." : (ar ? "بحث" : "Search")}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {searchResults.map(s => (
                  <div key={s.serial_id} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 8, background: "#F8FAFC" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <code style={{ fontWeight: 700, fontSize: 13 }}>{s.serial_number}</code>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{s.product_name}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <span className={`badge ${COND_BADGE[s.condition] || "badge-gray"}`} style={{ fontSize: 10 }}>{COND_AR[s.condition] || s.condition}</span>
                          <span className={`badge ${STATUS_BADGE[s.status] || "badge-gray"}`} style={{ fontSize: 10 }}>{STATUS_AR[s.status] || s.status}</span>
                          {s.product_color && <span className="badge badge-info" style={{ fontSize: 10 }}>{s.product_color}</span>}
                          {s.product_storage && <span className="badge badge-gray" style={{ fontSize: 10 }}>{s.product_storage}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "end" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{ar ? "تكلفة:" : "Cost:"} {fmt(s.cost_price)}</div>
                        {s.sale_price && <div style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>{ar ? "بيع:" : "Sale:"} {fmt(s.sale_price)}</div>}
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 6, fontSize: 11 }}
                      onClick={() => { const p = products.find(x => x.id === s.product_id); if (p) handleSelectProduct(p); setSearchResults([]); setSearchQ(""); }}>
                      {ar ? "عرض المنتج" : "View Product"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* السيريالات للمنتج المختار */}
      {selectedProduct && (
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">{selectedProduct.name_ar}</span>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                {ar ? "متاح:" : "In Stock:"} <strong style={{ color: "#059669" }}>{inStockCount}</strong>
                {" · "}
                {ar ? "مباع:" : "Sold:"} <strong style={{ color: "#94A3B8" }}>{soldCount}</strong>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select className="form-input form-select" style={{ width: 140, height: 32, fontSize: 12 }}
                value={filterStatus} onChange={e => { setFilterStatus(e.target.value); loadSerials(selectedProduct.id, e.target.value); }}>
                <option value="">{ar ? "الكل" : "All"}</option>
                <option value="in_stock">{ar ? "متاح" : "In Stock"}</option>
                <option value="sold">{ar ? "مباع" : "Sold"}</option>
                <option value="reserved">{ar ? "محجوز" : "Reserved"}</option>
                <option value="damaged">{ar ? "تالف" : "Damaged"}</option>
              </select>
              <button className="btn btn-primary btn-sm" onClick={() => setShowBulkModal(true)}>
                <Icon name="plus" size={14} /> {ar ? "إضافة سيريالات" : "Add Serials"}
              </button>
            </div>
          </div>
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            {loadingSerials ? (
              <div className="empty-state" style={{ padding: "24px" }}><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
            ) : serials.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px" }}>
                <div className="empty-state-title">{ar ? "لا توجد سيريالات" : "No serials"}</div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowBulkModal(true)}>
                  {ar ? "إضافة سيريالات" : "Add Serials"}
                </button>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{ar ? "رقم السيريال" : "Serial #"}</th>
                    <th>{ar ? "الحالة" : "Condition"}</th>
                    <th>{ar ? "الوضع" : "Status"}</th>
                    <th>{ar ? "اللون" : "Color"}</th>
                    <th>{ar ? "السعة" : "Storage"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "التكلفة" : "Cost"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "سعر البيع" : "Sale Price"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الربح" : "Profit"}</th>
                    <th style={{ width: 80 }}>{ar ? "إجراءات" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {serials.map((s: any) => {
                    const profit = s.sale_price ? Number(s.sale_price) - Number(s.cost_price) : null;
                    return (
                      <tr key={s.id}>
                        <td><code style={{ background: "#F1F5F9", padding: "2px 8px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{s.serial_number}</code></td>
                        <td><span className={`badge ${COND_BADGE[s.condition] || "badge-gray"}`}>{COND_AR[s.condition] || s.condition}</span></td>
                        <td><span className={`badge ${STATUS_BADGE[s.status] || "badge-gray"}`}>{STATUS_AR[s.status] || s.status}</span></td>
                        <td style={{ fontSize: 13 }}>{s.color || "—"}</td>
                        <td style={{ fontSize: 13 }}>{s.storage || "—"}</td>
                        <td style={{ textAlign: "end", fontFamily: "monospace" }}>{fmt(s.cost_price)}</td>
                        <td style={{ textAlign: "end", fontFamily: "monospace", color: "#059669" }}>{s.sale_price ? fmt(s.sale_price) : "—"}</td>
                        <td style={{ textAlign: "end", fontWeight: 700, color: profit !== null ? (profit >= 0 ? "#059669" : "#DC2626") : "var(--text-muted)" }}>
                          {profit !== null ? fmt(profit) : "—"}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-ghost btn-sm btn-icon" title={ar ? "تعديل" : "Edit"}
                              onClick={() => handleEditSerial(s)}>
                              <Icon name="edit" size={13} />
                            </button>
                            {s.status !== "sold" && (
                              <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "var(--danger)" }}
                                title={ar ? "حذف" : "Delete"} onClick={() => handleDeleteSerial(s)}>
                                <Icon name="trash" size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal تعديل السيريال */}
      {editSerial && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 440 }} className="animate-slide">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "تعديل السيريال" : "Edit Serial"}</h2>
                <code style={{ fontSize: 12, color: "var(--text-secondary)" }}>{editSerial.serial_number}</code>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditSerial(null)}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div className="form-group">
                <label className="form-label">{ar ? "الحالة" : "Condition"}</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ v: "new", ar: "جديد" }, { v: "used", ar: "مستخدم" }, { v: "refurbished", ar: "مجدد" }].map(c => (
                    <button key={c.v} type="button"
                      onClick={() => setEditSerialForm((f: any) => ({ ...f, condition: c.v }))}
                      style={{
                        flex: 1, padding: "7px 4px", borderRadius: 8, border: "1px solid",
                        borderColor: editSerialForm.condition === c.v ? "var(--primary)" : "var(--border)",
                        background: editSerialForm.condition === c.v ? "var(--primary)" : "white",
                        color: editSerialForm.condition === c.v ? "white" : "var(--text-secondary)",
                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                      }}>{c.ar}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "الوضع" : "Status"}</label>
                <select className="form-input form-select" value={editSerialForm.status}
                  onChange={e => setEditSerialForm((f: any) => ({ ...f, status: e.target.value }))}>
                  <option value="in_stock">{ar ? "متاح" : "In Stock"}</option>
                  <option value="reserved">{ar ? "محجوز" : "Reserved"}</option>
                  <option value="damaged">{ar ? "تالف" : "Damaged"}</option>
                  <option value="sold">{ar ? "مباع" : "Sold"}</option>
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">{ar ? "سعر الشراء" : "Cost Price"}</label>
                  <input type="number" className="form-input" value={editSerialForm.cost_price}
                    onChange={e => setEditSerialForm((f: any) => ({ ...f, cost_price: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "سعر البيع" : "Sale Price"}</label>
                  <input type="number" className="form-input" value={editSerialForm.sale_price}
                    onChange={e => setEditSerialForm((f: any) => ({ ...f, sale_price: e.target.value }))} />
                </div>
              </div>
              {editSerialForm.cost_price && editSerialForm.sale_price && (
                <div style={{ background: "#F0FDF4", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{ar ? "الربح المتوقع:" : "Expected Profit:"} </span>
                  <span style={{ fontWeight: 700, color: parseFloat(editSerialForm.sale_price) - parseFloat(editSerialForm.cost_price) >= 0 ? "#059669" : "#DC2626" }}>
                    {fmt(parseFloat(editSerialForm.sale_price) - parseFloat(editSerialForm.cost_price))} SAR
                  </span>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
                <input className="form-input" value={editSerialForm.notes}
                  onChange={e => setEditSerialForm((f: any) => ({ ...f, notes: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-secondary" onClick={() => setEditSerial(null)}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={handleSaveEditSerial} disabled={saving}>
                  {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التعديلات" : "Save Changes")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal إضافة سيريالات مجمعة */}
      {showBulkModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 700, maxHeight: "90vh", display: "flex", flexDirection: "column" }} className="animate-slide">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>{ar ? "إضافة سيريالات مجمعة" : "Bulk Add Serials"}</h2>
                {selectedProduct && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{selectedProduct.name_ar}</div>}
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowBulkModal(false)}>✕</button>
            </div>

            <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
              {/* الإعدادات المشتركة */}
              <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 11 }}>{ar ? "الحالة" : "Condition"}</label>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[{ v: "new", ar: "جديد" }, { v: "used", ar: "مستخدم" }, { v: "refurbished", ar: "مجدد" }].map(c => (
                        <button key={c.v} type="button" onClick={() => setBulkForm(f => ({ ...f, condition: c.v }))}
                          style={{ flex: 1, padding: "5px 2px", borderRadius: 6, border: "1px solid", borderColor: bulkForm.condition === c.v ? "var(--primary)" : "var(--border)", background: bulkForm.condition === c.v ? "var(--primary)" : "white", color: bulkForm.condition === c.v ? "white" : "var(--text-secondary)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>{c.ar}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11 }}>{ar ? "سعر الشراء" : "Cost"}</label>
                    <input type="number" className="form-input" style={{ fontSize: 12 }} value={bulkForm.cost_price} onChange={e => setBulkForm(f => ({ ...f, cost_price: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11 }}>{ar ? "سعر البيع" : "Sale"}</label>
                    <input type="number" className="form-input" style={{ fontSize: 12 }} value={bulkForm.sale_price} onChange={e => setBulkForm(f => ({ ...f, sale_price: e.target.value }))} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11 }}>{ar ? "المستودع" : "Warehouse"}</label>
                    <select className="form-input form-select" style={{ fontSize: 12 }} value={bulkForm.warehouse_id} onChange={e => setBulkForm(f => ({ ...f, warehouse_id: e.target.value }))}>
                      <option value="">— {ar ? "اختر" : "Select"} —</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* تبويبات طريقة الإدخال */}
              <div style={{ display: "flex", borderBottom: "2px solid var(--border)", marginBottom: 16 }}>
                {([
                  { key: "manual", icon: "📋", label: ar ? "يدوي" : "Manual", desc: ar ? "سطر سطر مع سعر مختلف" : "Row by row, different prices" },
                  { key: "excel",  icon: "📄", label: ar ? "Excel/نص" : "Excel/Text", desc: ar ? "ملف Excel أو CSV أو لصق" : "Excel/CSV file or paste" },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => setBulkTab(t.key)}
                    style={{ flex: 1, padding: "8px 6px", background: "none", border: "none", borderBottom: bulkTab === t.key ? "2px solid var(--primary)" : "2px solid transparent", color: bulkTab === t.key ? "var(--primary)" : "var(--text-secondary)", fontWeight: bulkTab === t.key ? 700 : 500, fontSize: 12, cursor: "pointer", marginBottom: -2 }}>
                    {t.icon} {t.label}
                    <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>{t.desc}</div>
                  </button>
                ))}
              </div>

              {/* ─── Manual Tab ─── */}
              {bulkTab === "manual" && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{bulkLines.filter(l => l.serial_number.trim()).length} {ar ? "سيريال" : "serials"}</div>
                    <button className="btn btn-secondary btn-sm" onClick={() => setBulkLines(l => [...l, { serial_number: "", cost_price: "", sale_price: "" }])}>
                      <Icon name="plus" size={14} /> {ar ? "إضافة سطر" : "Add Row"}
                    </button>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#F8FAFC" }}>
                        <th style={{ padding: "8px 10px", textAlign: "start", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>{ar ? "رقم السيريال / IMEI *" : "Serial / IMEI *"}</th>
                        <th style={{ padding: "8px 10px", textAlign: "end", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", width: 120 }}>{ar ? "سعر الشراء" : "Cost"}</th>
                        <th style={{ padding: "8px 10px", textAlign: "end", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", width: 120 }}>{ar ? "سعر البيع" : "Sale"}</th>
                        <th style={{ width: 36, borderBottom: "1px solid var(--border)" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkLines.map((line, i) => {
                        const cost = parseFloat(line.cost_price || bulkForm.cost_price) || 0;
                        const sale = parseFloat(line.sale_price || bulkForm.sale_price) || 0;
                        const profit = sale - cost;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ padding: "5px 8px" }}>
                              <input className="form-input" style={{ fontSize: 12 }} value={line.serial_number} dir="ltr" autoComplete="off"
                                onChange={e => setBulkLines(ls => ls.map((l, j) => j === i ? { ...l, serial_number: e.target.value } : l))}
                                onKeyDown={e => { if (e.key === "Enter") setBulkLines(ls => [...ls, { serial_number: "", cost_price: "", sale_price: "" }]); }}
                                placeholder="IMEI / Serial Number" />
                            </td>
                            <td style={{ padding: "5px 8px" }}>
                              <input type="number" className="form-input" style={{ fontSize: 12, textAlign: "end" }} value={line.cost_price} placeholder={bulkForm.cost_price || "—"}
                                onChange={e => setBulkLines(ls => ls.map((l, j) => j === i ? { ...l, cost_price: e.target.value } : l))} />
                            </td>
                            <td style={{ padding: "5px 8px" }}>
                              <input type="number" className="form-input" style={{ fontSize: 12, textAlign: "end" }} value={line.sale_price} placeholder={bulkForm.sale_price || "—"}
                                onChange={e => setBulkLines(ls => ls.map((l, j) => j === i ? { ...l, sale_price: e.target.value } : l))} />
                              {cost > 0 && sale > 0 && <div style={{ fontSize: 10, textAlign: "end", color: profit >= 0 ? "#059669" : "#DC2626" }}>{ar ? "ر:" : "P:"} {fmt(profit)}</div>}
                            </td>
                            <td style={{ padding: "5px 4px" }}>
                              {bulkLines.length > 1 && <button className="btn btn-ghost btn-sm btn-icon" style={{ color: "var(--danger)" }} onClick={() => setBulkLines(ls => ls.filter((_, j) => j !== i))}><Icon name="trash" size={13} /></button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}

              {/* ─── Excel/Paste Tab ─── */}
              {bulkTab === "excel" && (
                <div>
                  <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: 12, marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>
                      📄 {ar ? "رفع ملف Excel/CSV أو الصق النص مباشرة" : "Upload Excel/CSV file or paste text directly"}
                    </div>
                    <div style={{ fontSize: 11, color: "#D97706", marginTop: 4 }}>
                      {ar ? "يدعم: xlsx, csv, txt — كل جوال له IMEI1 وIMEI2، يأخذ العمود المحدد" : "Supports: xlsx, csv, txt — each phone has IMEI1 & IMEI2, picks selected column"}
                    </div>
                  </div>

                  {/* رفع ملف */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                      {ar ? "رفع ملف (xlsx / csv / txt)" : "Upload file (xlsx / csv / txt)"}
                    </label>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,.txt"
                      className="form-input"
                      style={{ fontSize: 12, padding: "8px 10px" }}
                      onChange={handleFileUpload}
                    />
                  </div>

                  {/* اختيار العمود */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                      {ar ? "أي عمود تريد؟ (IMEI1 أو IMEI2)" : "Which column? (IMEI1 or IMEI2)"}
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {([
                        { v: "first", ar: "العمود الأول (IMEI1)", en: "First Column (IMEI1)" },
                        { v: "second", ar: "العمود الثاني (IMEI2)", en: "Second Column (IMEI2)" },
                      ] as const).map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => setExcelColumn(opt.v)}
                          style={{
                            flex: 1, padding: "8px 10px", borderRadius: 8, border: "2px solid",
                            borderColor: excelColumn === opt.v ? "var(--primary)" : "var(--border)",
                            background: excelColumn === opt.v ? "var(--primary)" : "white",
                            color: excelColumn === opt.v ? "white" : "var(--text-secondary)",
                            fontSize: 12, fontWeight: 600, cursor: "pointer",
                          }}>
                          {ar ? opt.ar : opt.en}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* أو لصق مباشر */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                      {ar ? "أو الصق مباشرة (من Excel أو نتيجة QR)" : "Or paste directly (from Excel or QR result)"}
                    </label>
                    <textarea
                      className="form-input"
                      style={{ width: "100%", minHeight: 140, fontFamily: "monospace", fontSize: 12, direction: "ltr" }}
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      placeholder={"356789012345678\t356789012345679\n356789012345680\t356789012345681\n..."}
                    />
                  </div>

                  {/* معاينة النتيجة */}
                  {parsedFromPaste.length > 0 && (
                    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ fontSize: 12, marginBottom: 6 }}>
                        <span style={{ color: "#059669", fontWeight: 700 }}>✅ {parsedFromPaste.length}</span>
                        <span style={{ color: "var(--text-secondary)" }}>
                          {" "}{ar ? `سيريال من العمود ${excelColumn === "first" ? "الأول" : "الثاني"}` : `serials from ${excelColumn} column`}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {parsedFromPaste.slice(0, 6).map(sn => (
                          <code key={sn} style={{ background: "white", border: "1px solid #BBF7D0", borderRadius: 4, padding: "1px 5px", fontSize: 11 }}>{sn}</code>
                        ))}
                        {parsedFromPaste.length > 6 && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>+{parsedFromPaste.length - 6} {ar ? "أخرى" : "more"}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {bulkTab === "manual" && `${bulkLines.filter(l => l.serial_number.trim()).length} ${ar ? "سيريال" : "serials"}`}
                {bulkTab === "excel" && `${parsedFromPaste.length} ${ar ? "سيريال" : "serials"}`}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => { setShowBulkModal(false); setPasteText(""); }}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={handleBulkSave} disabled={saving}>
                  {saving ? (ar ? "جاري الإضافة..." : "Adding...") : (ar ? "➕ إضافة السيريالات" : "➕ Add Serials")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
