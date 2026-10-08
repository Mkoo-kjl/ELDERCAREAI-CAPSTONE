import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

function mapHtml(latitude: number, longitude: number) {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;width:100%;margin:0;background:#dcecea}.leaflet-control-attribution{font-size:8px}.pin{width:12px;height:12px;border:3px solid white;border-radius:50%;background:#397F88;box-shadow:0 1px 5px #263a3a88}</style>
</head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const point=[${latitude},${longitude}];
const map=L.map('map',{zoomControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,touchZoom:false,boxZoom:false,keyboard:false}).setView(point,15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
L.marker(point,{icon:L.divIcon({className:'',html:'<div class="pin"></div>',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(map);
</script></body></html>`;
}

export function LocationMapPreview({ latitude, longitude }: { latitude: number; longitude: number }) {
  const [failed, setFailed] = useState(false);
  const source = useMemo(() => ({ html: mapHtml(latitude, longitude) }), [latitude, longitude]);
  if (failed || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return <WebView
    pointerEvents="none"
    style={StyleSheet.absoluteFillObject}
    source={source}
    originWhitelist={['*']}
    javaScriptEnabled
    mixedContentMode="never"
    scrollEnabled={false}
    onError={() => setFailed(true)}
    onHttpError={() => setFailed(true)}
  />;
}
