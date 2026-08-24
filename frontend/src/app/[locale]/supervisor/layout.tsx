import SupervisorLayout from "@/components/layout/SupervisorLayout";
export default async function Layout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const {
    locale
  } = params;

  const {
    children
  } = props;

  return <SupervisorLayout locale={locale}>{children}</SupervisorLayout>;
}
