export default function RepDetailLayout({ children }: { children: React.ReactNode }) {
  // RepsLayout الأعلى يوفّر AppLayout بالفعل؛ تغليف التفاصيل مرة أخرى كان يكرر الرأس والهامش.
  return <>{children}</>;
}
