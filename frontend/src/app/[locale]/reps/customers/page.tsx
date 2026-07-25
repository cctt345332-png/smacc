"use client";
/**
 * صفحة عملاء المندوب — يعرض نفس العملاء لكن مع إمكانية الإضافة
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { getCustomers } from "@/lib/sales";

export default function RepCustomersPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = (q?: string) => {
    setLoading(true);
    getCustomers(q)
      .then((res) => setCustomers(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "العملاء" : "Customers"}</h1>
        </div>
        <Link href={`/${locale}/sales/customers/new`} className="btn btn-primary">
          + {ar ? "عميل جديد" : "New Customer"}
        </Link>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder={ar ? "بحث باسم العميل..." : "Search customers..."}
          value={search}
          onChange={(e) => { setSearch(e.target.value); load(e.target.value); }}
        />
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {ar ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : customers.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {ar ? "لا يوجد عملاء" : "No customers found"}
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "رقم العميل" : "Customer #"}</th>
                  <th>{ar ? "الاسم" : "Name"}</th>
                  <th>{ar ? "الجوال" : "Phone"}</th>
                  <th>{ar ? "المدينة" : "City"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: 12 }}>{c.customer_number}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.name_ar}</td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.address_city || "—"}</td>
                    <td>
                      <span className={`badge ${c.is_active ? "badge-success" : "badge-danger"}`} style={{ fontSize: 11 }}>
                        {c.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
                      </span>
                    </td>
                    <td>
                      <Link href={`/${locale}/reps/invoices/new?customer=${c.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#2563EB" }}>
                        {ar ? "فاتورة" : "Invoice"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
