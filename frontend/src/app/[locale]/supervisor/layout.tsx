import SupervisorLayout from "@/components/layout/SupervisorLayout";
export default function Layout({ children, params: { locale } }: { children: React.ReactNode; params: { locale: string } }) {
  return <SupervisorLayout locale={locale}>{children}</SupervisorLayout>;
}
