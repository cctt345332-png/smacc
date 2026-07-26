// صفحة الطباعة بدون أي layout — فقط المحتوى
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
