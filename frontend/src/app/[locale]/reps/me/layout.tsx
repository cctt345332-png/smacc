import RepLayout from "@/components/layout/RepLayout";
export default async function RepMeLayout(props: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const {
    locale
  } = params;

  const {
    children
  } = props;

  return <RepLayout locale={locale}>{children}</RepLayout>;
}
