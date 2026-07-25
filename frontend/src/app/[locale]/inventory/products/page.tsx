import { redirect } from "next/navigation";

export default function ProductsRedirect({ params: { locale } }: { params: { locale: string } }) {
  redirect(`/${locale}/inventory/items`);
}
