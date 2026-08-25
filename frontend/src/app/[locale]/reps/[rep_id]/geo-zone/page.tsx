"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getRep, getRepGeoZone, saveRepGeoZone } from "@/lib/reps";

type Point = { lat: number; lng: number };
type BoundaryType = "circle" | "polygon";

export default function RepGeoZonePage(props: { params: Promise<{ locale: string; rep_id: string }> }) {
  const { locale, rep_id: repId } = use(props.params);
  const ar = locale === "ar";
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const boundaryTypeRef = useRef<BoundaryType>("circle");
  const shapeRef = useRef<any>(null);
  const [rep, setRep] = useState<any>(null);
  const [boundaryType, setBoundaryType] = useState<BoundaryType>("circle");
  const [name, setName] = useState(ar ? "منطقة عمل المندوب" : "Rep work zone");
  const [center, setCenter] = useState<Point | null>(null);
  const [radius, setRadius] = useState("1000");
  const [points, setPoints] = useState<Point[]>([]);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    boundaryTypeRef.current = boundaryType;
  }, [boundaryType]);

  useEffect(() => {
    Promise.all([
      getRep(repId).catch(() => ({ data: null })),
      getRepGeoZone(repId).catch(() => ({ data: null })),
    ]).then(([repResponse, zoneResponse]) => {
      setRep(repResponse.data);
      const zone = zoneResponse.data;
      if (zone) {
        setBoundaryType(zone.boundary_type === "polygon" ? "polygon" : "circle");
        setName(zone.name || (ar ? "منطقة عمل المندوب" : "Rep work zone"));
        setActive(zone.is_active !== false);
        if (zone.center_latitude != null && zone.center_longitude != null) {
          setCenter({ lat: Number(zone.center_latitude), lng: Number(zone.center_longitude) });
        }
        if (zone.radius_meters != null) setRadius(String(Math.round(Number(zone.radius_meters))));
        if (Array.isArray(zone.polygon)) setPoints(zone.polygon.map((point: any) => ({ lat: Number(point.lat), lng: Number(point.lng) })));
      }
    }).finally(() => setLoading(false));
  }, [repId, ar]);

  useEffect(() => {
    let cancelled = false;
    const initialise = async () => {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: true }).setView([24.7136, 46.6753], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      map.on("click", (event: any) => {
        const point = { lat: Number(event.latlng.lat.toFixed(7)), lng: Number(event.latlng.lng.toFixed(7)) };
        if (boundaryTypeRef.current === "circle") setCenter(point);
        else setPoints((current) => [...current, point]);
      });
      mapRef.current = { map, L };
    };
    void initialise();
    return () => {
      cancelled = true;
      if (mapRef.current?.map) {
        mapRef.current.map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const stored = mapRef.current;
    if (!stored) return;
    const { map, L } = stored;
    if (shapeRef.current) {
      shapeRef.current.forEach((layer: any) => { try { layer.remove(); } catch {} });
      shapeRef.current = null;
    }
    const layers: any[] = [];
    if (boundaryType === "circle" && center) {
      const circle = L.circle([center.lat, center.lng], {
        radius: Math.max(10, Number(radius) || 10), color: "#3E0865", fillColor: "#8D4BB5", fillOpacity: 0.18, weight: 2,
      }).addTo(map);
      const marker = L.marker([center.lat, center.lng]).bindTooltip(ar ? "مركز المنطقة" : "Zone center").addTo(map);
      layers.push(circle, marker);
      map.setView([center.lat, center.lng], Math.max(map.getZoom(), 14));
    }
    if (boundaryType === "polygon" && points.length) {
      points.forEach((point, index) => {
        const marker = L.circleMarker([point.lat, point.lng], { radius: 5, color: "#3E0865", fillColor: "#fff", fillOpacity: 1, weight: 2 }).bindTooltip(`${ar ? "نقطة" : "Point"} ${index + 1}`).addTo(map);
        layers.push(marker);
      });
      if (points.length >= 2) {
        const polygon = L.polygon(points.map((point) => [point.lat, point.lng]), { color: "#3E0865", fillColor: "#8D4BB5", fillOpacity: 0.18, weight: 2 }).addTo(map);
        layers.push(polygon);
      }
      if (points.length >= 1) map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 14));
    }
    shapeRef.current = layers;
  }, [boundaryType, center, radius, points, ar]);

  const resetBoundary = () => {
    setCenter(null);
    setPoints([]);
    setSuccess("");
  };

  const save = async () => {
    setError("");
    setSuccess("");
    const payload: any = { name, boundary_type: boundaryType, is_active: active };
    if (boundaryType === "circle") {
      if (!center) return setError(ar ? "اضغط على الخريطة لتحديد مركز المنطقة أولًا." : "Click the map to select the zone center first.");
      payload.center_latitude = center.lat;
      payload.center_longitude = center.lng;
      payload.radius_meters = Number(radius);
    } else {
      if (points.length < 3) return setError(ar ? "أضف ثلاث نقاط على الأقل لرسم حدود المنطقة." : "Add at least three points to draw the zone.");
      payload.polygon = points;
    }
    setSaving(true);
    try {
      await saveRepGeoZone(repId, payload);
      setSuccess(ar ? "تم حفظ حدود منطقة العمل. يبدأ التحقق عند وصول الموقع التالي للمندوب." : "Work-zone boundary saved. Checking starts with the rep's next location update.");
    } catch (err: any) {
      setError(err?.response?.data?.detail || (ar ? "تعذر حفظ حدود المنطقة." : "Could not save work-zone boundary."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reps/manage`}>{ar ? "المناديب" : "Sales reps"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/reps/${repId}`}>{rep?.full_name || (ar ? "تفاصيل المندوب" : "Rep details")}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "منطقة العمل" : "Work zone"}</span>
          </div>
          <h1 className="page-title">{ar ? "تحديد منطقة عمل المندوب" : "Set rep work zone"}</h1>
          <p className="page-subtitle">{ar ? "ارسم الحد على الخريطة. التتبع الحالي سيبقى كما هو، وتُسجّل فقط أحداث الدخول والخروج عند انتقال حقيقي." : "Draw the boundary on the map. Tracking remains unchanged; only real entry and exit transitions are recorded."}</p>
        </div>
        <Link className="btn btn-secondary" href={`/${locale}/reps/${repId}`}>{ar ? "عودة للتفاصيل" : "Back to details"}</Link>
      </div>

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B42318", padding: "10px 14px", borderRadius: 4, marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ background: "#F4EFF7", border: "1px solid #D9C5E5", color: "#3E0865", padding: "10px 14px", borderRadius: 4, marginBottom: 12 }}>{success}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) minmax(0, 1fr)", gap: 16 }} className="rep-zone-editor-grid">
        <div className="card">
          <div className="card-body" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontWeight: 800, color: "var(--text-primary)" }}>{loading ? (ar ? "جاري التحميل..." : "Loading...") : (rep?.full_name || "—")}</div>
            <label style={{ display: "grid", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
              {ar ? "اسم المنطقة" : "Zone name"}
              <input className="form-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} />
            </label>
            <label style={{ display: "grid", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
              {ar ? "شكل الحدود" : "Boundary type"}
              <select className="form-input form-select" value={boundaryType} onChange={(event) => { setBoundaryType(event.target.value as BoundaryType); resetBoundary(); }}>
                <option value="circle">{ar ? "دائرة حول نقطة" : "Circle around a point"}</option>
                <option value="polygon">{ar ? "مضلع مرسوم على الخريطة" : "Polygon drawn on the map"}</option>
              </select>
            </label>
            {boundaryType === "circle" ? (
              <>
                <label style={{ display: "grid", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                  {ar ? "نصف القطر بالمتر" : "Radius in meters"}
                  <input className="form-input" type="number" min="10" max="100000" value={radius} onChange={(event) => setRadius(event.target.value)} />
                </label>
                <div style={{ fontSize: 12, lineHeight: 1.65, background: "#F8F4FA", border: "1px solid #E3D6EA", padding: 10, borderRadius: 4 }}>{ar ? "اضغط مرة واحدة على الخريطة لتحديد مركز الدائرة." : "Click once on the map to set the circle center."}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, lineHeight: 1.65, background: "#F8F4FA", border: "1px solid #E3D6EA", padding: 10, borderRadius: 4 }}>{ar ? `اضغط على الخريطة لإضافة نقاط الحدود. النقاط الحالية: ${points.length}.` : `Click the map to add boundary points. Current points: ${points.length}.`}</div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPoints([])}>{ar ? "مسح نقاط المضلع" : "Clear polygon points"}</button>
              </>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              {ar ? "تفعيل تنبيه المنطقة لهذا المندوب" : "Enable zone alerts for this rep"}
            </label>
            <button className="btn btn-primary" type="button" disabled={saving} onClick={() => void save()}>{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ منطقة العمل" : "Save work zone")}</button>
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: "var(--text-muted)" }}>{ar ? "لا يرسل النظام تنبيهًا إلا عند انتقال المندوب فعليًا بين داخل وخارج الحدود؛ لذلك لا تتكرر التنبيهات مع كل تحديث موقع." : "The system alerts only on actual inside/outside transitions, not on every location update."}</p>
          </div>
        </div>
        <div className="card" style={{ overflow: "hidden", minHeight: 520 }}>
          <div ref={containerRef} style={{ height: 520, width: "100%" }} />
        </div>
      </div>
    </>
  );
}
