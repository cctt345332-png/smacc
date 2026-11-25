import { redirect } from "next/navigation";

export default async function MaintenancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/pos/maintenance-management`);
}
