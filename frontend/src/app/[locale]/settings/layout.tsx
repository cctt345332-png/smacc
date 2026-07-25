import AppLayout from "@/components/layout/AppLayout";
export default function SettingsLayout({ children, params: { locale } }: { children: React.ReactNode; params: { locale: string } }) {
  return <AppLayout locale={locale}>{children}</AppLayout>;
}
