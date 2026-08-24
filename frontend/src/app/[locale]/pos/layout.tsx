import AppLayout from "@/components/layout/AppLayout";
export default async function Layout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const {
    locale
  } = params;

  const {
    children
  } = props;

  return <AppLayout locale={locale}>{children}</AppLayout>;
}
