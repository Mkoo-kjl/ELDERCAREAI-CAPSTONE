import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Linking, Pressable, ScrollView, StyleSheet, useColorScheme, Vibration, View } from 'react-native';

import { AppText as Text } from '@/src/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDateTime } from '@/src/lib/format';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { useHealthData } from '@/src/providers/HealthDataProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

type ViewTab = 'Alerts' | 'Notifications' | 'Emergency';
type HealthAlert = { id: string; severity: string; title: string; message: string; is_read: boolean; is_resolved: boolean; triggered_at: string };
type Notification = { id: string; title: string; body: string; is_read: boolean; sent_at: string; delivery_status: string };
type Emergency = { id: string; event_type: string; severity: string; description: string | null; is_resolved: boolean; triggered_at: string };

export default function AlertsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const insets = useSafeAreaInsets();
  const theme = getTheme(useColorScheme() === 'dark');
  const { session } = useAuth();
  const { elderly, vital } = useHealthData();
  const [tab, setTab] = useState<ViewTab>('Alerts');
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loadingSos, setLoadingSos] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (params.tab === 'Alerts' || params.tab === 'Notifications' || params.tab === 'Emergency') setTab(params.tab);
  }, [params.tab]);

  const load = useCallback(async () => {
    if (!elderly || !session) return;
    const [alertResult, notificationResult, emergencyResult] = await Promise.all([
      supabase.from('health_alerts').select('*').eq('elderly_id', elderly.elderly_id).order('triggered_at', { ascending: false }),
      supabase.from('caregiver_notifications').select('*').eq('caregiver_id', session.user.id).order('sent_at', { ascending: false }),
      supabase.from('emergency_events').select('*').eq('elderly_id', elderly.elderly_id).order('triggered_at', { ascending: false }),
    ]);
    setAlerts((alertResult.data as HealthAlert[]) ?? []);
    setNotifications((notificationResult.data as Notification[]) ?? []);
    setEmergencies((emergencyResult.data as Emergency[]) ?? []);
  }, [elderly, session]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const animateSos = () => Animated.sequence([
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 25 }),
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18 }),
  ]).start();

  const triggerSos = async () => {
    if (!elderly || !session) return;
    setLoadingSos(true);
    Vibration.vibrate([0, 250, 120, 250]);
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
        caregiver_id: session.user.id, elderly_id: elderly.elderly_id, alert_id: healthAlert.id, notification_type: 'emergency', title: 'SOS Emergency', body: `SOS event ${event.id} was created.`, channel: 'in_app', delivery_status: 'sent',
      });
      if (notificationError) throw notificationError;
      await load();
      if (elderly.emergency_contact_phone) await Linking.openURL(`tel:${elderly.emergency_contact_phone.replace(/[^+\d]/g, '')}`);
      else Alert.alert('Emergency logged', 'No emergency contact phone is saved. Add one in the older adult profile.');
    } catch (error) {
      Alert.alert('SOS could not complete', error instanceof Error ? error.message : 'Please call emergency services directly.');
    } finally { setLoadingSos(false); }
  };

  const confirmSos = () => Alert.alert('Activate SOS?', 'This logs an emergency event and calls the saved emergency contact. It is not a replacement for local emergency services.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Activate SOS', style: 'destructive', onPress: () => void triggerSos() },
  ]);

  const updateAlert = async (id: string, values: Partial<HealthAlert>) => { await supabase.from('health_alerts').update(values).eq('id', id); await load(); };
  const resolveEmergency = async (id: string) => { await supabase.from('emergency_events').update({ is_resolved: true, responded_by: session?.user.id, responded_at: new Date().toISOString() }).eq('id', id); await load(); };
  const markNotification = async (id: string) => { await supabase.from('caregiver_notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id); await load(); };

  return <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}> 
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}>
      <View style={styles.header}><Text style={[styles.title, { color: theme.text }]}>Alerts</Text><Text style={[styles.subtitle, { color: theme.subtitle }]}>Updates and emergency history</Text></View>
      <View style={styles.sosArea}><Animated.View style={{ transform: [{ scale }] }}><Pressable disabled={loadingSos} onPress={confirmSos}><LinearGradient colors={[palette.error, '#DC2626']} style={styles.sos}><Ionicons name="call" size={39} color="#FFFFFF" /><Text style={styles.sosText}>SOS</Text></LinearGradient></Pressable></Animated.View><Text style={[styles.sosHelp, { color: theme.subtitle }]}>Tap to confirm, log, and call {elderly?.emergency_contact ?? 'the emergency contact'}</Text></View>
      <View style={styles.tabs}>{(['Alerts', 'Notifications', 'Emergency'] as ViewTab[]).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, { backgroundColor: tab === item ? palette.aquaSurface : theme.cardElevated, borderColor: tab === item ? palette.aquaSurface : theme.border }]}><Text style={[styles.tabText, { color: tab === item ? palette.text : theme.subtitle }]}>{item}</Text>{item === 'Notifications' && notifications.some((n) => !n.is_read) ? <View style={styles.unreadDot} /> : null}</Pressable>)}</View>
      <View style={styles.content}>
        {tab === 'Alerts' ? <><View style={styles.actionRow}><Text style={[styles.count, { color: theme.subtitle }]}>{alerts.length} alerts</Text>{alerts.length ? <Pressable onPress={() => void Promise.all(alerts.filter((a) => !a.is_read).map((a) => supabase.from('health_alerts').update({ is_read: true }).eq('id', a.id))).then(load)}><Text style={styles.clear}>Mark all read</Text></Pressable> : null}</View>{alerts.map((item) => <AlertCard key={item.id} item={item} onRead={() => void updateAlert(item.id, { is_read: true })} onResolve={() => void updateAlert(item.id, { is_resolved: true, resolved_at: new Date().toISOString(), resolved_by: session?.user.id } as Partial<HealthAlert>)} />)}{!alerts.length ? <Empty text="No health alerts" /> : null}</> : null}
        {tab === 'Notifications' ? notifications.map((item) => <Pressable key={item.id} onPress={() => void markNotification(item.id)} style={[styles.card, { backgroundColor: theme.cardElevated }]}>{!item.is_read ? <View style={styles.cardUnread} /> : null}<Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text><Text style={[styles.cardBody, { color: theme.subtitle }]}>{item.body}</Text><Text style={[styles.time, { color: theme.subtitle }]}>{formatDateTime(item.sent_at)}</Text></Pressable>) : null}
        {tab === 'Emergency' ? emergencies.map((item) => <View key={item.id} style={[styles.card, { backgroundColor: theme.cardElevated }]}><View style={styles.cardHeader}><Text style={[styles.cardTitle, { color: theme.text }]}>SOS Emergency</Text><Badge label={item.is_resolved ? 'RESOLVED' : 'ACTIVE'} color={item.is_resolved ? palette.accent : palette.error} /></View><Text style={[styles.cardBody, { color: theme.subtitle }]}>{item.description ?? 'Emergency event'}</Text><Text style={[styles.time, { color: theme.subtitle }]}>{formatDateTime(item.triggered_at)}</Text>{!item.is_resolved ? <Pressable onPress={() => void resolveEmergency(item.id)} style={styles.resolve}><Text style={styles.resolveText}>Mark Resolved</Text></Pressable> : null}</View>) : null}
      </View>
    </ScrollView>
  </View>;
}

function severityColor(severity: string) { return severity === 'critical' ? palette.error : severity === 'high' ? palette.warning : severity === 'medium' ? palette.primaryDark : palette.accentDark; }
function Badge({ label, color }: { label: string; color: string }) { return <View style={[styles.badge, { backgroundColor: `${color}18` }]}><Text style={[styles.badgeText, { color }]}>{label}</Text></View>; }
function AlertCard({ item, onRead, onResolve }: { item: HealthAlert; onRead: () => void; onResolve: () => void }) { const theme = getTheme(useColorScheme() === 'dark'); const color = severityColor(item.severity); return <View style={[styles.card, { backgroundColor: theme.cardElevated }]}><View style={styles.cardHeader}><Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text><Badge label={item.severity.toUpperCase()} color={color} /></View><Text style={[styles.cardBody, { color: theme.subtitle }]}>{item.message}</Text><Text style={[styles.time, { color: theme.subtitle }]}>{formatDateTime(item.triggered_at)}</Text><View style={styles.buttons}>{!item.is_read ? <Pressable onPress={onRead} style={styles.secondary}><Text style={styles.secondaryText}>Mark Read</Text></Pressable> : null}{!item.is_resolved ? <Pressable onPress={onResolve} style={styles.resolve}><Text style={styles.resolveText}>Resolve</Text></Pressable> : null}</View></View>; }
function Empty({ text }: { text: string }) { const theme = getTheme(useColorScheme() === 'dark'); return <View style={styles.empty}><Ionicons name="checkmark-circle-outline" size={36} color={palette.accent} /><Text style={[styles.emptyText, { color: theme.subtitle }]}>{text}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { padding: 18, paddingBottom: 10 }, title: { ...typeScale.screenTitle }, subtitle: { marginTop: 3, ...typeScale.subhead }, sosArea: { alignItems: 'center', paddingVertical: 15 },
  sos: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', shadowColor: palette.error, shadowOpacity: 0.35, shadowRadius: 18, elevation: 8 }, sosText: { marginTop: 3, color: '#FFFFFF', fontSize: 24, fontFamily: fontFamily.extraBold }, sosHelp: { marginTop: 12, paddingHorizontal: 34, ...typeScale.subhead, textAlign: 'center' },
  tabs: { paddingHorizontal: 18, flexDirection: 'row', gap: 7 }, tab: { flex: 1, height: 36, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }, tabText: { fontSize: 10.5, fontFamily: fontFamily.medium }, unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.error },
  content: { padding: 18 }, actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }, count: { fontSize: 12 }, clear: { color: palette.primaryDark, fontSize: 12, fontFamily: fontFamily.medium }, card: { marginBottom: 8, padding: 14, borderRadius: 14 }, cardUnread: { position: 'absolute', right: 13, top: 13, width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primaryDark },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, cardTitle: { flex: 1, ...typeScale.cardTitle }, cardBody: { marginTop: 6, ...typeScale.subhead }, time: { marginTop: 8, ...typeScale.caption }, badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 11 }, badgeText: { fontSize: 9, fontFamily: fontFamily.medium }, buttons: { marginTop: 12, flexDirection: 'row', gap: 8 },
  resolve: { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, backgroundColor: `${palette.accent}18` }, resolveText: { color: palette.accentDark, fontSize: 11, fontFamily: fontFamily.bold }, secondary: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, backgroundColor: `${palette.primary}18` }, secondaryText: { color: palette.primaryDark, fontSize: 11, fontFamily: fontFamily.bold }, empty: { alignItems: 'center', padding: 35 }, emptyText: { marginTop: 9, ...typeScale.subhead },
});
