"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type Account = {
  id: string;
  code?: string;
  name_ar?: string;
  name_en?: string;
  allow_direct_posting?: boolean;
  is_active?: boolean;
};

type Props = {
  accounts: Account[];
  value: string;
  onChange: (accountId: string) => void;
  locale?: string;
  placeholder?: string;
  allowGroups?: boolean;
  className?: string;
  style?: React.CSSProperties;
  openUpward?: boolean;
};

export default function SearchableAccountSelect({
  accounts,
  value,
  onChange,
  locale = "ar",
  placeholder,
  allowGroups = false,
  className = "form-input",
  style,
  openUpward = false,
}: Props) {
  const ar = locale === "ar";
  const containerRef = useRef<HTMLDivElement>(null);
  const available = useMemo(
    () => accounts.filter((a) => a.is_active !== false && (allowGroups || a.allow_direct_posting !== false)),
    [accounts, allowGroups],
  );
  const selected = available.find((a) => a.id === value);
  const selectedLabel = selected ? accountLabel(selected, locale) : "";
  const [text, setText] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<React.CSSProperties>({});

  const updateMenuPosition = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition({ position: "fixed", zIndex: 5000, left: rect.left, top: rect.bottom + 4, width: rect.width });
  };

  useEffect(() => {
    setText(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const reposition = () => updateMenuPosition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => { window.removeEventListener("scroll", reposition, true); window.removeEventListener("resize", reposition); };
  }, [open]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const normalizedQuery = text.trim().toLocaleLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return available;
    return available.filter((account) => {
      const name = ((ar ? account.name_ar : account.name_en) || account.name_ar || account.name_en || "").toLocaleLowerCase();
      return `${account.code || ""} ${name}`.includes(normalizedQuery);
    });
  }, [available, normalizedQuery, ar]);

  const choose = (account: Account) => {
    onChange(account.id);
    setText(accountLabel(account, locale));
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        className={className}
        style={{ ...style, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        value={text}
        placeholder={placeholder || (ar ? "اكتب كود أو اسم الحساب..." : "Type account code or name...")}
        autoComplete="off"
        onFocus={() => { setOpen(true); window.setTimeout(updateMenuPosition, 0); }}
        onChange={(event) => {
          const nextText = event.target.value;
          setText(nextText);
          setOpen(true);
          window.setTimeout(updateMenuPosition, 0);
          const exact = available.find((account) => accountLabel(account, locale).toLocaleLowerCase() === nextText.trim().toLocaleLowerCase() || account.code?.toLocaleLowerCase() === nextText.trim().toLocaleLowerCase());
          onChange(exact?.id || "");
        }}
        onBlur={() => {
          window.setTimeout(() => {
            const exact = available.find((account) => accountLabel(account, locale).toLocaleLowerCase() === text.trim().toLocaleLowerCase() || account.code?.toLocaleLowerCase() === text.trim().toLocaleLowerCase());
            if (exact) choose(exact);
            else if (text.trim()) setText(selectedLabel);
            else onChange("");
          }, 150);
        }}
      />
      {open && (
        <div style={{ ...menuPosition, maxHeight: 280, overflowY: "auto", background: "#fff", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 10px 24px rgba(15,23,42,.14)" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "لا توجد حسابات مطابقة" : "No matching accounts"}</div>
          ) : filtered.map((account) => (
            <button
              key={account.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(account)}
              style={{ display: "block", width: "100%", border: 0, background: account.id === value ? "#F3E8FF" : "#fff", padding: "9px 12px", textAlign: ar ? "right" : "left", cursor: "pointer", fontSize: 12, whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word", lineHeight: 1.6 }}
            >
              <strong>{account.code || "—"}</strong>
              <span style={{ marginInlineStart: 8, overflowWrap: "anywhere", wordBreak: "break-word" }}>{ar ? account.name_ar || account.name_en : account.name_en || account.name_ar}</span>
              {allowGroups && <span style={{ marginInlineStart: 8, color: "var(--text-secondary)" }}>{account.allow_direct_posting === false ? (ar ? "(رئيسي)" : "(Group)") : (ar ? "(نهائي)" : "(Posting)")}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function accountLabel(account: Account, locale = "ar") {
  const name = locale === "ar" ? account.name_ar || account.name_en : account.name_en || account.name_ar;
  return `${account.code || ""} - ${name || ""}`;
}
