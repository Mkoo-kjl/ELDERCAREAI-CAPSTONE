import { Ionicons } from '@expo/vector-icons';
import type { ImageSourcePropType } from 'react-native';
import { Image, Modal, Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';

import { AppText as Text } from '@/src/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { vitalTimeLabel } from '@/src/lib/vital-time';
import type { VitalLog } from '@/src/providers/HealthDataProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

export type VitalMetricKey = 'heart_rate_bpm' | 'spo2_percent' | 'sleep_hours' | 'steps_count' | 'skin_temp_celsius' | 'hrv_rmssd_ms';
type MetricConfig = {
  title: string;
  shortTitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  unit: string;
  digits: number;
  about: string;
  source: string;
  caution: string;
};

const configs: Record<VitalMetricKey, MetricConfig> = {
  heart_rate_bpm: { title: 'Heart Rate', shortTitle: 'heart rate', icon: 'heart', color: palette.error, unit: 'bpm', digits: 0, about: 'Heart rate is the number of times the heart beats each minute. It naturally changes with movement, emotion, medication, illness, hydration, and sleep.', source: 'Latest wrist-based heart-rate sample synchronized from Google Health.', caution: 'One wearable reading cannot diagnose a heart condition. Consider activity and symptoms when interpreting it.' },
  spo2_percent: { title: 'Blood Oxygen (SpO₂)', shortTitle: 'blood oxygen', icon: 'water', color: palette.primaryDark, unit: '%', digits: 1, about: 'SpO₂ estimates the percentage of oxygen carried by the blood. Wearable values can be affected by movement, fit, circulation, and sensor contact.', source: 'Latest SpO₂ sample, with Google Health’s daily oxygen average used as a fallback.', caution: 'Confirm unexpectedly low values and seek appropriate medical help when symptoms or persistent concerns are present.' },
  sleep_hours: { title: 'Sleep Duration', shortTitle: 'sleep', icon: 'moon', color: palette.purple, unit: 'hours', digits: 1, about: 'Sleep duration is the time the wearable classified as asleep during the most recently synchronized sleep session.', source: 'Google Health sleep minutes converted to hours.', caution: 'Wearables estimate sleep and may not exactly match time perceived asleep or a clinical sleep study.' },
  steps_count: { title: 'Recent Steps', shortTitle: 'activity', icon: 'footsteps', color: palette.accentDark, unit: 'steps', digits: 0, about: 'Steps summarize recorded walking activity and are useful for observing personal activity patterns over time.', source: 'Sum of synchronized Google Health step intervals from the rolling previous 24 hours.', caution: 'This is a rolling 24-hour value, so it may differ from a calendar-day total shown by Fitbit.' },
  skin_temp_celsius: { title: 'Overnight Skin Temperature', shortTitle: 'overnight skin temperature', icon: 'thermometer', color: palette.warning, unit: '°C', digits: 1, about: 'This is the average skin temperature captured by the wearable while the person slept. It is useful mainly for comparing overnight trends with the person’s own baseline.', source: 'Google Health daily sleep-temperature derivation from Fitbit.', caution: 'This is not the person’s current temperature, core body temperature, or a fever measurement. Use a clinical thermometer when current body temperature matters.' },
  hrv_rmssd_ms: { title: 'Heart Rate Variability', shortTitle: 'HRV', icon: 'leaf', color: palette.pink, unit: 'ms', digits: 0, about: 'Heart rate variability here is the RMSSD value synchronized from Google Health. It reflects variation between heartbeats and is most useful as a personal trend over time.', source: 'Latest RMSSD heart-rate-variability sample synchronized from Google Health.', caution: 'HRV varies with sleep, illness, activity, hydration, and sensor conditions. This app does not diagnose stress, illness, or recovery status from HRV.' },
};

const elleImages: Record<'happy' | 'neutral' | 'worried', ImageSourcePropType> = {
  happy: require('../../assets/images/elle-happy.png'),
  neutral: require('../../assets/images/elle-neutral.png'),
  worried: require('../../assets/images/elle-worried.png'),
};

function valueFor(row: VitalLog, metric: VitalMetricKey) {
  const value = row[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function formatValue(value: number | null, config: MetricConfig) { return value === null ? '--' : metricNumber(value, config.digits); }
function metricNumber(value: number, digits: number) { return digits ? value.toFixed(digits) : Math.round(value).toLocaleString(); }
function isConcerning(metric: VitalMetricKey, value: number | null) {
  if (value === null) return false;
  if (metric === 'heart_rate_bpm') return value < 50 || value > 110;
  if (metric === 'spo2_percent') return value < 95;
  if (metric === 'sleep_hours') return value < 5;
  if (metric === 'hrv_rmssd_ms') return value < 30;
  return false;
}

export function VitalDetailModal({ visible, metric, history, onClose }: { visible: boolean; metric: VitalMetricKey | null; history: VitalLog[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = getTheme(useColorScheme() === 'dark');
  if (!metric) return null;
  const config = configs[metric];
  const latestRow = history[0] ?? null;
  const latest = latestRow ? valueFor(latestRow, metric) : null;
  const recent = history.map((row) => ({ value: valueFor(row, metric), at: row.measurement_times?.[metric] ?? (row.source === 'google_health_v4' ? null : row.recorded_at) }))
    .filter((item): item is { value: number; at: string } => typeof item.value === 'number' && Boolean(item.at)).slice(0, 7).reverse();
  const minimum = recent.length ? Math.min(...recent.map((item) => item.value)) : 0;
  const maximum = recent.length ? Math.max(...recent.map((item) => item.value)) : 0;
  const range = maximum - minimum || 1;
  const concerning = isConcerning(metric, latest);
  const emotion = latest === null ? 'neutral' : concerning ? 'worried' : 'happy';
  const elleMessage = latest === null ? `I’m waiting for a synchronized ${config.shortTitle} reading.` : concerning ? `This ${config.shortTitle} reading crosses an ElderCareAI review threshold. Please consider context, repeat the measurement, and respond appropriately to symptoms.` : `I’ve added this ${config.shortTitle} reading to the recent history. Trends are usually more useful than one isolated value.`;

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.cardElevated, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}><View style={[styles.heroIcon, { backgroundColor: `${config.color}16` }]}><Ionicons name={config.icon} size={29} color={config.color} /></View><View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: config.color }]}>VITAL DETAILS</Text><Text style={[styles.title, { color: theme.text }]}>{config.title}</Text></View><Pressable accessibilityLabel="Close details" onPress={onClose} style={[styles.close, { backgroundColor: theme.card }]}><Ionicons name="close" size={22} color={theme.text} /></Pressable></View>
          <View style={[styles.readingCard, { backgroundColor: theme.card }]}><Text style={[styles.readingLabel, { color: theme.subtitle }]}>LATEST SYNCHRONIZED READING</Text><View style={styles.readingRow}><Text style={[styles.reading, { color: theme.text }]}>{formatValue(latest, config)}</Text><Text style={[styles.unit, { color: theme.subtitle }]}>{config.unit}</Text></View><Text style={[styles.time, { color: theme.subtitle }]}>{vitalTimeLabel(latestRow, metric)}</Text></View>

          <View style={[styles.elleCard, { backgroundColor: concerning ? `${palette.warning}12` : `${palette.primary}10` }]}><Image source={elleImages[emotion]} style={styles.elle} resizeMode="cover" /><View style={styles.elleCopy}><Text style={[styles.elleName, { color: theme.text }]}>Elle says</Text><Text style={[styles.elleText, { color: theme.subtitle }]}>{elleMessage}</Text></View></View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent readings</Text>
          {recent.length ? <View style={[styles.chartCard, { backgroundColor: theme.card }]}><View style={styles.bars}>{recent.map((item, index) => { const height = 18 + ((item.value - minimum) / range) * 54; return <View key={`${item.at}:${index}`} style={styles.barColumn}><Text numberOfLines={1} style={[styles.barValue, { color: theme.subtitle }]}>{metricNumber(item.value, config.digits)}</Text><View style={[styles.bar, { height, backgroundColor: config.color }]} /><Text style={[styles.barDate, { color: theme.subtitle }]}>{new Date(item.at).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</Text></View>; })}</View><Text style={[styles.chartNote, { color: theme.subtitle }]}>Up to seven most recent synchronized values</Text></View> : <View style={[styles.emptyChart, { backgroundColor: theme.card }]}><Text style={[styles.chartNote, { color: theme.subtitle }]}>No recent values are available for this metric.</Text></View>}

          <InfoSection title="What it means" body={config.about} color={theme.text} subtitle={theme.subtitle} />
          <InfoSection title="Where this value comes from" body={config.source} color={theme.text} subtitle={theme.subtitle} />
          <View style={[styles.caution, { backgroundColor: `${palette.warning}12` }]}><Ionicons name="information-circle-outline" size={20} color={palette.warning} /><Text style={[styles.cautionText, { color: theme.text }]}>{config.caution}</Text></View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function InfoSection({ title, body, color, subtitle }: { title: string; body: string; color: string; subtitle: string }) { return <View style={styles.infoSection}><Text style={[styles.sectionTitle, { color }]}>{title}</Text><Text style={[styles.body, { color: subtitle }]}>{body}</Text></View>; }

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.58)' }, sheet: { maxHeight: '91%', borderTopLeftRadius: 20, borderTopRightRadius: 20 }, handle: { alignSelf: 'center', width: 46, height: 5, borderRadius: 3, backgroundColor: palette.border, marginTop: 9 }, content: { padding: 19, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center' }, heroIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1, marginLeft: 11 }, eyebrow: { fontSize: 9.5, fontFamily: fontFamily.medium }, title: { marginTop: 2, ...typeScale.sectionTitle }, close: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  readingCard: { marginTop: 17, padding: 16, borderRadius: 14 }, readingLabel: { ...typeScale.eyebrow }, readingRow: { marginTop: 5, flexDirection: 'row', alignItems: 'baseline', gap: 6 }, reading: { ...typeScale.display, fontVariant: ['tabular-nums'] }, unit: { fontSize: 12, fontFamily: fontFamily.medium }, time: { marginTop: 2, ...typeScale.caption },
  elleCard: { marginTop: 13, minHeight: 90, padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }, elle: { width: 65, height: 58, borderRadius: 11 }, elleCopy: { flex: 1, marginLeft: 11 }, elleName: { ...typeScale.cardTitle }, elleText: { marginTop: 3, fontSize: 11.5, lineHeight: 17 },
  sectionTitle: { marginTop: 19, marginBottom: 8, ...typeScale.cardTitle }, chartCard: { padding: 14, borderRadius: 14 }, bars: { height: 108, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 5 }, barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' }, barValue: { fontSize: 8.5, marginBottom: 4 }, bar: { width: '62%', minWidth: 9, maxWidth: 24, borderRadius: 4 }, barDate: { marginTop: 4, fontSize: 8 }, chartNote: { marginTop: 8, fontSize: 10.5, textAlign: 'center' }, emptyChart: { padding: 18, borderRadius: 14 },
  infoSection: { marginTop: 2 }, body: { ...typeScale.body }, caution: { marginTop: 18, padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, cautionText: { flex: 1, ...typeScale.subhead },
});
