import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { relativeTime } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { getTheme, palette } from '@/src/theme/colors';

type SyncLocation = {
  id: string;
  event_type: 'wearable_connection' | 'health_sync';
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  recorded_at: string;
};

function leafletHtml(location: SyncLocation) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const accuracy = Math.max(Number(location.accuracy_m ?? 10), 10);
  const recordedAt = new Date(location.recorded_at).toLocaleString().replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;width:100%;margin:0;padding:0;background:#e8f1f5}.leaflet-control-attribution{font-size:9px}.sync-pin{background:#38BDF8;border:4px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(15,23,42,.35);width:20px;height:20px}</style></head>
<body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const point=[${latitude},${longitude}];
const map=L.map('map',{zoomControl:true,attributionControl:true}).setView(point,16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
const icon=L.divIcon({className:'',html:'<div class="sync-pin"></div>',iconSize:[28,28],iconAnchor:[14,14]});
L.marker(point,{icon}).addTo(map).bindPopup('<strong>Last phone sync</strong><br>${recordedAt}').openPopup();
L.circle(point,{radius:${accuracy},color:'#38BDF8',weight:2,fillColor:'#38BDF8',fillOpacity:.14}).addTo(map);
setTimeout(()=>map.invalidateSize(),100);
</script></body></html>`;
}

export default function LastSyncLocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = getTheme(useColorScheme() === 'dark');
  const { session } = useAuth();
  const [location, setLocation] = useState<SyncLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState(false);

  const load = useCallback(async (pull = false) => {
    if (!session) return;
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase.from('wearable_sync_locations')
      .select('id, event_type, latitude, longitude, accuracy_m, recorded_at')
      .eq('user_id', session.user.id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (queryError) setError(queryError.message);
    else setLocation(data as SyncLocation | null);
    setLoading(false);
    setRefreshing(false);
  }, [session]);

  useEffect(() => { void load(); }, [load]);
  if (!session) return <Redirect href="/login" />;

  const coordinates = location ? { latitude: location.latitude, longitude: location.longitude } : null;
  const openExternalMap = () => {
    if (!coordinates) return;
    void Linking.openURL(`https://www.openstreetmap.org/?mlat=${coordinates.latitude}&mlon=${coordinates.longitude}#map=16/${coordinates.latitude}/${coordinates.longitude}`);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: theme.card }]}><Ionicons name="arrow-back" size={22} color={theme.text} /></Pressable>
        <View style={styles.headerCopy}><Text style={[styles.title, { color: theme.text }]}>Last sync location</Text><Text style={[styles.subtitle, { color: theme.subtitle }]}>Phone location recorded during synchronization</Text></View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} colors={[palette.primary]} />} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.notice, { backgroundColor: `${palette.primary}12`, borderColor: `${palette.primary}45` }]}>
          <Ionicons name="phone-portrait-outline" size={21} color={palette.primaryDark} />
          <Text style={[styles.noticeText, { color: theme.text }]}>This marker is the caregiver phone’s location when a successful wearable synchronization occurred. It is not the Fitbit’s current location and is not live tracking.</Text>
        </View>

        {loading ? <View style={styles.state}><ActivityIndicator color={palette.primary} /><Text style={[styles.stateText, { color: theme.subtitle }]}>Loading the latest sync location…</Text></View> : null}
        {!loading && error ? <View style={styles.state}><Ionicons name="alert-circle-outline" size={34} color={palette.error} /><Text style={[styles.stateTitle, { color: theme.text }]}>Unable to load location</Text><Text style={[styles.stateText, { color: theme.subtitle }]}>{error}</Text></View> : null}
        {!loading && !error && !location ? <View style={styles.state}><Ionicons name="location-outline" size={38} color={theme.subtitle} /><Text style={[styles.stateTitle, { color: theme.text }]}>No sync location yet</Text><Text style={[styles.stateText, { color: theme.subtitle }]}>Grant foreground location consent, then synchronize Google Health while ElderCareAI is open.</Text></View> : null}

        {coordinates ? <>
          <View style={[styles.mapCard, { borderColor: theme.border, backgroundColor: theme.cardElevated }]}>
            {mapError ? <View style={[styles.map, styles.mapFallback]}><Ionicons name="map-outline" size={36} color={theme.subtitle} /><Text style={[styles.stateText, { color: theme.subtitle }]}>Leaflet could not load its map tiles. Check the phone’s internet connection or open the location in OpenStreetMap.</Text></View> : <WebView
              key={`${coordinates.latitude}:${coordinates.longitude}`}
              style={styles.map}
              source={{ html: leafletHtml(location!) }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="never"
              onError={() => setMapError(true)}
              onHttpError={() => setMapError(true)}
            />}
            <View style={styles.details}>
              <View style={styles.detailRow}><Ionicons name="time-outline" size={18} color={palette.primaryDark} /><View><Text style={[styles.detailLabel, { color: theme.subtitle }]}>LAST RECORDED</Text><Text style={[styles.detailValue, { color: theme.text }]}>{relativeTime(location!.recorded_at)} • {new Date(location!.recorded_at).toLocaleString()}</Text></View></View>
              <View style={styles.detailRow}><Ionicons name="locate-outline" size={18} color={palette.accentDark} /><View><Text style={[styles.detailLabel, { color: theme.subtitle }]}>PHONE ACCURACY</Text><Text style={[styles.detailValue, { color: theme.text }]}>{location!.accuracy_m ? `Approximately ${Math.round(location!.accuracy_m)} meters` : 'Not reported by the phone'}</Text></View></View>
              <Pressable onPress={openExternalMap} style={styles.openButton}><Ionicons name="navigate-outline" size={18} color="#FFFFFF" /><Text style={styles.openButtonText}>Open in OpenStreetMap</Text></Pressable>
            </View>
          </View>
        </> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { minHeight: 74, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1, marginLeft: 12 },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3 }, subtitle: { marginTop: 2, fontSize: 11.5 }, content: { padding: 18 },
  notice: { padding: 14, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  state: { minHeight: 320, alignItems: 'center', justifyContent: 'center', padding: 30 }, stateTitle: { marginTop: 10, fontSize: 17, fontWeight: '800' }, stateText: { marginTop: 7, fontSize: 12.5, lineHeight: 19, textAlign: 'center' },
  mapCard: { marginTop: 16, borderWidth: 1, borderRadius: 20, overflow: 'hidden' }, map: { width: '100%', height: 360 }, mapFallback: { alignItems: 'center', justifyContent: 'center', padding: 24 }, details: { padding: 16, gap: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, detailLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8 }, detailValue: { marginTop: 2, fontSize: 12.5, fontWeight: '600' },
  openButton: { minHeight: 48, borderRadius: 14, backgroundColor: palette.primaryDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, openButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
