import type {ZoneOverlay} from './safe-zone';
export type MapPosition = {
  latitude: number; longitude: number; accuracy_m: number | null; measured_at: string;
  location_source: 'watch_gps' | 'fused' | 'network';
};
export function validMapPosition(point: MapPosition) {
  return Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180
    && Number.isFinite(Date.parse(point.measured_at)) && (point.accuracy_m == null || Number.isFinite(point.accuracy_m) && point.accuracy_m >= 0);
}
/** The route stream can be newer than the separately synchronized live snapshot. */
export function newestWatchPosition(snapshot:MapPosition|null,points:MapPosition[],now=Date.now()){
  let latest=snapshot&&validMapPosition(snapshot)&&Date.parse(snapshot.measured_at)<=now+10_000?snapshot:null;
  for(const point of points){
    if(!validMapPosition(point)||Date.parse(point.measured_at)>now+10_000)continue;
    if(!latest||Date.parse(point.measured_at)>Date.parse(latest.measured_at))latest=point;
  }
  return latest;
}
export function distanceMeters(a: MapPosition, b: MapPosition) {
  const rad = Math.PI / 180, lat = (b.latitude-a.latitude)*rad, lng = (b.longitude-a.longitude)*rad;
  const h = Math.sin(lat/2)**2 + Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(lng/2)**2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0,1-h)));
}
/** Break the trail at source switches, poor accuracy, long gaps and implausible jumps. */
export function routeSegments(points: MapPosition[]) {
  const ordered = points.filter(validMapPosition).sort((a,b)=>Date.parse(a.measured_at)-Date.parse(b.measured_at)).slice(-500);
  const segments: number[][][] = []; let previous: MapPosition | null = null; let line: number[][] = [];
  for (const point of ordered) {
    if ((point.accuracy_m ?? 1000) > 100) { previous = null; line = []; continue; }
    const elapsed = previous ? (Date.parse(point.measured_at)-Date.parse(previous.measured_at))/1000 : 0;
    if (previous && elapsed === 0) continue;
    if (!previous || elapsed > 30 || point.location_source !== previous.location_source || distanceMeters(previous,point) > Math.max(100,elapsed*35 + (point.accuracy_m ?? 0) + (previous.accuracy_m ?? 0))) {
      line = []; segments.push(line);
    }
    line.push([point.latitude,point.longitude]); previous = point;
  }
  return segments.filter((segment)=>segment.length>1);
}
export function mapPayload(position: MapPosition, points: MapPosition[], live: boolean, safeZone:ZoneOverlay|null=null,selecting=false) {
  return { position, segments: routeSegments([...points, position]), live, safeZone,selecting };
}
export function liveMapHtml(initial: MapPosition, compact = false) {
  const serialized = JSON.stringify(initial).replace(/</g,String.fromCharCode(92)+'u003c');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;width:100%;margin:0;background:#e4eeeb}.leaflet-control-attribution{font-size:8px}.pin{width:16px;height:16px;border:3px solid white;border-radius:50%;background:#397F88;box-shadow:0 1px 8px #17232166}.stale{background:#65736E}</style>
<script>window.report=function(type,value){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type,value}));};window.mapFailed=function(){window.report('error','Map could not load. Check internet and retry.');};</script>
</head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="window.mapFailed()"></script><script>
try {
if(typeof L==='undefined')throw Error('Map library unavailable');
let latest=${serialized};let following=true;let animation=0;
const interactive=${!compact};
const map=L.map('map',{zoomControl:interactive,dragging:interactive,scrollWheelZoom:interactive,doubleClickZoom:interactive,touchZoom:interactive,boxZoom:interactive,keyboard:interactive}).setView([latest.latitude,latest.longitude],${compact ? 15 : 17});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
const marker=L.marker([latest.latitude,latest.longitude],{icon:L.divIcon({className:'',html:'<div class="pin"></div>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(map);
const circle=L.circle([latest.latitude,latest.longitude],{radius:Math.max(latest.accuracy_m||1,1),color:'#397F88',weight:1,fillOpacity:.09}).addTo(map);
const trail=L.layerGroup().addTo(map);
const zoneLayer=L.layerGroup().addTo(map);let selecting=false;let zoneSignature='';
map.on('click',function(event){if(selecting&&event.latlng)window.report('coordinate',{latitude:event.latlng.lat,longitude:event.latlng.lng});});
map.on('dragstart',function(){following=false;window.report('follow',false);});
window.followLatest=function(){following=true;map.panTo([latest.latitude,latest.longitude]);window.report('follow',true);};
window.updatePosition=function(payload){
 selecting=!!payload.selecting;
 const zone=payload.safeZone;const signature=JSON.stringify(zone||null);
 if(signature!==zoneSignature){zoneLayer.clearLayers();zoneSignature=signature;
      if(zone&&Number.isFinite(zone.latitude)&&Number.isFinite(zone.longitude)&&Number.isFinite(zone.radius_m)&&zone.radius_m>=10&&zone.radius_m<=5000){
   const area=L.circle([zone.latitude,zone.longitude],{radius:zone.radius_m,color:zone.enabled===false?'#65736E':'#3C704A',weight:2,dashArray:'6 4',fillOpacity:.08}).addTo(zoneLayer);
   const label=document.createElement('div');label.textContent=zone.name+' · '+zone.radius_m+' m'+(zone.enabled===false?' · Paused':'');area.bindPopup(label);
  }
 }
 const point=payload.position;if(Date.parse(point.measured_at)<Date.parse(latest.measured_at))return;
 const old=marker.getLatLng();const target=[point.latitude,point.longitude];
 const smooth=map.distance(old,target)<150&&point.location_source===latest.location_source;
 latest=point;cancelAnimationFrame(animation);
 circle.setRadius(Math.max(point.accuracy_m||1,1));
 const label=document.createElement('div');label.textContent=(point.location_source==='watch_gps'?'Watch satellite GPS':point.location_source==='fused'?'Fused location (may use paired phone)':'Network location')+' · '+new Date(point.measured_at).toLocaleString()+' · ±'+Math.round(point.accuracy_m||0)+'m';marker.bindPopup(label);
 const element=marker.getElement();if(element){const pin=element.querySelector('.pin');if(pin)pin.classList.toggle('stale',!payload.live);}
 if(smooth){let start=null;let delta=((point.longitude-old.lng+540)%360)-180;
  const frame=function(time){if(start===null)start=time;const fraction=Math.min(1,(time-start)/650);const eased=fraction*(2-fraction);const position=[old.lat+(point.latitude-old.lat)*eased,old.lng+delta*eased];marker.setLatLng(position);circle.setLatLng(position);if(fraction<1)animation=requestAnimationFrame(frame);};animation=requestAnimationFrame(frame);
 }else{marker.setLatLng(target);circle.setLatLng(target);}
 trail.clearLayers();(payload.segments||[]).forEach(function(segment){L.polyline(segment,{color:'#397F88',weight:3,opacity:.7}).addTo(trail);});
 if(following)map.panTo(target,{animate:true,duration:.65});
};
map.whenReady(function(){window.report('ready',true);});setTimeout(function(){map.invalidateSize();},100);
}catch(error){window.mapFailed();}
</script></body></html>`;
}
