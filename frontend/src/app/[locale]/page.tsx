import { redirect } from "next/navigation";

export default function HomePage({ params: { locale } }: { params: { locale: string } }) {
  redirect(`/${locale}/landing`);
}
