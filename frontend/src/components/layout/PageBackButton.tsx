"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const HISTORY_LIMIT = 18;

function historyKey(locale: string) {
  return `masar:navigation-history:${locale}`;
}

function readHistory(key: string): string[] {
  try {
    const saved = sessionStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((path): path is string => typeof path === "string") : [];
  } catch {
    return [];
  }
}

export default function PageBackButton({
  locale,
  fallbackPath,
  className = "",
}: {
  locale: string;
  fallbackPath: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [canReturn, setCanReturn] = useState(false);
  const currentPath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    const key = historyKey(locale);
    const previous = readHistory(key);
    const next = previous[previous.length - 1] === currentPath
      ? previous
      : [...previous.filter(path => path !== currentPath), currentPath].slice(-HISTORY_LIMIT);

    sessionStorage.setItem(key, JSON.stringify(next));
    setCanReturn(next.length > 1);
  }, [currentPath, locale]);

  const goBack = () => {
    const key = historyKey(locale);
    const trail = readHistory(key);
    const currentIndex = trail.lastIndexOf(currentPath);
    const previousPath = currentIndex > 0 ? trail[currentIndex - 1] : null;

    if (previousPath) {
      sessionStorage.setItem(key, JSON.stringify(trail.slice(0, currentIndex)));
      router.push(previousPath);
      return;
    }

    router.push(fallbackPath);
  };

  return (
    <button
      type="button"
      className={`app-back-button ${className}`.trim()}
      onClick={goBack}
      title={canReturn ? (locale === "ar" ? "العودة للصفحة السابقة" : "Back to previous page") : (locale === "ar" ? "العودة للصفحة الرئيسية" : "Back to home")}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
      <span>{locale === "ar" ? "رجوع" : "Back"}</span>
    </button>
  );
}
