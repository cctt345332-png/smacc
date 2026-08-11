"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { getAllRepsLiveLocations, getReps, getSupervisors, getRepLocationHistory } from "@/lib/reps";

const PIN_COLORS = ["#2563EB","#059669","#DC2626","#D97706","#7C3AED","#0891B2","#BE185D","#15803D","#B45309","#4338CA"];
const SUPERVISOR_COLOR = "#6D28D9";

const fmtTime = (iso:string) => { try { return new Date(iso).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}); } catch { return "—"; } };
const fmtDateTime = (iso:string) => { try { return new Date(iso).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); } catch { return "—"; } };
const fmtDur = (m:number) => { const h=Math.floor(m/60); return h>0?`${h}h ${m%60}m`:`${m}m`; };
const todayStr = () => new Date().toISOString().slice(0,10);

interface LiveLocation {
  rep_id:string; rep_code:string; rep_name:string;
  person_type?:"rep"|"supervisor";
  latitude:number; longitude:number;
  accuracy?:number; speed?:number; heading?:number;
  battery_level?:number; is_moving:boolean; recorded_at:string;
  vehicle_plate?:string;
}
interface HistoryPoint { latitude:number; longitude:number; speed?:number; is_moving:boolean; recorded_at:string; }
interface Trip { type:"move"|"stop"; start:string; end:string; dur:number; maxSpd?:number; avgSpd?:number; }

function buildTrips(pts:HistoryPoint[]):Trip[] {
  if (pts.length<2) return [];
  const trips:Trip[] = [];
  let s = 0;
  for (let i=1;i<=pts.length;i++) {
    const cur = pts[i]??null;
    const prev = pts[i-1];
    const type = prev.is_moving?"move":"stop";
    if (!cur||(cur.is_moving?"move":"stop")!==type) {
      const seg=pts.slice(s,i);
      const dur=Math.max(1,Math.round((new Date(seg[seg.length-1].recorded_at).getTime()-new Date(seg[0].recorded_at).getTime())/60000));
      const spds=seg.map(p=>p.speed??0).filter(v=>v>0);
      trips.push({type,start:seg[0].recorded_at,end:seg[seg.length-1].recorded_at,dur,
        maxSpd:spds.length?Math.round(Math.max(...spds)):undefined,
        avgSpd:spds.length?Math.round(spds.reduce((a,b)=>a+b,0)/spds.length):undefined});
      s=i;
    }
  }
  return trips;
}

export default function RepsTrackingPage({params:{locale}}:{params:{locale:string}}) {
  const ar = locale==="ar";
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

  // الكارد السريع (فوق الدبوس)
  const [quickCard, setQuickCard] = useState<LiveLocation|null>(null);
  // شريط الرحلات الجانبي
  const [tripPanel, setTripPanel] = useState<LiveLocation|null>(null);
  const [tripDate, setTripDate] = useState(todayStr());
  const [tripHistory, setTripHistory] = useState<HistoryPoint[]>([]);
  const [tripLoading, setTripLoading] = useState(false);

  const fetchLocations = useCallback(async () => {
    try { const r=await getAllRepsLiveLocations(); setLocations(Array.isArray(r.data)?r.data:[]); setLastUpdate(new Date()); }
    catch {} finally { setLoading(false); }
  },[]);

  useEffect(()=>{
    getReps().then(r=>setAllReps(Array.isArray(r.data)?r.data:[])).catch(()=>{});
    getSupervisors().then(r=>setAllSupervisors(Array.isArray(r.data)?r.data:[])).catch(()=>{});
  },[]);

  // جلب تاريخ الرحلات
  useEffect(()=>{
    if (!tripPanel) return;
    setTripLoading(true); setTripHistory([]);
    getRepLocationHistory(tripPanel.rep_id, tripDate)
      .then(r=>setTripHistory(Array.isArray(r.data)?r.data:[]))
      .catch(()=>setTripHistory([]))
      .finally(()=>setTripLoading(false));
  },[tripPanel,tripDate]);

  // إغلاق الكارد عند الضغط خارجه
  useEffect(()=>{
    if (!quickCard) return;
    const close=()=>setQuickCard(null);
    setTimeout(()=>document.addEventListener("click",close),100);
    return ()=>document.removeEventListener("click",close);
  },[quickCard]);

  // تهيئة الخريطة
  useEffect(()=>{
    if (!mapRef.current||leafletMap.current) return;
    import("leaflet").then(L=>{
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      const map=L.map(mapRef.current!,{center:[24.7136,46.6753],zoom:11});
      L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ar",{attribution:"Google Maps",maxZoom:19}).addTo(map);
      leafletMap.current={map,L};
    });
    return ()=>{ leafletMap.current?.map.remove(); leafletMap.current=null; };
  },[]);

  // Leaflet CSS
  useEffect(()=>{
    const id="leaflet-css";
    if (!document.getElementById(id)){
      const l=document.createElement("link");l.id=id;l.rel="stylesheet";
      l.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(l);
    }
  },[]);

  // رسم الدبابيس
  useEffect(()=>{
    if (!leafletMap.current) return;
    const {map,L}=leafletMap.current;
    const visible = filterRep==="all"
      ? (filterType==="all"?locations:locations.filter(l=>(l.person_type??"rep")===filterType))
      : locations.filter(l=>l.rep_id===filterRep);
    const visIds=new Set(visible.map(l=>l.rep_id));
    Object.keys(markersRef.current).forEach(rid=>{ if(!visIds.has(rid)){markersRef.current[rid].remove();delete markersRef.current[rid];} });

    visible.forEach(loc=>{
      const isSup=loc.person_type==="supervisor";
      const color=isSup?SUPERVISOR_COLOR:PIN_COLORS[loc.rep_id.charCodeAt(0)%PIN_COLORS.length];
      const spd=loc.speed!=null?Math.round(loc.speed as number):null;

      // أيقونة سيارة 3D من الأعلى (top-view) للمندوب
      const carSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="48" viewBox="0 0 32 48">
        <defs>
          <linearGradient id="cg${loc.rep_id.slice(0,4)}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color};stop-opacity:1"/>
            <stop offset="100%" style="stop-color:${color}cc;stop-opacity:1"/>
          </linearGradient>
          <filter id="cs${loc.rep_id.slice(0,4)}">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.4)"/>
          </filter>
        </defs>
        <!-- جسم السيارة -->
        <g filter="url(#cs${loc.rep_id.slice(0,4)})">
          <!-- الهيكل الخارجي -->
          <path d="M6,38 C4,38 3,36 3,34 L3,20 C3,17 4,15 6,14 L8,13 L9,8 C9.5,6 11,5 13,5 L19,5 C21,5 22.5,6 23,8 L24,13 L26,14 C28,15 29,17 29,20 L29,34 C29,36 28,38 26,38 L24,39 L24,41 C24,42.5 23,43 22,43 L10,43 C9,43 8,42.5 8,41 L8,39 Z" fill="url(#cg${loc.rep_id.slice(0,4)})"/>
          <!-- سقف السيارة (كابينة) -->
          <path d="M10,13 L10,22 C10,23 11,24 12,24 L20,24 C21,24 22,23 22,22 L22,13 C22,12 21.5,11 21,10.5 L19,9 L13,9 L11,10.5 C10.5,11 10,12 10,13 Z" fill="white" opacity="0.15"/>
          <!-- الزجاج الأمامي -->
          <path d="M11,13.5 L11,20 C11,20.8 11.5,21.5 12.5,21.5 L19.5,21.5 C20.5,21.5 21,20.8 21,20 L21,13.5 C21,12.8 20.5,12 20,11.5 L18.5,10.5 L13.5,10.5 L12,11.5 C11.5,12 11,12.8 11,13.5 Z" fill="white" opacity="0.25"/>
          <!-- خط وسط السيارة -->
          <line x1="16" y1="5" x2="16" y2="43" stroke="white" stroke-width="0.5" opacity="0.2"/>
          <!-- إطار أمامي أيسر -->
          <ellipse cx="8" cy="38" rx="3.5" ry="3" fill="#111" opacity="0.9"/>
          <ellipse cx="8" cy="38" rx="2" ry="1.8" fill="#333"/>
          <ellipse cx="8" cy="38" rx="1" ry="0.9" fill="#555"/>
          <!-- إطار أمامي أيمن -->
          <ellipse cx="24" cy="38" rx="3.5" ry="3" fill="#111" opacity="0.9"/>
          <ellipse cx="24" cy="38" rx="2" ry="1.8" fill="#333"/>
          <ellipse cx="24" cy="38" rx="1" ry="0.9" fill="#555"/>
          <!-- إطار خلفي أيسر -->
          <ellipse cx="7" cy="14" rx="3" ry="3.5" fill="#111" opacity="0.9"/>
          <ellipse cx="7" cy="14" rx="1.8" ry="2" fill="#333"/>
          <ellipse cx="7" cy="14" rx="0.9" ry="1" fill="#555"/>
          <!-- إطار خلفي أيمن -->
          <ellipse cx="25" cy="14" rx="3" ry="3.5" fill="#111" opacity="0.9"/>
          <ellipse cx="25" cy="14" rx="1.8" ry="2" fill="#333"/>
          <ellipse cx="25" cy="14" rx="0.9" ry="1" fill="#555"/>
          <!-- مصابيح أمامية -->
          <rect x="4" y="37.5" width="5" height="1.5" rx="0.7" fill="#FFE566" opacity="0.9"/>
          <rect x="23" y="37.5" width="5" height="1.5" rx="0.7" fill="#FFE566" opacity="0.9"/>
          <!-- مصابيح خلفية -->
          <rect x="4" y="13" width="4.5" height="1.5" rx="0.7" fill="#FF4444" opacity="0.9"/>
          <rect x="23.5" y="13" width="4.5" height="1.5" rx="0.7" fill="#FF4444" opacity="0.9"/>
          <!-- لمعة السيارة -->
          <path d="M13,7 Q16,6 19,7 Q18,10 13,10 Z" fill="white" opacity="0.1"/>
        </g>
        <!-- مؤشر الاتجاه (سهم للأعلى = اتجاه الحركة) -->
        ${spd!=null&&spd>2?`<polygon points="16,1 13,6 19,6" fill="${color}" stroke="white" stroke-width="1" opacity="0.9"/>`:""}
      </svg>`;

      const iconHtml=isSup
        ?`<div style="position:relative;display:flex;flex-direction:column;align-items:center">
            ${spd!=null&&spd>0?`<div style="background:${color};color:white;font-size:8px;font-weight:800;padding:1px 5px;border-radius:8px;margin-bottom:1px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.25)">${spd}</div>`:""}
            <div style="background:${color};color:white;border-radius:5px;transform:rotate(45deg);width:30px;height:30px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.4);border:2px solid white;font-size:13px;font-weight:800">
              <span style="transform:rotate(-45deg)">★</span>
            </div>
          </div>`
        :`<div style="position:relative;display:flex;flex-direction:column;align-items:center">
            ${spd!=null&&spd>0?`<div style="background:${color};color:white;font-size:8px;font-weight:800;padding:1px 5px;border-radius:8px;margin-bottom:1px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.25)">${spd} km/h</div>`:""}
            ${carSvg}
          </div>`;

      const iconH=spd!=null&&spd>0&&!isSup?48+18:isSup&&spd!=null&&spd>0?30+18:isSup?30:48;
      const iconW=isSup?30:32;
      const icon=L.divIcon({html:iconHtml,iconSize:[iconW,iconH],iconAnchor:[iconW/2,iconH],className:""});

      const handleClick=(e:any)=>{ L.DomEvent.stopPropagation(e); setQuickCard(loc); setTripPanel(null); };

      if (markersRef.current[loc.rep_id]) {
        markersRef.current[loc.rep_id].setLatLng([loc.latitude,loc.longitude]).setIcon(icon);
      } else {
        const m=L.marker([loc.latitude,loc.longitude],{icon}).addTo(map);
        m.on("click",handleClick);
        markersRef.current[loc.rep_id]=m;
      }
    });
  },[locations,filterRep,filterType]);

  useEffect(()=>{ fetchLocations(); const id=setInterval(fetchLocations,30_000); return()=>clearInterval(id); },[fetchLocations]);

  // تحريك الخريطة للمندوب المختار من الشريط
  const flyTo=(loc:LiveLocation)=>{
    leafletMap.current?.map.flyTo([loc.latitude,loc.longitude],16,{duration:0.8});
    setQuickCard(loc); setTripPanel(null);
  };

  const visibleLocations = filterRep==="all"
    ? (filterType==="all"?locations:locations.filter(l=>(l.person_type??"rep")===filterType))
    : locations.filter(l=>l.rep_id===filterRep);

  const trips=buildTrips(tripHistory);
  const totalMove=trips.filter(t=>t.type==="move").reduce((a,t)=>a+t.dur,0);
  const totalStop=trips.filter(t=>t.type==="stop").reduce((a,t)=>a+t.dur,0);
  const maxSpd=trips.reduce((a,t)=>Math.max(a,t.maxSpd??0),0);
  const panelColor=quickCard?(quickCard.person_type==="supervisor"?SUPERVISOR_COLOR:PIN_COLORS[quickCard.rep_id.charCodeAt(0)%PIN_COLORS.length]):"#2563EB";
  const tripColor=tripPanel?(tripPanel.person_type==="supervisor"?SUPERVISOR_COLOR:PIN_COLORS[tripPanel.rep_id.charCodeAt(0)%PIN_COLORS.length]):"#2563EB";

  return (
    <>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reps/manage`}>{ar?"المناديب":"Reps"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar?"خريطة التتبع":"Live Tracking"}</span>
          </div>
          <h1 className="page-title">{ar?"خريطة المناديب الحية":"Live Reps Map"}</h1>
          {lastUpdate&&<p className="page-subtitle">{ar?"آخر تحديث:":"Updated:"} {lastUpdate.toLocaleTimeString("en-US")} · {ar?"يتجدد كل 30ث":"every 30s"}</p>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",borderRadius:8,overflow:"hidden",border:"1px solid var(--border)"}}>
            {(["all","rep","supervisor"] as const).map(t=>(
              <button key={t} onClick={()=>{setFilterType(t);setFilterRep("all");}} style={{padding:"6px 12px",fontSize:12,fontWeight:600,background:filterType===t?"var(--primary)":"var(--surface)",color:filterType===t?"white":"var(--text-muted)",border:"none",cursor:"pointer"}}>
                {t==="all"?(ar?"الكل":"All"):t==="rep"?(ar?"مناديب":"Reps"):(ar?"مشرفون":"Sups")}
              </button>
            ))}
          </div>
          <select className="form-input" style={{minWidth:170}} value={filterRep} onChange={e=>setFilterRep(e.target.value)}>
            <option value="all">{ar?"— جميع —":"— All —"}</option>
            {(filterType==="all"||filterType==="rep")&&allReps.map((r:any)=><option key={r.id} value={r.id}>{r.full_name} ({r.rep_code})</option>)}
            {(filterType==="all"||filterType==="supervisor")&&allSupervisors.map((s:any)=><option key={s.id} value={s.id}>★ {s.name}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={fetchLocations} style={{display:"flex",alignItems:"center",gap:5}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            {ar?"تحديث":"Refresh"}
          </button>
        </div>
      </div>

      {/* ── شريط المناديب ── */}
      <div style={{display:"flex",gap:8,overflowX:"auto",padding:"4px 0 10px",scrollbarWidth:"none",flexShrink:0}}>
        {loading&&<div style={{padding:"10px 14px",background:"var(--surface)",borderRadius:12,border:"1px solid var(--border)",fontSize:12,color:"var(--text-muted)",whiteSpace:"nowrap"}}>{ar?"جاري التحميل...":"Loading..."}</div>}
        {!loading&&visibleLocations.length===0&&<div style={{padding:"10px 16px",background:"var(--surface)",borderRadius:12,border:"1px solid var(--border)",fontSize:12,color:"var(--text-muted)"}}>{ar?"لا توجد مواقع مسجّلة":"No locations"}</div>}
        {visibleLocations.map(loc=>{
          const isSup=loc.person_type==="supervisor";
          const color=isSup?SUPERVISOR_COLOR:PIN_COLORS[loc.rep_id.charCodeAt(0)%PIN_COLORS.length];
          const isSel=quickCard?.rep_id===loc.rep_id;
          return (
            <div key={loc.rep_id} onClick={()=>flyTo(loc)} style={{flexShrink:0,width:148,background:"var(--surface)",borderRadius:12,padding:"10px 12px",cursor:"pointer",border:isSel?`2px solid ${color}`:"1px solid var(--border)",transition:"all 0.15s",boxShadow:isSel?`0 3px 10px ${color}30`:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                <div style={{width:28,height:28,borderRadius:isSup?"6px":"50%",background:color,color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,flexShrink:0,transform:isSup?"rotate(45deg)":"none"}}>
                  <span style={{transform:isSup?"rotate(-45deg)":"none"}}>{isSup?"★":loc.rep_name.split(" ").slice(0,2).map((w:string)=>w[0]).join("").toUpperCase()}</span>
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{loc.rep_name}</div>
                  <div style={{fontSize:10,color:"var(--text-muted)"}}>{isSup?(ar?"مشرف":"Sup"):loc.rep_code}</div>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:9,fontWeight:600,padding:"2px 6px",borderRadius:20,background:loc.is_moving?"#D1FAE5":"#F3F4F6",color:loc.is_moving?"#059669":"#6B7280"}}>{loc.is_moving?(ar?"متحرك":"Moving"):(ar?"ثابت":"Still")}</span>
                <span style={{fontSize:9,color:"var(--text-muted)"}}>{fmtTime(loc.recorded_at)}</span>
              </div>
              {loc.battery_level!=null&&<div style={{marginTop:3,fontSize:9,color:"var(--text-muted)",display:"flex",alignItems:"center",gap:2}}>🔋{loc.battery_level}%</div>}
            </div>
          );
        })}
      </div>

      {/* ── الخريطة + شريط الرحلات ── */}
      <div style={{display:"flex",gap:12,flex:1,minHeight:0,height:"calc(100vh - 280px)"}}>

        {/* الخريطة */}
        <div style={{flex:1,borderRadius:16,overflow:"hidden",border:"1px solid var(--border)",position:"relative",minHeight:300}}>
          <div ref={mapRef} style={{width:"100%",height:"100%"}}/>

          {/* عدّاد */}
          <div style={{position:"absolute",top:10,right:10,zIndex:1000,background:"white",borderRadius:8,padding:"4px 10px",boxShadow:"0 2px 8px rgba(0,0,0,0.15)",fontSize:11,fontWeight:600}}>{visibleLocations.length} {ar?"نشط":"active"}</div>

          {/* ── Quick Card — يظهر فوق الدبوس ── */}
          {quickCard&&(
            <div onClick={e=>e.stopPropagation()} style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",zIndex:2000,background:"white",borderRadius:16,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",padding:"14px 18px",minWidth:260,maxWidth:320,border:`2px solid ${panelColor}`}}>
              {/* إغلاق */}
              <button onClick={()=>setQuickCard(null)} style={{position:"absolute",top:8,left:10,background:"#F3F4F6",border:"none",borderRadius:6,cursor:"pointer",padding:"2px 7px",fontSize:13,color:"#6B7280"}}>✕</button>

              {/* رأس الكارد */}
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,marginTop:4}}>
                <div style={{width:36,height:36,borderRadius:quickCard.person_type==="supervisor"?"8px":"50%",background:panelColor,color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,flexShrink:0,transform:quickCard.person_type==="supervisor"?"rotate(45deg)":"none"}}>
                  <span style={{transform:quickCard.person_type==="supervisor"?"rotate(-45deg)":"none"}}>{quickCard.person_type==="supervisor"?"★":quickCard.rep_name.split(" ").slice(0,2).map((w:string)=>w[0]).join("").toUpperCase()}</span>
                </div>
                <div>
                  <div style={{fontWeight:800,fontSize:14,color:"var(--text)"}}>{quickCard.rep_name}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)"}}>{quickCard.rep_code!=="SUP"?quickCard.rep_code:""} · {quickCard.person_type==="supervisor"?(ar?"مشرف":"Supervisor"):(ar?"مندوب":"Rep")}</div>
                </div>
              </div>

              {/* بيانات سريعة */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
                <div style={{background:"#F8FAFC",borderRadius:10,padding:"7px 6px",textAlign:"center"}}>
                  <div style={{fontWeight:800,fontSize:16,color:panelColor}}>{quickCard.speed!=null?Math.round(quickCard.speed as number):0}</div>
                  <div style={{fontSize:9,color:"#6B7280"}}>{ar?"km/h":"km/h"}</div>
                </div>
                <div style={{background:"#F8FAFC",borderRadius:10,padding:"7px 6px",textAlign:"center"}}>
                  <div style={{fontWeight:800,fontSize:16,color:quickCard.battery_level!=null&&quickCard.battery_level<20?"#EF4444":"#059669"}}>{quickCard.battery_level??"-"}%</div>
                  <div style={{fontSize:9,color:"#6B7280"}}>{ar?"بطارية":"Battery"}</div>
                </div>
                <div style={{background:quickCard.is_moving?"#D1FAE5":"#F3F4F6",borderRadius:10,padding:"7px 6px",textAlign:"center"}}>
                  <div style={{fontWeight:800,fontSize:13,color:quickCard.is_moving?"#059669":"#6B7280"}}>{quickCard.is_moving?(ar?"متحرك":"Moving"):(ar?"ثابت":"Still")}</div>
                  <div style={{fontSize:9,color:"#6B7280"}}>{fmtTime(quickCard.recorded_at)}</div>
                </div>
              </div>

              <div style={{fontSize:11,color:"#6B7280",marginBottom:10}}>{ar?"آخر تحديث:":"Updated:"} {fmtDateTime(quickCard.recorded_at)}</div>

              {/* زر تفصيل الرحلات */}
              <button onClick={()=>{ setTripPanel(quickCard); setTripDate(todayStr()); setQuickCard(null); }}
                style={{width:"100%",padding:"8px",borderRadius:10,background:panelColor,color:"white",border:"none",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                📍 {ar?"تفصيل الرحلات":"Trip Details"}
              </button>
            </div>
          )}
        </div>

        {/* ── شريط الرحلات الجانبي ── */}
        {tripPanel&&(
          <div style={{width:300,background:"var(--surface)",borderRadius:16,border:"1px solid var(--border)",display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0}}>
            <div style={{background:tripColor,padding:"12px 14px",color:"white",display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>setTripPanel(null)} style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:6,color:"white",cursor:"pointer",padding:"2px 8px",fontSize:14}}>✕</button>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:13}}>{tripPanel.rep_name}</div>
                <div style={{fontSize:10,opacity:0.85}}>{ar?"تفصيل الرحلات":"Trip Details"}</div>
              </div>
            </div>

            {/* اختيار اليوم */}
            <div style={{padding:"10px 14px",borderBottom:"1px solid var(--border)",display:"flex",gap:6,alignItems:"center"}}>
              <input type="date" value={tripDate} onChange={e=>setTripDate(e.target.value)}
                style={{flex:1,padding:"6px 8px",borderRadius:8,border:"1px solid var(--border)",fontSize:12,background:"var(--bg)",color:"var(--text)"}}/>
            </div>

            <div style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>
              {tripLoading&&<div style={{textAlign:"center",padding:24,color:"var(--text-muted)",fontSize:12}}>{ar?"جاري التحميل...":"Loading..."}</div>}
              {!tripLoading&&trips.length===0&&<div style={{textAlign:"center",padding:24,color:"var(--text-muted)",fontSize:12}}>{ar?"لا توجد بيانات":"No data"}</div>}
              {!tripLoading&&trips.length>0&&(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:12}}>
                    <div style={{background:"#DBEAFE",borderRadius:10,padding:"7px 6px",textAlign:"center"}}>
                      <div style={{fontWeight:800,fontSize:12,color:"#1D4ED8"}}>{fmtDur(totalMove)}</div>
                      <div style={{fontSize:9,color:"#1D4ED8"}}>{ar?"حركة":"Moving"}</div>
                    </div>
                    <div style={{background:"#FEF3C7",borderRadius:10,padding:"7px 6px",textAlign:"center"}}>
                      <div style={{fontWeight:800,fontSize:12,color:"#B45309"}}>{fmtDur(totalStop)}</div>
                      <div style={{fontSize:9,color:"#B45309"}}>{ar?"توقف":"Stopped"}</div>
                    </div>
                    <div style={{background:"#D1FAE5",borderRadius:10,padding:"7px 6px",textAlign:"center"}}>
                      <div style={{fontWeight:800,fontSize:12,color:"#059669"}}>{maxSpd>0?maxSpd:"-"}</div>
                      <div style={{fontSize:9,color:"#059669"}}>{ar?"أعلى km/h":"Max km/h"}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {trips.map((t,i)=>(
                      <div key={i} style={{padding:"8px 10px",background:"var(--bg)",borderRadius:10,borderLeft:`3px solid ${t.type==="move"?"#2563EB":"#D97706"}`,display:"flex",gap:8}}>
                        <span style={{fontSize:15}}>{t.type==="move"?"🚗":"⏸"}</span>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",justifyContent:"space-between"}}>
                            <span style={{fontWeight:700,fontSize:11,color:t.type==="move"?"#2563EB":"#D97706"}}>{t.type==="move"?(ar?"تحرك":"Moving"):(ar?"توقف":"Stop")}</span>
                            <span style={{fontWeight:700,fontSize:11}}>{fmtDur(t.dur)}</span>
                          </div>
                          <div style={{fontSize:10,color:"var(--text-muted)"}}>{fmtTime(t.start)} ← {fmtTime(t.end)}</div>
                          {t.type==="move"&&t.avgSpd&&<div style={{fontSize:10,color:"var(--text-muted)"}}>{ar?"متوسط:":"Avg:"} {t.avgSpd} · {ar?"أعلى:":"Max:"} {t.maxSpd} km/h</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
