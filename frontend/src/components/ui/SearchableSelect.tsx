"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SearchableOption = {
  value: string;
  label: string;
  searchText?: string;
};

type Props = {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  locale?: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  required?: boolean;
};

export default function SearchableSelect({
  options, value, onChange, locale = "ar", placeholder, className = "form-input", style,
  disabled = false, required = false,
}: Props) {
  const ar = locale === "ar";
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => String(option.value) === String(value));
  const [text, setText] = useState(selected?.label || "");
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => setText(selected?.label || ""), [selected?.label]);
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect) setMenuStyle({ position: "fixed", zIndex: 6000, top: rect.bottom + 3, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const query = text.trim().toLocaleLowerCase();
  const filtered = useMemo(() => !query ? options : options.filter((option) => `${option.label} ${option.searchText || ""}`.toLocaleLowerCase().includes(query)), [options, query]);
  const choose = (option: SearchableOption) => { setText(option.label); onChange(option.value); setOpen(false); };

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      <input
        className={className}
        style={{ ...style, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        value={text}
        placeholder={placeholder || (ar ? "اكتب للبحث والاختيار..." : "Type to search and select...")}
        autoComplete="off"
        disabled={disabled}
        required={required && !value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          setOpen(true);
          const exact = options.find((option) => option.label.toLocaleLowerCase() === next.trim().toLocaleLowerCase());
          onChange(exact?.value || "");
        }}
        onBlur={() => window.setTimeout(() => {
          const exact = options.find((option) => option.label.toLocaleLowerCase() === text.trim().toLocaleLowerCase());
          if (exact) choose(exact); else if (!text.trim()) onChange(""); else setText(selected?.label || "");
        }, 150)}
      />
      {open && !disabled && (
        <div style={{ ...menuStyle, maxHeight: 280, overflowY: "auto", background: "#fff", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 10px 24px rgba(15,23,42,.14)" }}>
          {filtered.length === 0 ? <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "لا توجد نتائج مطابقة" : "No matching results"}</div> : filtered.map((option) => (
            <button key={option.value} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)} style={{ display: "block", width: "100%", border: 0, background: String(option.value) === String(value) ? "#F3E8FF" : "#fff", padding: "9px 12px", textAlign: ar ? "right" : "left", cursor: "pointer", fontSize: 12, whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.6 }}>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
