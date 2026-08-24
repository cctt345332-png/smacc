import { redirect } from "next/navigation";

export default async function HomePage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;

  const {
    locale
  } = params;

  redirect(`/${locale}/landing`);
}
