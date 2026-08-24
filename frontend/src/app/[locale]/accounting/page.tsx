import { redirect } from "next/navigation";

/**
 * مدخل المحاسبة العام. كانت القائمة العلوية تشير إلى هذا المسار بينما لم تكن
 * له صفحة، فينتج 404. نوجهه إلى القيود اليومية بوصفها نقطة البدء التشغيلية.
 */
export default async function AccountingIndexPage(
  props: { params: Promise<{ locale: string }> }
) {
  const { locale } = await props.params;
  redirect(`/${locale}/accounting/journal`);
}
