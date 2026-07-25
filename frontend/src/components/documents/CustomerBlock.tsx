/**
 * CustomerBlock — بيانات العميل في المستندات الرسمية
 * يعرض فقط البيانات العامة المسموح بها في الفواتير وعروض الأسعار
 * لا يعرض: الهوية الوطنية، اسم المالك، الترخيص، الملفات
 */
interface CustomerBlockProps {
  customer: any;
  ar: boolean;
}

export default function CustomerBlock({ customer, ar }: CustomerBlockProps) {
  if (!customer) return <div style={{ fontSize: 14, fontWeight: 700 }}>—</div>;

  const address = [
    customer.address_building && customer.address_street
      ? `${customer.address_building} ${customer.address_street}`
      : customer.address_street || null,
    customer.address_district,
    customer.address_city,
    customer.address_postal,
  ].filter(Boolean).join("، ");

  return (
    <div>
      {/* الاسم */}
      <div style={{ fontSize: 15, fontWeight: 800 }}>{customer.name_ar || "—"}</div>
      {customer.name_en && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{customer.name_en}</div>
      )}

      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
        {/* الرقم الضريبي — للشركات والجهات الحكومية */}
        {customer.vat_number && (
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>{ar ? "الرقم الضريبي: " : "VAT: "}</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{customer.vat_number}</span>
          </div>
        )}

        {/* السجل التجاري */}
        {customer.cr_number && (
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>{ar ? "السجل التجاري: " : "CR: "}</span>
            <span style={{ fontWeight: 600 }}>{customer.cr_number}</span>
          </div>
        )}

        {/* العنوان الوطني */}
        {address && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{address}</div>
        )}

        {/* رقم الجوال */}
        {customer.phone && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{customer.phone}</div>
        )}

        {/* البريد الإلكتروني */}
        {customer.email && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{customer.email}</div>
        )}
      </div>
    </div>
  );
}
