import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef,useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';

import { AppText as Text } from '@/src/components/AppText';
import { LiveLocationMap } from '@/src/components/LiveLocationMap';
import { useWatchTrack } from '@/src/hooks/useWatchTrack';
import {useSafeZone} from '@/src/hooks/useSafeZone';
import {SafeZonePanel} from '@/src/components/SafeZonePanel';
import {FeatureMessage} from '@/src/components/CareFeature';
import type {ZoneOverlay} from '@/src/lib/safe-zone';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { relativeTime } from '@/src/lib/format';
import { watchMapPosition,watchReadingFresh,trackingSourceLabel } from '@/src/lib/galaxy-watch';
import {newestWatchPosition} from '@/src/lib/location-map';
import { useAuth } from '@/src/providers/AuthProvider';
import { useHealthData } from '@/src/providers/HealthDataProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

export default function LastSyncLocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = getTheme(useColorScheme() === 'dark');
  const { session } = useAuth();
  const { elderly, galaxyWatch, error: watchError, refresh } = useHealthData();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const error = watchError;
  const track = useWatchTrack(elderly?.elderly_id, galaxyWatch?.device_id);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1_000);return()=>clearInterval(timer);},[]);
  const watchFix=newestWatchPosition(watchMapPosition(galaxyWatch),track.points,now);
  const location=watchFix?{...watchFix,id:galaxyWatch!.device_id,recorded_at:watchFix.measured_at}:null;
  const gpsLive=Boolean(galaxyWatch?.monitoring&&watchFix&&watchReadingFresh(watchFix.measured_at,now,15_000));
  const watchConnected=watchReadingFresh(galaxyWatch?.received_at,now,30_000);
  const ageLabel=(stamp:string|null|undefined)=>stamp&&Number.isFinite(Date.parse(stamp))?`${Math.max(0,Math.round((now-Date.parse(stamp))/1000))}s ago`:'not received';
  const zone=useSafeZone(session?.user.id,elderly?.elderly_id);
  const [preview,setPreview]=useState<ZoneOverlay|null>(null),[selecting,setSelecting]=useState(false),[picked,setPicked]=useState<{latitude:number;longitude:number}|null>(null);
  const scroll=useRef<ScrollView>(null);
  const overlay=preview??zone.zone;
  const mapPosition=watchFix;
  const updatePreview=useCallback((value:ZoneOverlay|null)=>{setPreview(value);if(!value)setSelecting(false);},[]);

  const load = useCallback(async (pull = false) => {
    if (!session) return;
    setRefreshing(pull);
    try { await refresh(false, true); } finally { setLoading(false); setRefreshing(false); }
  }, [refresh, session]);

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
        <View style={styles.headerCopy}><Text style={[styles.title, { color: theme.text }]}>Live location tracking</Text><Text style={[styles.subtitle, { color: theme.subtitle }]}>{gpsLive ? 'Receiving location updates' : watchConnected?'Watch connected · waiting for location':'Waiting or showing the last known position'}</Text></View>
      </View>

      <ScrollView ref={scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {void load(true);void zone.refresh();}} colors={[palette.primary]} />} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.notice, { backgroundColor: `${palette.primary}12` }]}>
          <Ionicons name="watch-outline" size={21} color={palette.primaryDark} />
          <Text style={[styles.noticeText, { color: theme.text }]}>{`${watchFix?trackingSourceLabel(watchFix.location_source):'Waiting for location'}. ${watchFix?.location_source==='watch_gps'?'This fix comes from the watch’s satellite GPS.':'Hybrid tracking uses GPS, fused and network estimates. A phone-assisted estimate may represent the paired phone if it stays behind.'} ${gpsLive?'The marker updates as new estimates arrive.':'A last known marker does not establish the current position.'}`}</Text>
        </View>
        <Text style={[typeScale.caption,{color:theme.subtitle,marginTop:10}]}>Location fix: {ageLabel(watchFix?.measured_at)} · Watch upload: {ageLabel(galaxyWatch?.received_at)}</Text>
        {watchConnected&&!gpsLive?<FeatureMessage message="The watch is reaching the server, but it has no fresh location estimate. Enable Location on the watch and paired phone; satellite GPS also needs a clear sky view."/>:null}

        {galaxyWatch?.gps_status ? <Text style={[styles.noticeText, { color: theme.subtitle, marginTop: 12 }]}>{galaxyWatch.gps_status}</Text> : null}
        {loading ? <View style={styles.state}><ActivityIndicator color={palette.primary} /><Text style={[styles.stateText, { color: theme.subtitle }]}>Loading watch location…</Text></View> : null}
        {!loading && error ? <View style={styles.state}><Ionicons name="alert-circle-outline" size={34} color={palette.error} /><Text style={[styles.stateTitle, { color: theme.text }]}>Unable to load location</Text><Text style={[styles.stateText, { color: theme.subtitle }]}>{error}</Text></View> : null}
        {!loading && !error && !location ? <View style={styles.state}><Ionicons name="location-outline" size={38} color={theme.subtitle} /><Text style={[styles.stateTitle, { color: theme.text }]}>Waiting for location</Text><Text style={[styles.stateText, { color: theme.subtitle }]}>Open ElderCareAI Watch, allow precise Location and tap Start monitoring. Enable Location on the watch and paired phone for hybrid estimates. Keep internet enabled to share positions.</Text></View> : null}

        {track.error ? <Text style={[styles.noticeText,{color:theme.subtitle,marginTop:8}]}>{track.error}</Text> : null}
        {selecting?<FeatureMessage message="Tap the map to set the center of your safe zone, then save it below."/>:null}
        {mapPosition ? <>
          <View style={[styles.mapCard, { backgroundColor: theme.cardElevated }]}>
            <LiveLocationMap key={location?.id??'safe-zone-preview'} style={styles.map} position={mapPosition}
              points={track.points} live={gpsLive} safeZone={overlay} selecting={selecting} onCoordinateSelect={point=>{setPicked(point);setSelecting(false);}} />
            {!location?<View style={styles.details}><FeatureMessage message="The map is centered on your saved place. No patient position is available yet."/></View>:<View style={styles.details}>
              <Text style={[styles.noticeText,{color:theme.subtitle}]}>The dot and line show received GPS, fused or network estimates. Source changes start a new trail segment. The safe-zone circle stays at your saved place. Drag the map to explore; tap Follow location to return.</Text>
              {location!.accuracy_m != null && location!.accuracy_m > 100 ? <Text style={[styles.noticeText,{color:palette.warning}]}>Approximate position. Small movements may be within the reported accuracy.</Text> : null}
              <View style={styles.detailRow}><Ionicons name="time-outline" size={18} color={palette.primaryDark} /><View><Text style={[styles.detailLabel, { color: theme.subtitle }]}>LAST RECORDED</Text><Text style={[styles.detailValue, { color: theme.text }]}>{relativeTime(location!.recorded_at)} • {new Date(location!.recorded_at).toLocaleString()}</Text></View></View>
              <View style={styles.detailRow}><Ionicons name="locate-outline" size={18} color={palette.accentDark} /><View><Text style={[styles.detailLabel, { color: theme.subtitle }]}>REPORTED ACCURACY</Text><Text style={[styles.detailValue, { color: theme.text }]}>{location!.accuracy_m != null ? `Approximately ${Math.round(location!.accuracy_m)} meters` : 'Accuracy unavailable'}</Text></View></View>
              <Pressable onPress={openExternalMap} style={styles.openButton}><Ionicons name="navigate-outline" size={18} color="#FFFFFF" /><Text style={styles.openButtonText}>Open in OpenStreetMap</Text></Pressable>
            </View>}
          </View>
        </> : null}
        <View style={{marginTop:20}}><SafeZonePanel key={`${session.user.id}:${elderly?.elderly_id}`} care={zone} fix={watchFix} monitoring={galaxyWatch?.monitoring} picked={picked} onPreview={updatePreview} onPickRequest={()=>{setSelecting(true);scroll.current?.scrollTo({y:0,animated:true});}}/></View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { minHeight: 74, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1, marginLeft: 12 },
  title: { ...typeScale.sectionTitle }, subtitle: { marginTop: 2, ...typeScale.caption }, content: { padding: 18 },
  notice: { padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, noticeText: { flex: 1, ...typeScale.subhead },
  state: { minHeight: 320, alignItems: 'center', justifyContent: 'center', padding: 30 }, stateTitle: { marginTop: 10, ...typeScale.sectionTitle }, stateText: { marginTop: 7, ...typeScale.subhead, textAlign: 'center' },
  mapCard: { marginTop: 16, borderRadius: 14, overflow: 'hidden' }, map: { width: '100%', height: 360 }, mapFallback: { alignItems: 'center', justifyContent: 'center', padding: 24 }, details: { padding: 16, gap: 14 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, detailLabel: { ...typeScale.eyebrow }, detailValue: { marginTop: 2, fontSize: 13, fontFamily: fontFamily.semiBold },
  openButton: { minHeight: 48, borderRadius: 14, backgroundColor: palette.primaryDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, openButtonText: { color: '#FFFFFF', fontSize: 12, fontFamily: fontFamily.semiBold },
});
