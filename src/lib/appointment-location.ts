export type AppointmentCoordinate = {latitude:number; longitude:number};

export function isAppointmentCoordinate(point:unknown):point is AppointmentCoordinate {
  const value = point as AppointmentCoordinate | null;
  return !!value && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90
    && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
}

export function appointmentMapUrl(point:AppointmentCoordinate) {
  return `https://www.openstreetmap.org/?mlat=${point.latitude.toFixed(6)}&mlon=${point.longitude.toFixed(6)}#map=17/${point.latitude.toFixed(6)}/${point.longitude.toFixed(6)}`;
}

/** Keep the address and optional map link together in the existing location TEXT. */
export function encodeAppointmentLocation(label:string, point:AppointmentCoordinate | null) {
  return point && isAppointmentCoordinate(point) ? `${label.trim() || 'Map location'}\n${appointmentMapUrl(point)}` : label.trim();
}
export function decodeAppointmentLocation(value:string | null | undefined) {
  const text = value?.trim() ?? '';
  const match = /(?:^|\n)(https:\/\/www\.openstreetmap\.org\/\?mlat=(-?\d+(?:\.\d+)?)&mlon=(-?\d+(?:\.\d+)?)#map=17\/-?\d+(?:\.\d+)?\/-?\d+(?:\.\d+)?)$/.exec(text);
  const point = match ? {latitude:Number(match[2]), longitude:Number(match[3])} : null;
  return match && isAppointmentCoordinate(point) ? {label:text.slice(0, match.index).trim(), point} : {label:text, point:null};
}

/** A destination picker; viewport coordinates are never saved until the user taps. */
export function appointmentMapHtml(center:AppointmentCoordinate | null, selected:AppointmentCoordinate | null) {
  const initial = JSON.stringify({center:isAppointmentCoordinate(center) ? center : null, selected:isAppointmentCoordinate(selected) ? selected : null});
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#map{height:100%;width:100%;margin:0;background:#e4eeeb}.leaflet-control-attribution{font-size:9px}.pin{width:22px;height:22px;border:4px solid white;border-radius:50%;background:#397F88;box-shadow:0 2px 8px #17232166}</style>
<script>function report(type,value){var message={channel:'appointment-map',type:type,value:value};if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(message));else if(window.parent!==window)window.parent.postMessage(message,'*');}function failed(){report('error');}</script>
</head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="failed()"></script><script>
try{
var initial=${initial},center=initial.selected||initial.center,map=L.map('map').setView(center?[center.latitude,center.longitude]:[12.8797,121.774],center?16:6);
var failures=0,tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'}).addTo(map);
tiles.on('tileerror',function(){if(++failures===4)failed();});tiles.on('tileload',function(){failures=0;});
var marker=null,icon=L.divIcon({className:'',html:'<div class="pin"></div>',iconSize:[30,30],iconAnchor:[15,15]});
function choose(lat,lng,notify){
  if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lng))return;
  lng=((lng+180)%360+360)%360-180;
  if(marker)marker.setLatLng([lat,lng]);else{marker=L.marker([lat,lng],{icon:icon,draggable:true}).addTo(map);marker.on('dragend',function(){var p=marker.getLatLng();choose(p.lat,p.lng,true);});}
  if(notify)report('coordinate',{latitude:lat,longitude:lng});
}
map.on('click',function(e){choose(e.latlng.lat,e.latlng.lng,true);});
if(initial.selected)choose(initial.selected.latitude,initial.selected.longitude,false);
report('ready');
}catch(error){failed();}
</script></body></html>`;
}
