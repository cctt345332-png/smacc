"use client";
import { getMapboxTileUrl } from "@/lib/mapConfig";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { getAllRepsLiveLocations, getReps, getSupervisors } from "@/lib/reps";

/* ------------------------------------------------------------------ */
/* الألوان المستخدمة للدبابيس — تتناوب حسب ترتيب المندوب              */
/* ------------------------------------------------------------------ */
const PIN_COLORS = [
  "#2563EB", "#059669", "#DC2626", "#D97706", "#7C3AED",
  "#0891B2", "#BE185D", "#15803D", "#B45309", "#4338CA",
];

/* لون ثابت للمشرفين — بنفسجي داكن مميز */
const SUPERVISOR_COLOR = "#6D28D9";

/* تنسيق الوقت */
const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

const fmtDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

/* ------------------------------------------------------------------ */
/* نوع بيانات الموقع                                                   */
/* ------------------------------------------------------------------ */
interface LiveLocation {
  rep_id: string;
  rep_code: string;
  rep_name: string;
  person_type?: "rep" | "supervisor"; // جديد
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  battery_level?: number;
  is_moving: boolean;
  recorded_at: string;
}

/* ================================================================== */
/* الصفحة الرئيسية                                                     */
/* ================================================================== */
export default function RepsTrackingPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const ar = locale === "ar";
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});

  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const [allReps, setAllReps] = useState<any[]>([]);
  const [allSupervisors, setAllSupervisors] = useState<any[]>([]);
  const [filterRep, setFilterRep] = useState<string>("all");
  const [filterType, setFilterType] = useState<"all" | "rep" | "supervisor">("all");
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedRep, setSelectedRep] = useState<LiveLocation | null>(null);

  /* ── تحميل بيانات الموقع ────────────────────────────────────────── */
  const fetchLocations = useCallback(async () => {
    try {
      const res = await getAllRepsLiveLocations();
      setLocations(Array.isArray(res.data) ? res.data : []);
      setLastUpdate(new Date());
    } catch { /* صمت */ }
    finally { setLoading(false); }
  }, []);

  /* ── تحميل قائمة المناديب للفلتر ───────────────────────────────── */
  useEffect(() => {
    getReps()
      .then(r => setAllReps(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
    getSupervisors()
      .then(r => setAllSupervisors(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  /* ── تهيئة الخريطة (Leaflet) ────────────────────────────────────── */
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // Leaflet يحتاج window → نستورده ديناميكياً
    import("leaflet").then(L => {
      // إصلاح أيقونات Leaflet الافتراضية عند استخدام Webpack
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [24.7136, 46.6753], // الرياض
        zoom: 11,
        zoomControl: true,
      });

      L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ar", {
        attribution: "Google Maps",
        maxZoom: 19,
      }).addTo(map);

      leafletMap.current = { map, L };
    });

    return () => {
      leafletMap.current?.map.remove();
      leafletMap.current = null;
    };
  }, []);

  /* ── تحديث الدبابيس عند تغير البيانات ─────────────────────────── */
  useEffect(() => {
    if (!leafletMap.current) return;
    const { map, L } = leafletMap.current;

    const visible = filterRep === "all"
      ? (filterType === "all" ? locations : locations.filter(l => (l.person_type ?? "rep") === filterType))
      : locations.filter(l => l.rep_id === filterRep);

    // إزالة دبابيس المناديب المحجوبين
    const visibleIds = new Set(visible.map(l => l.rep_id));
    Object.keys(markersRef.current).forEach(rid => {
      if (!visibleIds.has(rid)) {
        markersRef.current[rid].remove();
        delete markersRef.current[rid];
      }
    });

    visible.forEach((loc) => {
      const isSup = loc.person_type === "supervisor";
      // المشرف: لون ثابت بنفسجي — المندوب: لون متناوب حسب ID
      const color = isSup
        ? SUPERVISOR_COLOR
        : PIN_COLORS[loc.rep_id.charCodeAt(0) % PIN_COLORS.length];
      const initials = loc.rep_name
        .split(" ")
        .slice(0, 2)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase();

      // المشرف: شكل مربع مائل مع نجمة — المندوب: دبوس دائري
      const iconHtml = isSup
        ? `<div style="
            background:${color};
            color:white;
            border-radius:6px;
            transform:rotate(45deg);
            width:38px;height:38px;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 8px rgba(109,40,217,0.5);
            border:2.5px solid white;
            font-size:10px;font-weight:800;
          ">
            <span style="transform:rotate(-45deg);display:flex;flex-direction:column;align-items:center;gap:1px">
              <span style="font-size:9px">★</span>
              <span>${initials}</span>
            </span>
          </div>`
        : `<div style="
            background:${color};
            color:white;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            width:36px;height:36px;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 6px rgba(0,0,0,0.35);
            border:2px solid white;
            font-size:11px;font-weight:700;
          ">
            <span style="transform:rotate(45deg)">${initials}</span>
          </div>`;

      const icon = L.divIcon({
        html: iconHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -38],
        className: "",
      });

      const popupContent = `
        <div style="font-family:inherit;min-width:180px;padding:4px 0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <div style="font-weight:700;font-size:14px;color:${color}">${loc.rep_name}</div>
            ${isSup
              ? `<span style="background:#EDE9FE;color:#6D28D9;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px">${ar ? "مشرف" : "Supervisor"}</span>`
              : `<span style="background:#DBEAFE;color:#1D4ED8;font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px">${ar ? "مندوب" : "Rep"}</span>`
            }
          </div>
          <div style="font-size:12px;color:#6B7280;margin-bottom:4px">${loc.rep_code !== "SUP" ? loc.rep_code : ""}</div>
          <hr style="margin:6px 0;border-color:#E5E7EB"/>
          <div style="font-size:12px;margin-bottom:3px">
            <span style="color:#6B7280">${ar ? "آخر تحديث:" : "Last update:"}</span>
            <strong style="margin-inline-start:4px">${fmtDateTime(loc.recorded_at)}</strong>
          </div>
          ${loc.speed != null ? `<div style="font-size:12px;margin-bottom:3px"><span style="color:#6B7280">${ar ? "السرعة:" : "Speed:"}</span> <strong>${loc.speed} km/h</strong></div>` : ""}
          ${loc.battery_level != null ? `<div style="font-size:12px;margin-bottom:3px"><span style="color:#6B7280">${ar ? "البطارية:" : "Battery:"}</span> <strong>${loc.battery_level}%</strong></div>` : ""}
          <div style="font-size:12px">
            <span style="background:${loc.is_moving ? "#D1FAE5" : "#F3F4F6"};color:${loc.is_moving ? "#059669" : "#6B7280"};padding:2px 8px;border-radius:20px;font-weight:600">
              ${loc.is_moving ? (ar ? "متحرك" : "Moving") : (ar ? "ثابت" : "Stationary")}
            </span>
          </div>
        </div>`;

      if (markersRef.current[loc.rep_id]) {
        markersRef.current[loc.rep_id]
          .setLatLng([loc.latitude, loc.longitude])
          .setPopupContent(popupContent);
      } else {
        const marker = L.marker([loc.latitude, loc.longitude], { icon })
          .addTo(map)
          .bindPopup(popupContent);
        markersRef.current[loc.rep_id] = marker;
      }
    });
  }, [locations, filterRep, ar]);

  /* ── جلب أولي + تحديث دوري كل 30 ثانية ────────────────────────── */
  useEffect(() => {
    fetchLocations();
    const id = setInterval(fetchLocations, 30_000);
    return () => clearInterval(id);
  }, [fetchLocations]);

  /* ── تحريك الخريطة نحو المندوب المختار ─────────────────────────── */
  useEffect(() => {
    if (!selectedRep || !leafletMap.current) return;
    const { map } = leafletMap.current;
    map.flyTo([selectedRep.latitude, selectedRep.longitude], 15, { duration: 1 });
    markersRef.current[selectedRep.rep_id]?.openPopup();
  }, [selectedRep]);

  /* ── Leaflet CSS ────────────────────────────────────────────────── */
  useEffect(() => {
    const id = "leaflet-css";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
  }, []);

  /* ── المناديب والمشرفون المعروضون ──────────────────────────────── */
  const visibleLocations = filterRep === "all"
    ? (filterType === "all" ? locations : locations.filter(l => (l.person_type ?? "rep") === filterType))
    : locations.filter(l => l.rep_id === filterRep);

  /* ================================================================ */
  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reps/manage`}>{ar ? "المناديب" : "Sales Reps"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "خريطة المناديب" : "Reps Map"}</span>
          </div>
          <h1 className="page-title">{ar ? "خريطة المناديب الحية" : "Live Reps Map"}</h1>
          {lastUpdate && (
            <p className="page-subtitle">
              {ar ? "آخر تحديث:" : "Last update:"}{" "}
              {lastUpdate.toLocaleTimeString("en-US")}
              {" · "}
              {ar ? "يتجدد كل 30 ثانية" : "Refreshes every 30s"}
            </p>
          )}
        </div>

        {/* فلاتر */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>

          {/* فلتر النوع: الكل / مناديب / مشرفون */}
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
            {(["all", "rep", "supervisor"] as const).map(t => (
              <button
                key={t}
                onClick={() => { setFilterType(t); setFilterRep("all"); }}
                style={{
                  padding: "6px 12px", fontSize: 12, fontWeight: 600,
                  background: filterType === t ? "var(--primary)" : "var(--surface)",
                  color: filterType === t ? "white" : "var(--text-muted)",
                  border: "none", cursor: "pointer",
                }}
              >
                {t === "all" ? (ar ? "الكل" : "All") : t === "rep" ? (ar ? "مناديب" : "Reps") : (ar ? "مشرفون" : "Supervisors")}
              </button>
            ))}
          </div>

          {/* فلتر شخص محدد */}
          <select
            className="form-input"
            style={{ minWidth: 180 }}
            value={filterRep}
            onChange={e => setFilterRep(e.target.value)}
          >
            <option value="all">{ar ? "— جميع —" : "— All —"}</option>
            {(filterType === "all" || filterType === "rep") && allReps.length > 0 && (
              <optgroup label={ar ? "المناديب" : "Reps"}>
                {allReps.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name} ({r.rep_code})
                  </option>
                ))}
              </optgroup>
            )}
            {(filterType === "all" || filterType === "supervisor") && allSupervisors.length > 0 && (
              <optgroup label={ar ? "المشرفون" : "Supervisors"}>
                {allSupervisors.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    ★ {s.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <button
            className="btn btn-secondary"
            onClick={fetchLocations}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {ar ? "تحديث" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Layout: موبايل = قائمة أفقية فوق + خريطة تحت / ديسك = جانبي */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "calc(100vh - 180px)", minHeight: 520 }}>

        {/* قائمة المناديب — أفقية قابلة للـ scroll */}
        <div style={{
          display: "flex", gap: 10, overflowX: "auto", overflowY: "hidden",
          padding: "4px 2px 8px",
          scrollbarWidth: "none",
          flexShrink: 0,
        }}>
          {loading && (
            <div style={{ padding: "12px 16px", background: "var(--surface)", borderRadius: 12,
              border: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {ar ? "جاري التحميل..." : "Loading..."}
            </div>
          )}

          {!loading && visibleLocations.length === 0 && (
            <div style={{ padding: "12px 20px", background: "var(--surface)", borderRadius: 12,
              border: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)",
              display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {ar ? "لا توجد مواقع مسجّلة" : "No locations recorded"}
            </div>
          )}

          {visibleLocations.map((loc) => {
            const isSup = loc.person_type === "supervisor";
            const color = isSup
              ? SUPERVISOR_COLOR
              : PIN_COLORS[loc.rep_id.charCodeAt(0) % PIN_COLORS.length];
            const isSelected = selectedRep?.rep_id === loc.rep_id;
            return (
              <div
                key={loc.rep_id}
                onClick={() => setSelectedRep(isSelected ? null : loc)}
                style={{
                  flexShrink: 0, width: 160, background: "var(--surface)",
                  borderRadius: 14, padding: "12px 14px", cursor: "pointer",
                  border: isSelected ? `2px solid ${color}` : "1px solid var(--border)",
                  transition: "all 0.15s", boxShadow: isSelected ? `0 4px 12px ${color}30` : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 32, height: 32,
                    borderRadius: isSup ? "6px" : "50%",
                    flexShrink: 0,
                    background: color, color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800,
                    boxShadow: loc.is_moving ? `0 0 0 3px ${color}40` : "none",
                    transform: isSup ? "rotate(45deg)" : "none",
                  }}>
                    <span style={{ transform: isSup ? "rotate(-45deg)" : "none" }}>
                      {isSup ? "★" : loc.rep_name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {loc.rep_name}
                    </div>
                    <div style={{ fontSize: 10, color: isSup ? SUPERVISOR_COLOR : "var(--text-muted)", fontWeight: isSup ? 700 : 400 }}>
                      {isSup ? (ar ? "مشرف" : "Supervisor") : loc.rep_code}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20,
                    background: loc.is_moving ? "#D1FAE5" : "#F3F4F6",
                    color: loc.is_moving ? "#059669" : "#6B7280",
                  }}>
                    {loc.is_moving ? (ar ? "متحرك" : "Moving") : (ar ? "ثابت" : "Still")}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {fmtTime(loc.recorded_at)}
                  </span>
                </div>
                {loc.battery_level != null && (
                  <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2"/></svg>
                    {loc.battery_level}%
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* الخريطة — تملأ باقي المساحة */}
        <div style={{ flex: 1, borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", position: "relative", minHeight: 300 }}>
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

          {/* عدّاد المناديب */}
          <div style={{
            position: "absolute", top: 10, right: 10, zIndex: 1000,
            background: "white", borderRadius: 8, padding: "5px 12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)", fontSize: 12, fontWeight: 600,
          }}>
            {visibleLocations.length} {ar ? "مندوب" : "reps"}
          </div>
        </div>
      </div>
    </>
  );
}
