"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type InvoiceSerial = { id: string; serial_number: string };

type Props = {
  locale: string;
  productName: string;
  serials: InvoiceSerial[];
  selectedIds: string[];
  onConfirm: (selectedIds: string[]) => void;
};

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();

export default function InvoiceSerialPicker({ locale, productName, serials, selectedIds, onConfirm }: Props) {
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [notFound, setNotFound] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const visible = serials.filter(serial => {
    const q = normalize(search);
    return !q || normalize(serial.serial_number).includes(q);
  });

  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);

  const importExcel = async (file?: File) => {
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = workbook.SheetNames.flatMap(name => XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false }) as unknown[][]);
      const values = rows.flat().map(normalize).filter(Boolean);
      const byNumber = new Map(serials.map(serial => [normalize(serial.serial_number), serial.id]));
      const matched: string[] = [];
      const missing: string[] = [];
      for (const value of Array.from(new Set(values))) {
        const id = byNumber.get(value);
        if (id) matched.push(id);
        else missing.push(value);
      }
      setSelected(current => Array.from(new Set([...current, ...matched])));
      setNotFound(missing);
    } catch {
      setNotFound([ar ? "تعذر قراءة ملف Excel" : "Could not read the Excel file"]);
    }
  };

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "2px dashed #C4B5FD", background: "#F5F3FF", color: "#75617F", fontWeight: 700, fontSize: 12, cursor: "pointer", textAlign: "center" }}>
        📋 {selected.length ? `${selected.length} ${ar ? "سيريال محدد من الفاتورة" : "invoice serials selected"}` : (ar ? "تحديد السيريالات من الفاتورة" : "Select serials from invoice")}
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 680, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontWeight: 800, color: "#5B21B6" }}>{ar ? "سيريالات الفاتورة الأصلية" : "Original invoice serials"}</div><div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>{productName} — {serials.length} {ar ? "سيريال" : "serials"}</div></div>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">✕</button>
            </div>
            <div style={{ padding: 16, overflowY: "auto" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <input className="form-input" value={search} onChange={e => setSearch(e.target.value)} placeholder={ar ? "بحث داخل سيريالات الفاتورة" : "Search invoice serials"} style={{ flex: 1, minWidth: 220 }} />
                <label className="btn btn-secondary btn-sm" style={{ cursor: "pointer" }}>
                  {ar ? "رفع Excel ومطابقة" : "Upload Excel and match"}
                  <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => importExcel(e.target.files?.[0])} />
                </label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(serials.map(serial => serial.id))}>{ar ? "تحديد الكل" : "Select all"}</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected([])}>{ar ? "إلغاء الكل" : "Clear"}</button>
              </div>
              {notFound.length > 0 && <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412", borderRadius: 8, padding: 10, fontSize: 12, marginBottom: 12 }}><b>{ar ? "لم توجد في الفاتورة:" : "Not found in this invoice:"}</b> {notFound.slice(0, 20).join("، ")}{notFound.length > 20 ? ` (+${notFound.length - 20})` : ""}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 6 }}>
                {visible.map(serial => <label key={serial.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8, border: `1px solid ${selectedSet.has(serial.id) ? "#8B5CF6" : "var(--border)"}`, background: selectedSet.has(serial.id) ? "#F5F3FF" : "white", cursor: "pointer", fontSize: 12 }}><input type="checkbox" checked={selectedSet.has(serial.id)} onChange={() => toggle(serial.id)} /><code style={{ fontWeight: 700 }}>{serial.serial_number}</code></label>)}
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>{ar ? "إلغاء" : "Cancel"}</button>
              <button type="button" className="btn btn-primary" onClick={() => { onConfirm(selected); setOpen(false); }}>{ar ? `حفظ التحديد (${selected.length})` : `Use selected (${selected.length})`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { InvoiceSerial };

