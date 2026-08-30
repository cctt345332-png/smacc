"use client";

import { useId, useMemo } from "react";

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
  const displayValue = selected ? `${selected.code || ""} - ${ar ? selected.name_ar || selected.name_en : selected.name_en || selected.name_ar}` : "";

  return (
    <>
      <input
        className={className}
        style={style}
        list={listId}
        value={displayValue}
        placeholder={placeholder || (ar ? "اكتب كود أو اسم الحساب..." : "Type account code or name...")}
        onChange={(event) => {
          const text = event.target.value.trim().toLowerCase();
          const exact = available.find((account) => {
            const name = (ar ? account.name_ar : account.name_en) || account.name_ar || account.name_en || "";
            return `${account.code || ""} - ${name}`.toLowerCase() === text || account.code?.toLowerCase() === text || name.toLowerCase() === text;
          });
          onChange(exact?.id || "");
        }}
        onBlur={(event) => {
          const text = event.target.value.trim().toLowerCase();
          const match = available.find((account) => {
            const name = (ar ? account.name_ar : account.name_en) || account.name_ar || account.name_en || "";
            const label = `${account.code || ""} - ${name}`.toLowerCase();
            return label === text || account.code?.toLowerCase() === text || name.toLowerCase() === text;
          });
          if (match) onChange(match.id);
          else if (!selected) onChange("");
        }}
      />
      <datalist id={listId}>
        {available.map((account) => {
          const name = (ar ? account.name_ar : account.name_en) || account.name_ar || account.name_en || "";
          return <option key={account.id} value={`${account.code || ""} - ${name}`} />;
        })}
      </datalist>
    </>
  );
}

export function accountLabel(account: Account, locale = "ar") {
  const name = locale === "ar" ? account.name_ar || account.name_en : account.name_en || account.name_ar;
  return `${account.code || ""} - ${name || ""}`;
}
