import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '@/src/components/GradientButton';
import { MetricCard } from '@/src/components/MetricCard';
import { VitalDetailModal, type VitalMetricKey } from '@/src/components/VitalDetailModal';
import { relativeTime } from '@/src/lib/format';
import { useAuth } from '@/src/providers/AuthProvider';
import { useHealthData } from '@/src/providers/HealthDataProvider';
import { getTheme, palette } from '@/src/theme/colors';

function display(value: number | null | undefined, digits = 0) { return value === null || value === undefined ? '--' : value.toFixed(digits); }

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const theme = getTheme(isDark);
  const { onboarding } = useAuth();
  const { elderly, vital, history, refreshing, error, syncState, lastSuccessfulSyncAt, refresh } = useHealthData();
  const connected = onboarding?.wearable_status === 'connected' || onboarding?.wearable_status === 'authorized_no_device';
  const [showPermission, setShowPermission] = useState(!connected);
  const [selectedMetric, setSelectedMetric] = useState<VitalMetricKey | null>(null);

  const readTime = relativeTime(vital?.synced_at ?? vital?.recorded_at);
  const pills = [
    elderly?.age !== null ? `${elderly?.age ?? '--'} yrs` : null,
    elderly?.gender,
    elderly?.weight_kg ? `${elderly.weight_kg} kg` : null,
    elderly?.height_cm ? `${elderly.height_cm} cm` : null,
    elderly?.blood_type,
  ].filter(Boolean);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={palette.primary} colors={[palette.primary]} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 88 }}
      >
        <LinearGradient colors={isDark ? ['#162544', '#0F172A'] : ['#E8F5FF', '#FFFFFF']} style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.headerTop}>
            <View><Text style={[styles.eyebrow, { color: palette.primaryDark }]}>CARE DASHBOARD</Text><Text style={[styles.greeting, { color: theme.text }]}>Today’s overview</Text></View>
            <Pressable onPress={() => router.push('/profile')} style={[styles.settings, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}><Ionicons name="settings-outline" size={22} color={theme.text} /></Pressable>
          </View>
          <View style={styles.profileBlock}>
            {elderly?.photo_url ? <Image source={{ uri: elderly.photo_url }} style={styles.profilePhoto} /> : (
              <LinearGradient colors={[palette.primary, palette.accent]} style={styles.profilePhoto}><Ionicons name="person" size={52} color="#FFFFFF" /></LinearGradient>
            )}
            <Text style={[styles.name, { color: theme.text }]}>{elderly?.full_name ?? 'Older adult'}</Text>
            <View style={styles.pills}>{pills.map((pill) => <View key={String(pill)} style={[styles.pill, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}><Text style={[styles.pillText, { color: theme.text }]}>{pill}</Text></View>)}</View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <Pressable onPress={() => router.push('/location')} style={[styles.locationCard, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
            <View style={styles.locationIcon}><Ionicons name="location" size={22} color={palette.primaryDark} /></View>
            <View style={styles.locationCopy}><Text style={[styles.locationTitle, { color: theme.text }]}>Last sync location</Text><Text style={[styles.locationText, { color: theme.subtitle }]}>View where this phone last synchronized health data</Text></View>
            <Ionicons name="chevron-forward" size={20} color={theme.subtitle} />
          </Pressable>
          <View style={[styles.liveBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.liveDot, { backgroundColor: syncState === 'error' ? palette.warning : palette.accent }]} />
            <View style={styles.liveCopy}><Text style={[styles.liveTitle, { color: theme.text }]}>{syncState === 'syncing' ? 'Checking for new readings…' : syncState === 'error' ? 'Sync will retry automatically' : 'Live health updates are on'}</Text><Text style={[styles.liveText, { color: theme.subtitle }]}>{lastSuccessfulSyncAt ? `Last checked ${relativeTime(lastSuccessfulSyncAt)} • refreshes every minute while open` : 'Refreshes every minute while the app is open'}</Text></View>
            <Pressable accessibilityLabel="Refresh health readings now" disabled={refreshing} onPress={() => void refresh(true)} style={[styles.refreshButton, { backgroundColor: theme.cardElevated }]}>{refreshing ? <ActivityIndicator size="small" color={palette.primaryDark} /> : <Ionicons name="refresh" size={20} color={palette.primaryDark} />}</Pressable>
          </View>
          <View style={styles.sectionRow}><Text style={[styles.sectionTitle, { color: theme.text }]}>Health vitals</Text><View style={[styles.connectionPill, { backgroundColor: connected ? `${palette.accent}16` : `${palette.error}12` }]}><View style={[styles.dot, { backgroundColor: connected ? palette.accent : palette.error }]} /><Text style={[styles.connectionText, { color: connected ? palette.accentDark : palette.error }]}>{connected ? 'Connected' : 'Disconnected'}</Text></View></View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.grid}>
            <MetricCard icon="heart" title="Heart Rate" value={display(vital?.heart_rate_bpm)} unit="bpm" timestamp={readTime} color={palette.error} onPress={() => setSelectedMetric('heart_rate_bpm')} />
            <MetricCard icon="water" title="SpO₂" value={display(vital?.spo2_percent, 1)} unit="%" timestamp={readTime} color={palette.primary} onPress={() => setSelectedMetric('spo2_percent')} />
            <MetricCard fullWidth icon="moon" title="Sleep" value={display(vital?.sleep_hours, 1)} unit="hours" timestamp={readTime} color={palette.purple} onPress={() => setSelectedMetric('sleep_hours')} />
            <MetricCard fullWidth icon="footsteps" title="Steps (24h)" value={vital?.steps_count?.toLocaleString() ?? '--'} unit="steps" timestamp={readTime} color={palette.accent} onPress={() => setSelectedMetric('steps_count')} />
            <MetricCard icon="thermometer" title="Overnight Skin Temp" value={display(vital?.skin_temp_celsius, 1)} unit="°C" timestamp={readTime} color={palette.warning} onPress={() => setSelectedMetric('skin_temp_celsius')} />
            <MetricCard icon="leaf" title="HRV Strain" value={display(vital?.stress_score)} unit="/100" timestamp={readTime} color={palette.pink} onPress={() => setSelectedMetric('stress_score')} />
          </View>
          {!vital ? <View style={[styles.empty, { backgroundColor: theme.card, borderColor: theme.border }]}><Ionicons name="analytics-outline" size={30} color={theme.subtitle} /><Text style={[styles.emptyTitle, { color: theme.text }]}>No health readings yet</Text><Text style={[styles.emptyText, { color: theme.subtitle }]}>Connect Google Health and pull down to perform a real synchronization.</Text></View> : null}
        </View>
      </ScrollView>

      <VitalDetailModal visible={selectedMetric !== null} metric={selectedMetric} history={history} onClose={() => setSelectedMetric(null)} />

      <Modal transparent visible={showPermission && !connected} animationType="fade" onRequestClose={() => setShowPermission(false)}>
        <View style={styles.overlay}><View style={[styles.modal, { backgroundColor: theme.cardElevated }]}>
          <View style={styles.modalIcon}><Ionicons name="fitness" size={32} color={palette.primaryDark} /></View>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Connect Google Health</Text>
          <Text style={[styles.modalText, { color: theme.subtitle }]}>Your dashboard stays empty until you authorize read-only health data access. ElderCareAI never fabricates readings.</Text>
          <GradientButton label="Review permissions" onPress={() => { setShowPermission(false); router.push('/setup/fitness?mode=edit'); }} colors={[palette.google, palette.googleDark]} />
          <Pressable onPress={() => setShowPermission(false)} style={styles.notNow}><Text style={[styles.notNowText, { color: theme.subtitle }]}>Not now</Text></Pressable>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { paddingHorizontal: 22, paddingBottom: 25 }, headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1 }, greeting: { marginTop: 3, fontSize: 25, fontWeight: '800', letterSpacing: -0.4 },
  settings: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, profileBlock: { alignItems: 'center', marginTop: 22 },
  profilePhoto: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#FFFFFF' },
  name: { marginTop: 12, fontSize: 23, fontWeight: '800' }, pills: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 }, pillText: { fontSize: 11, fontWeight: '600' }, content: { paddingHorizontal: 18, paddingTop: 23 },
  locationCard: { minHeight: 76, marginBottom: 20, padding: 13, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, locationIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: `${palette.primary}16`, alignItems: 'center', justifyContent: 'center' }, locationCopy: { flex: 1, marginLeft: 12 }, locationTitle: { fontSize: 14, fontWeight: '800' }, locationText: { marginTop: 3, fontSize: 11.5, lineHeight: 16 },
  liveBar: { minHeight: 70, marginBottom: 20, paddingHorizontal: 13, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center' }, liveDot: { width: 9, height: 9, borderRadius: 5 }, liveCopy: { flex: 1, marginLeft: 10 }, liveTitle: { fontSize: 12.5, fontWeight: '800' }, liveText: { marginTop: 3, fontSize: 9.5, lineHeight: 14 }, refreshButton: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, sectionTitle: { fontSize: 19, fontWeight: '800' },
  connectionPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }, dot: { width: 7, height: 7, borderRadius: 4 }, connectionText: { fontSize: 11, fontWeight: '700' },
  error: { marginBottom: 10, color: palette.error, fontSize: 12, lineHeight: 18 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  empty: { marginTop: 16, padding: 22, borderRadius: 18, borderWidth: 1, alignItems: 'center' }, emptyTitle: { marginTop: 9, fontSize: 15, fontWeight: '700' }, emptyText: { marginTop: 5, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.62)', alignItems: 'center', justifyContent: 'center', padding: 24 }, modal: { width: '100%', maxWidth: 390, padding: 22, borderRadius: 22, alignItems: 'center' },
  modalIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: '#E6F6FE', alignItems: 'center', justifyContent: 'center' }, modalTitle: { marginTop: 14, fontSize: 22, fontWeight: '800' },
  modalText: { marginTop: 8, fontSize: 13, lineHeight: 20, textAlign: 'center' }, notNow: { minHeight: 43, justifyContent: 'center' }, notNowText: { fontSize: 13, fontWeight: '600' },
});
