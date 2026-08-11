"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { getAllRepsLiveLocations, getReps, getSupervisors, getRepLocationHistory } from "@/lib/reps";

const PIN_COLORS = ["#2563EB","#059669","#DC2626","#D97706","#7C3AED","#0891B2","#BE185D","#15803D","#B45309","#4338CA"];
const SUPERVISOR_COLOR = "#6D28D9";

const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}); } catch { return "—"; } };
const fmtDateTime = (iso: string) => { try { return new Date(iso).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); } catch { return "—"; } };
const fmtDuration = (mins: number) => { const h = Math.floor(mins/60); const m = mins%60; return h>0 ? `${h}h ${m}m` : `${m}m`; };
const todayStr = () => new Date().toISOString().slice(0,10);
const dayLabel = (d: string) => { try { return new Date(d).toLocaleDateString("ar-SA",{weekday:"short",day:"numeric",month:"short"}); } catch { return d; } };

interface LiveLocation {
  rep_id: string; rep_code: string; rep_name: string;
  person_type?: "rep"|"supervisor";
  latitude: number; longitude: number;
  accuracy?: number; speed?: number; heading?: number;
  battery_level?: number; is_moving: boolean; recorded_at: string;
}
interface HistoryPoint {
  id: string; latitude: number; longitude: number;
  speed?: number; heading?: number; battery_level?: number;
  is_moving: boolean; recorded_at: string;
}
interface Trip { type:"move"|"stop"; start:string; end:string; durationMins:number; maxSpeed?:number; avgSpeed?:number; }

/** حساب الرحلات من سلسلة النقاط */
function buildTrips(pts: HistoryPoint[]): Trip[] {
  if (pts.length < 2) return [];
  const trips: Trip[] = [];
  let segStart = 0;
  for (let i = 1; i <= pts.length; i++) {
    const cur = pts[i] ?? null;
    const prev = pts[i-1];
    const type = prev.is_moving ? "move" : "stop";
    if (!cur || (cur.is_moving ? "move" : "stop") !== type) {
      const seg = pts.slice(segStart, i);
      const dMs = new Date(seg[seg.length-1].recorded_at).getTime() - new Date(seg[0].recorded_at).getTime();
      const dMins = Math.max(1, Math.round(dMs/60000));
      const speeds = seg.map(p => p.speed ?? 0).filter(s => s > 0);
      trips.push({
        type, start: seg[0].recorded_at, end: seg[seg.length-1].recorded_at,
        durationMins: dMins,
        maxSpeed: speeds.length ? Math.max(...speeds) : undefined,
        avgSpeed: speeds.length ? Math.round(speeds.reduce((a,b)=>a+b,0)/speeds.length) : undefined,
      });
      segStart = i;
    }
  }
  return trips;
}

export default function RepsTrackingPage({ params:{locale} }:{ params:{locale:string} }) {
  const ar = locale === "ar";
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<Record<string,any>>({});

  const [locations, setLocations] = useState<LiveLocation[]>([]);
  const [allReps, setAllReps] = useState<any[]>([]);
  const [allSupervisors, setAllSupervisors] = useState<any[]>([]);
  const [filterRep, setFilterRep] = useState("all");
  const [filterType, setFilterType] = useState<"all"|"rep"|"supervisor">("all");
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date|null>(null);

  // Panel state
  const [panel, setPanel] = useState<LiveLocation|null>(null);
  const [tripDate, setTripDate] = useState(todayStr());
  const [tripHistory, setTripHistory] = useState<HistoryPoint[]>([]);
  const [tripLoading, setTripLoading] = useState(false);
  const [showTrips, setShowTrips] = useState(false);

  const fetchLocations = useCallback(async () => {
    try { const res = await getAllRepsLiveLocations(); setLocations(Array.isArray(res.data)?res.data:[]); setLastUpdate(new Date()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    getReps().then(r=>setAllReps(Array.isArray(r.data)?r.data:[])).catch(()=>{});
    getSupervisors().then(r=>setAllSupervisors(Array.isArray(r.data)?r.data:[])).catch(()=>{});
  }, []);

  // جلب تاريخ الرحلات عند اختيار مندوب أو تغيير التاريخ
  useEffect(() => {
    if (!panel) return;
    setTripLoading(true);
    setTripHistory([]);
    getRepLocationHistory(panel.rep_id, tripDate)
      .then(r => setTripHistory(Array.isArray(r.data)?r.data:[]))
      .catch(()=>setTripHistory([]))
      .finally(()=>setTripLoading(false));
  }, [panel, tripDate]);

  // تهيئة الخريطة
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    import("leaflet").then(L => {
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      const map = L.map(mapRef.current!,{center:[24.7136,46.6753],zoom:11});
      L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ar",{attribution:"Google Maps",maxZoom:19}).addTo(map);
      leafletMap.current = {map,L};
    });
    return () => { leafletMap.current?.map.remove(); leafletMap.current=null; };
  }, []);

  // رسم الدبابيس
  useEffect(() => {
    if (!leafletMap.current) return;
    const {map,L} = leafletMap.current;
    const visible = filterRep==="all"
      ? (filterType==="all" ? locations : locations.filter(l=>(l.person_type??"rep")===filterType))
      : locations.filter(l=>l.rep_id===filterRep);
    const visibleIds = new Set(visible.map(l=>l.rep_id));
    Object.keys(markersRef.current).forEach(rid=>{ if(!visibleIds.has(rid)){markersRef.current[rid].remove();delete markersRef.current[rid];} });

    visible.forEach(loc => {
      const isSup = loc.person_type==="supervisor";
      const color = isSup ? SUPERVISOR_COLOR : PIN_COLORS[loc.rep_id.charCodeAt(0)%PIN_COLORS.length];
      const spd = loc.speed != null ? Math.round(loc.speed as number) : null;

      // أيقونة سيارة صغيرة للمندوب، نجمة للمشرف
      const iconHtml = isSup
        ? `<div style="background:${color};color:white;border-radius:5px;transform:rotate(45deg);width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:2px solid white;font-size:9px;font-weight:800"><span style="transform:rotate(-45deg)">★</span></div>`
        : `<div style="position:relative;display:flex;align-items:center;justify-content:center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">
              <rect x="3" y="8" width="18" height="9" rx="2.5" fill="${color}"/>
              <rect x="5" y="5" width="14" height="6" rx="2" fill="${color}" opacity=".85"/>
              <circle cx="7" cy="17.5" r="2" fill="white" stroke="${color}" stroke-width="1"/>
              <circle cx="17" cy="17.5" r="2" fill="white" stroke="${color}" stroke-width="1"/>
              ${spd!=null && spd>0 ? `<rect x="7" y="9" width="10" height="4" rx="1" fill="white" opacity=".25"/>` : ""}
            </svg>
            ${spd!=null && spd>0 ? `<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:${color};color:white;font-size:9px;font-weight:800;padding:1px 4px;border-radius:8px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3)">${spd}</div>` : ""}
          </div>`;

      const icon = L.divIcon({html:iconHtml,iconSize:[28,28],iconAnchor:[14,14],popupAnchor:[0,-16],className:""});
      const onClick = () => { setPanel(loc); setShowTrips(false); setTripDate(todayStr()); };

      if (markersRef.current[loc.rep_id]) {
        markersRef.current[loc.rep_id].setLatLng([loc.latitude,loc.longitude]).setIcon(icon);
      } else {
        const m = L.marker([loc.latitude,loc.longitude],{icon}).addTo(map);
        m.on("click", onClick);
        markersRef.current[loc.rep_id] = m;
      }
    });
  }, [locations,filterRep,filterType,ar]);

  useEffect(() => { fetchLocations(); const id=setInterval(fetchLocations,30_000); return()=>clearInterval(id); }, [fetchLocations]);

  // Leaflet CSS
  useEffect(() => {
    const id="leaflet-css";
    if (!document.getElementById(id)) {
      const l=document.createElement("link");l.id=id;l.rel="stylesheet";
      l.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(l);
    }
  }, []);

  useEffect(() => {
    if (!panel || !leafletMap.current) return;
    const {map} = leafletMap.current;
    map.flyTo([panel.latitude,panel.longitude],16,{duration:0.8});
  }, [panel]);

  const visibleLocations = filterRep==="all"
    ? (filterType==="all" ? locations : locations.filter(l=>(l.person_type??"rep")===filterType))
    : locations.filter(l=>l.rep_id===filterRep);

  const trips = buildTrips(tripHistory);
  const totalMove = trips.filter(t=>t.type==="move").reduce((a,t)=>a+t.durationMins,0);
  const totalStop = trips.filter(t=>t.type==="stop").reduce((a,t)=>a+t.durationMins,0);
  const maxSpd = trips.filter(t=>t.maxSpeed).reduce((a,t)=>Math.max(a,t.maxSpeed??0),0);

  const panelColor = panel ? (panel.person_type==="supervisor" ? SUPERVISOR_COLOR : PIN_COLORS[panel.rep_id.charCodeAt(0)%PIN_COLORS.length]) : "#2563EB";

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reps/manage`}>{ar?"المناديب":"Sales Reps"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar?"خريطة التتبع":"Live Tracking"}</span>
          </div>
          <h1 className="page-title">{ar?"خريطة المناديب الحية":"Live Reps Map"}</h1>
          {lastUpdate && <p className="page-subtitle">{ar?"آخر تحديث:":"Last update:"} {lastUpdate.toLocaleTimeString("en-US")} · {ar?"يتجدد كل 30 ث":"Refreshes every 30s"}</p>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:"1px solid var(--border)"}}>
            {(["all","rep","supervisor"] as const).map(t=>(
              <button key={t} onClick={()=>{setFilterType(t);setFilterRep("all");}} style={{padding:"6px 12px",fontSize:12,fontWeight:600,background:filterType===t?"var(--primary)":"var(--surface)",color:filterType===t?"white":"var(--text-muted)",border:"none",cursor:"pointer"}}>
                {t==="all"?(ar?"الكل":"All"):t==="rep"?(ar?"مناديب":"Reps"):(ar?"مشرفون":"Supervisors")}
              </button>
            ))}
          </div>
          <select className="form-input" style={{minWidth:180}} value={filterRep} onChange={e=>setFilterRep(e.target.value)}>
            <option value="all">{ar?"— جميع —":"— All —"}</option>
            {(filterType==="all"||filterType==="rep") && allReps.length>0 && (
              <optgroup label={ar?"المناديب":"Reps"}>
                {allReps.map((r:any)=><option key={r.id} value={r.id}>{r.full_name} ({r.rep_code})</option>)}
              </optgroup>
            )}
            {(filterType==="all"||filterType==="supervisor") && allSupervisors.length>0 && (
              <optgroup label={ar?"المشرفون":"Supervisors"}>
                {allSupervisors.map((s:any)=><option key={s.id} value={s.id}>★ {s.name}</option>)}
              </optgroup>
            )}
          </select>
          <button className="btn btn-secondary" onClick={fetchLocations} style={{display:"flex",alignItems:"center",gap:6}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            {ar?"تحديث":"Refresh"}
          </button>
        </div>
      </div>

      <div style={{display:"flex",gap:12,height:"calc(100vh - 175px)",minHeight:540}}>
        {/* الخريطة */}
        <div style={{flex:1,borderRadius:16,overflow:"hidden",border:"1px solid var(--border)",position:"relative",minHeight:300}}>
          <div ref={mapRef} style={{width:"100%",height:"100%"}}/>
          <div style={{position:"absolute",top:10,right:10,zIndex:1000,background:"white",borderRadius:8,padding:"5px 12px",boxShadow:"0 2px 8px rgba(0,0,0,0.15)",fontSize:12,fontWeight:600}}>
            {visibleLocations.length} {ar?"نشط":"active"}
          </div>
          {/* شريط المناديب الأفقي */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:1000,display:"flex",gap:8,overflowX:"auto",padding:"8px 10px",background:"linear-gradient(transparent,rgba(0,0,0,0.18))",scrollbarWidth:"none"}}>
            {!loading && visibleLocations.length===0 && <div style={{background:"white",borderRadius:10,padding:"8px 14px",fontSize:12,color:"#6B7280"}}>{ar?"لا توجد مواقع مسجّلة":"No locations"}</div>}
            {visibleLocations.map(loc=>{
              const isSup=loc.person_type==="supervisor";
              const color=isSup?SUPERVISOR_COLOR:PIN_COLORS[loc.rep_id.charCodeAt(0)%PIN_COLORS.length];
              const isSelected=panel?.rep_id===loc.rep_id;
              return (
                <div key={loc.rep_id} onClick={()=>{setPanel(isSelected?null:loc);setShowTrips(false);setTripDate(todayStr());}} style={{flexShrink:0,background:isSelected?color:"white",borderRadius:12,padding:"8px 12px",cursor:"pointer",border:`2px solid ${isSelected?color:color+"40"}`,minWidth:130,transition:"all 0.15s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <span style={{fontSize:16}}>{isSup?"★":"🚗"}</span>
                    <div style={{fontWeight:700,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:isSelected?"white":color}}>{loc.rep_name}</div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:20,background:loc.is_moving?"#D1FAE5":"#F3F4F6",color:loc.is_moving?"#059669":"#6B7280"}}>{loc.is_moving?(ar?"متحرك":"Moving"):(ar?"ثابت":"Still")}</span>
                    <span style={{fontSize:10,color:isSelected?"rgba(255,255,255,0.8)":"#9CA3AF"}}>{fmtTime(loc.recorded_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel التفصيل */}
        {panel && (
          <div style={{width:320,background:"var(--surface)",borderRadius:16,border:"1px solid var(--border)",display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0}}>
            {/* Header */}
            <div style={{background:panelColor,padding:"14px 16px",color:"white",position:"relative"}}>
              <button onClick={()=>setPanel(null)} style={{position:"absolute",top:10,left:10,background:"rgba(255,255,255,0.2)",border:"none",borderRadius:6,color:"white",cursor:"pointer",padding:"2px 7px",fontSize:16}}>✕</button>
              <div style={{display:"flex",alignItems:"center",gap:10,marginTop:4}}>
                <div style={{fontSize:28}}>{panel.person_type==="supervisor"?"★":"🚗"}</div>
                <div>
                  <div style={{fontWeight:800,fontSize:15}}>{panel.rep_name}</div>
                  <div style={{fontSize:11,opacity:0.85}}>{panel.rep_code!=="SUP"?panel.rep_code:""} {panel.person_type==="supervisor"?(ar?"مشرف":"Supervisor"):(ar?"مندوب":"Rep")}</div>
                </div>
              </div>
            </div>

            {/* بيانات لحظية */}
            <div style={{padding:"12px 14px",borderBottom:"1px solid var(--border)"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                <div style={{background:"var(--bg)",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:800,color:panelColor}}>{panel.speed!=null?Math.round(panel.speed as number):0}</div>
                  <div style={{fontSize:10,color:"var(--text-muted)"}}>{ar?"السرعة km/h":"Speed km/h"}</div>
                </div>
                <div style={{background:"var(--bg)",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:800,color:panel.battery_level!=null&&panel.battery_level<20?"#EF4444":"#059669"}}>{panel.battery_level??"-"}%</div>
                  <div style={{fontSize:10,color:"var(--text-muted)"}}>{ar?"البطارية":"Battery"}</div>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:panel.is_moving?"#D1FAE5":"#F3F4F6",color:panel.is_moving?"#059669":"#6B7280"}}>
                  {panel.is_moving?(ar?"🚀 متحرك":"🚀 Moving"):(ar?"⏸ ثابت":"⏸ Still")}
                </span>
                <span style={{fontSize:10,color:"var(--text-muted)"}}>{fmtDateTime(panel.recorded_at)}</span>
              </div>
            </div>

            {/* تبويب الرحلات */}
            <div style={{padding:"10px 14px",borderBottom:"1px solid var(--border)",display:"flex",gap:6,alignItems:"center"}}>
              <button onClick={()=>setShowTrips(!showTrips)} style={{flex:1,padding:"6px 10px",borderRadius:8,border:`1px solid ${panelColor}`,background:showTrips?panelColor:"transparent",color:showTrips?"white":panelColor,fontWeight:600,fontSize:12,cursor:"pointer"}}>
                📍 {ar?"تفصيل الرحلات":"Trip Details"}
              </button>
              {showTrips && (
                <input type="date" value={tripDate} onChange={e=>setTripDate(e.target.value)}
                  style={{padding:"5px 8px",borderRadius:8,border:"1px solid var(--border)",fontSize:11,background:"var(--bg)",color:"var(--text)"}}/>
              )}
            </div>

            {/* محتوى الرحلات */}
            {showTrips && (
              <div style={{flex:1,overflowY:"auto",padding:"10px 14px"}}>
                {tripLoading && <div style={{textAlign:"center",padding:20,color:"var(--text-muted)",fontSize:13}}>{ar?"جاري التحميل...":"Loading..."}</div>}
                {!tripLoading && trips.length===0 && <div style={{textAlign:"center",padding:20,color:"var(--text-muted)",fontSize:12}}>{ar?"لا توجد بيانات لهذا اليوم":"No data for this day"}</div>}
                {!tripLoading && trips.length>0 && (
                  <>
                    {/* ملخص اليوم */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:12}}>
                      <div style={{background:"#DBEAFE",borderRadius:10,padding:"7px 8px",textAlign:"center"}}>
                        <div style={{fontWeight:800,fontSize:13,color:"#1D4ED8"}}>{fmtDuration(totalMove)}</div>
                        <div style={{fontSize:9,color:"#1D4ED8"}}>{ar?"حركة":"Moving"}</div>
                      </div>
                      <div style={{background:"#FEF3C7",borderRadius:10,padding:"7px 8px",textAlign:"center"}}>
                        <div style={{fontWeight:800,fontSize:13,color:"#B45309"}}>{fmtDuration(totalStop)}</div>
                        <div style={{fontSize:9,color:"#B45309"}}>{ar?"توقف":"Stopped"}</div>
                      </div>
                      <div style={{background:"#D1FAE5",borderRadius:10,padding:"7px 8px",textAlign:"center"}}>
                        <div style={{fontWeight:800,fontSize:13,color:"#059669"}}>{maxSpd>0?maxSpd:"-"}</div>
                        <div style={{fontSize:9,color:"#059669"}}>{ar?"أعلى سرعة":"Max km/h"}</div>
                      </div>
                    </div>
                    {/* قائمة الرحلات */}
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {trips.map((t,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 10px",background:"var(--bg)",borderRadius:10,borderLeft:`3px solid ${t.type==="move"?"#2563EB":"#D97706"}`}}>
                          <span style={{fontSize:16,marginTop:1}}>{t.type==="move"?"🚗":"⏸"}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                              <span style={{fontWeight:700,fontSize:12,color:t.type==="move"?"#2563EB":"#D97706"}}>
                                {t.type==="move"?(ar?"تحرك":"Moving"):(ar?"توقف":"Stop")}
                              </span>
                              <span style={{fontSize:11,fontWeight:700,color:"var(--text)"}}>{fmtDuration(t.durationMins)}</span>
                            </div>
                            <div style={{fontSize:10,color:"var(--text-muted)"}}>{fmtTime(t.start)} → {fmtTime(t.end)}</div>
                            {t.type==="move" && t.avgSpeed && (
                              <div style={{fontSize:10,color:"var(--text-muted)",marginTop:2}}>
                                {ar?"متوسط:":"Avg:"} {t.avgSpeed} · {ar?"أعلى:":"Max:"} {t.maxSpeed} km/h
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
