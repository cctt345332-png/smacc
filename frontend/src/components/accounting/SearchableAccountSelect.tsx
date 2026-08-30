"use client";

import { useEffect, useId, useMemo, useState } from "react";

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
}: Props) {
  const listId = useId();
  const ar = locale === "ar";
  const available = useMemo(
    () => accounts.filter((a) => a.is_active !== false && (allowGroups || a.allow_direct_posting !== false)),
    [accounts, allowGroups],
  );

  const selected = available.find((a) => a.id === value);
  const selectedLabel = selected ? accountLabel(selected, locale) : "";
  const [text, setText] = useState(selectedLabel);

  // Sync the visible text when the selected account changes outside this input.
  useEffect(() => {
    setText(selectedLabel);
  }, [selectedLabel]);

  const findExact = (rawText: string) => {
    const normalized = rawText.trim().toLocaleLowerCase();
    if (!normalized) return undefined;

    return available.find((account) => {
      const name = (ar ? account.name_ar : account.name_en) || account.name_ar || account.name_en || "";
      const code = (account.code || "").toLocaleLowerCase();
      const localizedName = name.toLocaleLowerCase();
      const label = `${code} - ${localizedName}`;
      return label === normalized || code === normalized || localizedName === normalized;
    });
  };

  return (
    <input
      className={className}
      style={style}
      list={listId}
      value={text}
      placeholder={placeholder || (ar ? "اكتب كود أو اسم الحساب..." : "Type account code or name...")}
      autoComplete="off"
      onChange={(event) => {
        const nextText = event.target.value;
        // Keep the user's text visible while typing. Do not clear the parent value
        // on every non-exact keystroke; that was causing the old field to reset.
        setText(nextText);
        const exact = findExact(nextText);
        onChange(exact?.id || "");
      }}
      onBlur={() => {
        const match = findExact(text);
        if (match) {
          onChange(match.id);
          setText(accountLabel(match, locale));
        } else if (text.trim()) {
          // Restore the current selection when the user leaves an unmatched search.
          setText(selectedLabel);
        } else {
          onChange("");
        }
      }}
    />
  );
}

export function accountLabel(account: Account, locale = "ar") {
  const name = locale === "ar" ? account.name_ar || account.name_en : account.name_en || account.name_ar;
  return `${account.code || ""} - ${name || ""}`;
}
