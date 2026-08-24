"use client";
import { useEffect, useState, use } from "react";
import { getSupervisorReps } from "@/lib/reps";

export default function SupervisorRepsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [reps, setReps]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSupervisorReps()
      .then(r => setReps(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{ar ? "مناديبي" : "My Reps"}</h1>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
          {reps.length} {ar ? "مندوب" : "reps"}
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          {ar ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : reps.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          {ar ? "لم يُعيَّن مناديب بعد" : "No reps assigned yet"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {reps.map((rep: any) => (
            <div key={rep.id} style={{ background: "var(--surface)", borderRadius: 14,
              padding: "16px 18px", border: "1px solid var(--border)",
              display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%",
                background: "#7C3AED18", display: "flex", alignItems: "center",
                justifyContent: "center", color: "#7C3AED", fontWeight: 800, fontSize: 16 }}>
                {rep.full_name?.charAt(0) || "R"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{rep.full_name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {rep.rep_code}
                  {rep.zone ? ` · ${rep.zone}` : ""}
                  {rep.phone ? ` · ${rep.phone}` : ""}
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                background: rep.is_active ? "#D1FAE5" : "#FEE2E2",
                color: rep.is_active ? "#059669" : "#DC2626" }}>
                {rep.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
