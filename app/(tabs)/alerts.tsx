import {AutomaticVitalAlerts} from '@/src/components/AutomaticVitalAlerts';
import {RelatedMedications} from '@/src/components/RelatedMedications';
import {EmergencyContacts} from '@/src/components/EmergencyContacts';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, useColorScheme, Vibration, View } from 'react-native';

import { AppText as Text } from '@/src/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDateTime } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { useHealthData } from '@/src/providers/HealthDataProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';
import {useCareRefresh} from '@/src/hooks/useCareRefresh';
import {registerCarePush} from '@/src/lib/watch-push';
import {alertResponseStatus} from '@/src/lib/care-workflow';
import {FeatureButton,FeatureMessage,FeatureStatus} from '@/src/components/CareFeature';

type ViewTab = 'Alerts' | 'Notifications' | 'Emergency';
type HealthAlert = { id: string; alert_type?:string; severity: string; title: string; message: string; is_read: boolean; is_resolved: boolean; triggered_at: string; acknowledged_at:string|null;emergency_event_id?:string|null };
type Notification = { id: string; title: string; body: string; is_read: boolean; sent_at: string; delivery_status: string;alert_id?:string;data?:{watch_sos_id?:string;emergency_event_id?:string} };
type Emergency = { id: string; event_type: string; severity: string; description: string | null; is_resolved: boolean; triggered_at: string };

export default function AlertsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const insets = useSafeAreaInsets();
  const theme = getTheme(useColorScheme() === 'dark');
  const { session } = useAuth();
  const { elderly, vital } = useHealthData();
  const [contactRequest,setContactRequest]=useState(0);
  const [tab, setTab] = useState<ViewTab>('Alerts');
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const owner=`${session?.user.id}:${elderly?.elderly_id}`,identity=useRef(owner),request=useRef(0);identity.current=owner;
  const [loadError,setLoadError]=useState<string|null>(null),[loading,setLoading]=useState(true);
  const [loadingSos, setLoadingSos] = useState(false);
  const [clearingNotification, setClearingNotification] = useState<string | null>(null);
  const sosPlayer = useAudioPlayer(require('@/assets/sounds/sos_alert.wav'));
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (params.tab === 'Alerts' || params.tab === 'Notifications' || params.tab === 'Emergency') setTab(params.tab);
  }, [params.tab]);

  useEffect(()=>{identity.current=owner;request.current++;setAlerts([]);setNotifications([]);setEmergencies([]);setLoadError(null);setLoading(true);return()=>{identity.current='';};},[owner]);
  const load = useCallback(async () => {
    if (!elderly || !session){setLoading(false);return;}
    const currentOwner=owner,sequence=++request.current;
    try{
      const [alertResult, notificationResult, emergencyResult] = await Promise.all([
        supabase.from('health_alerts').select('*').eq('elderly_id', elderly.elderly_id).order('triggered_at', { ascending: false }),
        supabase.from('caregiver_notifications').select('*').eq('caregiver_id', session.user.id).eq('elderly_id',elderly.elderly_id).order('sent_at', { ascending: false }),
        supabase.from('emergency_events').select('*').eq('elderly_id', elderly.elderly_id).order('triggered_at', { ascending: false }),
      ]);
      if(identity.current!==currentOwner||sequence!==request.current)return;
      if(alertResult.error||notificationResult.error||emergencyResult.error)throw alertResult.error??notificationResult.error??emergencyResult.error;
      setAlerts((alertResult.data as HealthAlert[]) ?? []);setNotifications((notificationResult.data as Notification[]) ?? []);setEmergencies((emergencyResult.data as Emergency[]) ?? []);setLoadError(null);
    }catch{if(identity.current===currentOwner&&sequence===request.current)setLoadError('Alerts could not refresh. Check your connection and retry.');}
    finally{if(identity.current===currentOwner&&sequence===request.current)setLoading(false);}
  }, [elderly, session,owner]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useCareRefresh(elderly?.elderly_id,load);

  const animateSos = () => Animated.sequence([
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 25 }),
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18 }),
  ]).start();

  const triggerSos = async () => {
    if (!elderly || !session) return;
    setLoadingSos(true);
    Vibration.vibrate([0, 250, 120, 250]);
    void sosPlayer.seekTo(0).then(() => sosPlayer.play()).catch(() => undefined);
    animateSos();
    try {
      const snapshot = vital ? { heart_rate_bpm: vital.heart_rate_bpm, spo2_percent: vital.spo2_percent, hrv_rmssd_ms: vital.hrv_rmssd_ms, recorded_at: vital.recorded_at } : null;
      const { data: event, error: eventError } = await supabase.from('emergency_events').insert({
        elderly_id: elderly.elderly_id, event_type: 'sos_call', severity: 'high', description: `SOS initiated by caregiver for ${elderly.full_name}.`, vital_snapshot: snapshot,
      }).select().single();
      if (eventError) throw eventError;
      const { data: healthAlert, error: alertError } = await supabase.from('health_alerts').insert({
        elderly_id: elderly.elderly_id, alert_type: 'sos', severity: 'critical', title: 'SOS Emergency Activated', message: `Emergency assistance requested for ${elderly.full_name}.`, ai_generated: false,
      }).select().single();
      if (alertError) throw alertError;
      const { error: notificationError } = await supabase.from('caregiver_notifications').insert({
        caregiver_id: session.user.id, elderly_id: elderly.elderly_id, alert_id: healthAlert.id, notification_type: 'emergency', title: 'SOS Emergency', body: `SOS event ${event.id} was created.`, channel: 'in_app', delivery_status: 'sent',data:{care_kind:'sos',emergency_event_id:event.id,url:'/alerts?tab=Emergency'},
      });
      if (notificationError) throw notificationError;
      await load();
      setTab('Emergency');
      setContactRequest(value=>value+1);
    } catch (error) {
      Alert.alert('SOS could not complete', error instanceof Error ? error.message : 'Please call emergency services directly.');
    } finally { setLoadingSos(false); }
  };

  const confirmSos = () => Alert.alert('Activate SOS?', 'This logs an emergency event. You can then choose the caregiver, family member or doctor to call. It is not a replacement for local emergency services.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Activate SOS', style: 'destructive', onPress: () => void triggerSos() },
  ]);

  const updateAlert = async (id: string, values: Partial<HealthAlert>) => { const result=await supabase.from('health_alerts').update(values).eq('id', id).eq('elderly_id',elderly?.elderly_id);if(result.error){Alert.alert('Could not update alert','Please try again.');return;}await load(); };
  const resolveEmergency = async (id: string) => { const result=await supabase.from('emergency_events').update({ is_resolved: true, responded_by: session?.user.id, responded_at: new Date().toISOString() }).eq('id', id).eq('elderly_id',elderly?.elderly_id);if(result.error){Alert.alert('Could not resolve emergency','Please try again.');return;}await load(); };
  const markNotification = async (id: string) => { const result=await supabase.from('caregiver_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id).eq('caregiver_id',session?.user.id);if(result.error){Alert.alert('Could not update notification','Please try again.');return;}await load(); };
  const markAllRead=async()=>{const result=await supabase.from('health_alerts').update({is_read:true}).eq('elderly_id',elderly?.elderly_id).eq('is_read',false);if(result.error){Alert.alert('Could not update alerts','Please try again.');return;}await load();};
  const clearNotification = async (id: string) => {
    if (!session || clearingNotification) return;
    setClearingNotification(id);
    try {
      const { error } = await supabase.from('caregiver_notifications').delete().eq('id', id).eq('caregiver_id', session.user.id);
      if (error) throw error;
      setNotifications((current) => current.filter((item) => item.id !== id));
    } catch {
      Alert.alert('Could not clear notification', 'Please try again.');
    } finally {
      setClearingNotification(null);
    }
  };
  const clearAllNotifications = () => Alert.alert('Clear all notifications?', 'This removes saved notifications from the list. Health alerts and emergency history stay available.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear all', style: 'destructive', onPress: () => void (async () => {
      if (!session || clearingNotification) return;
      setClearingNotification('all');
      try {
        const { error } = await supabase.from('caregiver_notifications').delete().eq('caregiver_id', session.user.id);
        if (error) throw error;
        setNotifications([]);
      } catch {
        Alert.alert('Could not clear notifications', 'Please try again.');
      } finally {
        setClearingNotification(null);
      }
    })() },
  ]);

  return <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}> 
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}>
      <View style={styles.header}><Text style={[styles.title, { color: theme.text }]}>Alerts</Text><Text style={[styles.subtitle, { color: theme.subtitle }]}>Updates and emergency history</Text></View>
      <AutomaticVitalAlerts/>
      <View style={{paddingHorizontal:18,paddingTop:12}}><EmergencyContacts openRequest={contactRequest}/></View><View style={styles.sosArea}><Animated.View style={{ transform: [{ scale }] }}><Pressable disabled={loadingSos} onPress={confirmSos}><LinearGradient colors={[palette.error, '#DC2626']} style={styles.sos}><Ionicons name="call" size={39} color="#FFFFFF" /><Text style={styles.sosText}>SOS</Text></LinearGradient></Pressable></Animated.View><Text style={[styles.sosHelp, { color: theme.subtitle }]}>Tap to confirm SOS, then choose a priority contact</Text><Pressable accessibilityRole="button" style={styles.secondary} onPress={()=>{if(session)void registerCarePush(session.user.id).then(()=>Alert.alert('Background notifications enabled','This phone is registered for watch SOS, vital alerts, medication reminders and appointment reminders when ElderCareAI is closed. Delivery needs internet and allowed notifications.')).catch(error=>Alert.alert('Background notifications setup',error.message));}}><Text style={styles.secondaryText}>Enable background notifications</Text></Pressable><Text style={[styles.sosHelp,{color:theme.subtitle}]}>Enable once on each caregiver phone. Background delivery needs the Firebase-enabled APK, notification permission and internet access.</Text></View>
      <View style={styles.tabs}>{(['Alerts', 'Notifications', 'Emergency'] as ViewTab[]).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, { backgroundColor: tab === item ? palette.aquaSurface : theme.cardElevated, borderColor: tab === item ? palette.aquaSurface : theme.border }]}><Text style={[styles.tabText, { color: tab === item ? palette.text : theme.subtitle }]}>{item}</Text>{item === 'Notifications' && notifications.some((n) => !n.is_read) ? <View style={styles.unreadDot} /> : null}</Pressable>)}</View>
      <View style={styles.content}>{loading?<FeatureMessage loading message="Loading alerts…"/>:null}{loadError?<><FeatureMessage error message={loadError}/><FeatureButton secondary label="Retry alerts" onPress={()=>void load()}/></>:null}
        {tab === 'Alerts' ? <><View style={styles.actionRow}><Text style={[styles.count, { color: theme.subtitle }]}>{alerts.length} alerts</Text>{alerts.length ? <Pressable onPress={() => void markAllRead()}><Text style={styles.clear}>Mark all read</Text></Pressable> : null}</View>
          {alerts.length?<View style={[styles.actionRow,{flexWrap:'wrap',gap:8}]}>{(['New','Acknowledged','Resolved'] as const).map(status=><FeatureStatus key={status} label={`${alerts.filter(a=>alertResponseStatus(a)===status).length} ${status.toLowerCase()}`} color={status==='Resolved'?palette.accentDark:status==='New'?palette.warning:palette.primaryDark}/>)}</View>:null}
          {alerts.map((item) => <AlertCard key={item.id} item={item} onRead={() => void updateAlert(item.id, { is_read: true })} onReview={() => router.push({pathname:'/alert-response',params:{id:item.id}})} />)}{!loading&&!loadError&&!alerts.length ? <Empty text="No health alerts" /> : null}</> : null}
        {tab === 'Notifications' ? <><View style={styles.actionRow}><Text style={[styles.count, { color: theme.subtitle }]}>{notifications.length} notifications</Text>{notifications.length ? <Pressable accessibilityRole="button" accessibilityLabel="Clear all notifications" disabled={clearingNotification !== null} onPress={clearAllNotifications} style={styles.clearAll}><Ionicons name="trash-outline" size={15} color={palette.primaryDark} /><Text style={styles.clear}>Clear all</Text></Pressable> : null}</View>{notifications.map((item) => <View key={item.id} style={[styles.card, styles.notificationRow, { backgroundColor: theme.cardElevated }]}><Pressable accessibilityRole="button" accessibilityLabel={`Read ${item.title}`} onPress={() => void markNotification(item.id)} style={styles.notificationCopy}>{!item.is_read ? <View style={styles.cardUnread} /> : null}<Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text><Text style={[styles.cardBody, { color: theme.subtitle }]}>{item.body}</Text><Text style={[styles.time, { color: theme.subtitle }]}>{formatDateTime(item.sent_at)}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Clear ${item.title}`} disabled={clearingNotification !== null} onPress={() => void clearNotification(item.id)} hitSlop={8} style={styles.clearOne}><Ionicons name="close" size={19} color={theme.subtitle} /></Pressable></View>)}{!loading&&!loadError&&!notifications.length ? <Empty text="No notifications" /> : null}</> : null}
        {tab === 'Emergency' ? emergencies.map((item) => <View key={item.id} style={[styles.card, { backgroundColor: theme.cardElevated }]}><View style={styles.cardHeader}><Text style={[styles.cardTitle, { color: theme.text }]}>SOS Emergency</Text><Badge label={item.is_resolved ? 'RESOLVED' : 'ACTIVE'} color={item.is_resolved ? palette.accent : palette.error} /></View><Text style={[styles.cardBody, { color: theme.subtitle }]}>{item.description ?? 'Emergency event'}</Text><Text style={[styles.time, { color: theme.subtitle }]}>{formatDateTime(item.triggered_at)}</Text>{alerts.find(a=>a.emergency_event_id===item.id)?<Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/alert-response',params:{id:alerts.find(a=>a.emergency_event_id===item.id)!.id}})} style={styles.secondary}><Text style={styles.secondaryText}>Review and respond</Text></Pressable>:!item.is_resolved ? <Pressable onPress={() => void resolveEmergency(item.id)} style={styles.resolve}><Text style={styles.resolveText}>Mark Resolved</Text></Pressable> : null}</View>) : null}
      </View>
    </ScrollView>
  </View>;
}

function severityColor(severity: string) { return severity === 'critical' ? palette.error : severity === 'high' || severity === 'warning' ? palette.warning : severity === 'medium' ? palette.primaryDark : palette.accentDark; }
function Badge({ label, color }: { label: string; color: string }) { return <View style={[styles.badge, { backgroundColor: `${color}18` }]}><Text style={[styles.badgeText, { color }]}>{label}</Text></View>; }
function AlertCard({ item, onRead, onReview }: { item: HealthAlert; onRead: () => void; onReview: () => void }) { const theme = getTheme(useColorScheme() === 'dark'); const color = severityColor(item.severity); return <View style={[styles.card, { backgroundColor: theme.cardElevated }]}><View style={styles.cardHeader}><Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text><Badge label={item.severity.toUpperCase()} color={color} /></View><Text style={[styles.cardBody, { color: theme.subtitle }]}>{item.message}</Text><Text style={[styles.time, { color: theme.subtitle }]}>{formatDateTime(item.triggered_at)}</Text><View style={{marginTop:8}}><FeatureStatus label={alertResponseStatus(item)} color={item.is_resolved?palette.accentDark:item.acknowledged_at?palette.primaryDark:palette.warning}/></View><RelatedMedications rule={item.alert_type}/><View style={styles.buttons}>{!item.is_read ? <Pressable onPress={onRead} style={styles.secondary}><Text style={styles.secondaryText}>Mark Read</Text></Pressable> : null}<Pressable accessibilityRole="button" accessibilityLabel={`Review response: ${item.title}`} onPress={onReview} style={styles.secondary}><Text style={styles.secondaryText}>{item.is_resolved?'View response':'Review and respond'}</Text></Pressable></View></View>; }
function Empty({ text }: { text: string }) { const theme = getTheme(useColorScheme() === 'dark'); return <View style={styles.empty}><Ionicons name="checkmark-circle-outline" size={36} color={palette.accent} /><Text style={[styles.emptyText, { color: theme.subtitle }]}>{text}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { padding: 18, paddingBottom: 10 }, title: { ...typeScale.screenTitle }, subtitle: { marginTop: 3, ...typeScale.subhead }, sosArea: { alignItems: 'center', paddingVertical: 15 },
  sos: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', shadowColor: palette.error, shadowOpacity: 0.35, shadowRadius: 18, elevation: 8 }, sosText: { marginTop: 3, color: '#FFFFFF', fontSize: 24, fontFamily: fontFamily.extraBold }, sosHelp: { marginTop: 12, paddingHorizontal: 34, ...typeScale.subhead, textAlign: 'center' },
  tabs: { paddingHorizontal: 18, flexDirection: 'row', gap: 7 }, tab: { flex: 1, height: 36, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }, tabText: { fontSize: 10.5, fontFamily: fontFamily.medium }, unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.error },
  content: { padding: 18 }, actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, count: { fontSize: 12 }, clearAll: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 30 }, clear: { color: palette.primaryDark, fontSize: 12, fontFamily: fontFamily.medium }, card: { marginBottom: 8, padding: 14, borderRadius: 14 }, notificationRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 0 }, notificationCopy: { flex: 1, padding: 14 }, clearOne: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }, cardUnread: { position: 'absolute', right: 13, top: 13, width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primaryDark },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, cardTitle: { flex: 1, ...typeScale.cardTitle }, cardBody: { marginTop: 6, ...typeScale.subhead }, time: { marginTop: 8, ...typeScale.caption }, badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 11 }, badgeText: { fontSize: 9, fontFamily: fontFamily.medium }, buttons: { marginTop: 12, flexDirection: 'row', gap: 8 },
  resolve: { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, backgroundColor: `${palette.accent}18` }, resolveText: { color: palette.accentDark, fontSize: 11, fontFamily: fontFamily.bold }, secondary: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, backgroundColor: `${palette.primary}18` }, secondaryText: { color: palette.primaryDark, fontSize: 11, fontFamily: fontFamily.bold }, empty: { alignItems: 'center', padding: 35 }, emptyText: { marginTop: 9, ...typeScale.subhead },
});
