import AppLayout from "@/components/layout/AppLayout";
import ReportPrintFrame from "@/components/documents/ReportPrintFrame";

export default async function ReportsLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const {
    locale
  } = params;

  const {
    children
  } = props;

  return (
    <AppLayout locale={locale}>
      <ReportPrintFrame locale={locale} />
      {children}
    </AppLayout>
  );
}
