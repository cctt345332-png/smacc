import AppLayout from "@/components/layout/AppLayout";

export default async function MaintenanceLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  return <AppLayout locale={locale}>{props.children}</AppLayout>;
}
