import RepLayout from "@/components/layout/RepLayout";
export default function Layout({ children, params: { locale } }: { children: React.ReactNode; params: { locale: string } }) {
  return <RepLayout locale={locale}>{children}</RepLayout>;
}
