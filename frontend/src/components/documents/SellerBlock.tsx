/**
 * SellerBlock — بيانات الشركة (البائع) في المستندات الرسمية
 */
interface SellerBlockProps {
  company: any;
  ar: boolean;
}

export default function SellerBlock({ company, ar }: SellerBlockProps) {
  if (!company) return <div style={{ fontSize: 14, fontWeight: 700 }}>—</div>;

  const address = [
    company.address_building && company.address_street
      ? `${company.address_building} ${company.address_street}`
      : company.address_street || null,
    company.address_district,
    company.address_city,
    company.address_postal,
  ].filter(Boolean).join("، ");

  return (
    <div>
      {/* الاسم */}
      <div style={{ fontSize: 15, fontWeight: 800 }}>{company.name || "—"}</div>
      {company.name_en && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{company.name_en}</div>
      )}

      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
        {/* الرقم الضريبي */}
        {company.vat_number && (
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>{ar ? "الرقم الضريبي: " : "VAT: "}</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{company.vat_number}</span>
          </div>
        )}

        {/* السجل التجاري */}
        {company.cr_number && (
          <div style={{ fontSize: 12 }}>
            <span style={{ color: "var(--text-muted)" }}>{ar ? "السجل التجاري: " : "CR: "}</span>
            <span style={{ fontWeight: 600 }}>{company.cr_number}</span>
          </div>
        )}

        {/* العنوان */}
        {address && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{address}</div>
        )}

        {/* الهاتف */}
        {company.phone && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{company.phone}</div>
        )}

        {/* البريد */}
        {company.email && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{company.email}</div>
        )}
      </div>
    </div>
  );
}
