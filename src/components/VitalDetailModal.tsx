import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';

import { AppText as Text } from '@/src/components/AppText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { vitalTimeLabel } from '@/src/lib/vital-time';
import { recentNightlySleep, sleepDateLabel, sleepEfficiency } from '@/src/lib/sleep-history';
import { formatSleepDuration, sleepDurationContext } from '@/src/lib/sleep-score';
import { supabase } from '@/src/lib/supabase';
import type { SleepSession, VitalLog } from '@/src/providers/HealthDataProvider';
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

type VitalInsightResponse = { reply?: string; content?: string };

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

export function VitalDetailModal({ visible, metric, history, sleepSessions = [], onClose }: { visible: boolean; metric: VitalMetricKey | null; history: VitalLog[]; sleepSessions?: SleepSession[]; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const theme = getTheme(useColorScheme() === 'dark');
  const insightCache = useRef(new Map<string, string>());
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
  const sleepContext = metric === 'sleep_hours' ? sleepDurationContext(latest) : null;
  const savedSleep = sleepSessions.length ? sleepSessions : history.flatMap((row) => {
    const end = row.measurement_times?.sleep_hours;
    return end && Number.isFinite(Date.parse(end)) && row.sleep_hours != null ? [{
      source_key: row.id, session_end_at: end,
      session_start_at: new Date(Date.parse(end) - row.sleep_hours * 3_600_000).toISOString(),
      minutes_asleep: Math.round(row.sleep_hours * 60), minutes_in_sleep_period: null,
      is_main_sleep: true, is_processed: false,
    }] : [];
  });
  const sleepNights = metric === 'sleep_hours' ? recentNightlySleep(savedSleep) : [];

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: theme.cardElevated, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}><View style={[styles.heroIcon, { backgroundColor: `${config.color}16` }]}><Ionicons name={config.icon} size={29} color={config.color} /></View><View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: config.color }]}>VITAL DETAILS</Text><Text style={[styles.title, { color: theme.text }]}>{config.title}</Text></View><Pressable accessibilityLabel="Close details" onPress={onClose} style={[styles.close, { backgroundColor: theme.card }]}><Ionicons name="close" size={22} color={theme.text} /></Pressable></View>
          <View style={[styles.readingCard, { backgroundColor: theme.card }]}><Text style={[styles.readingLabel, { color: theme.subtitle }]}>LATEST SYNCHRONIZED READING</Text><View style={styles.readingRow}><Text style={[styles.reading, { color: theme.text }]}>{formatValue(latest, config)}</Text><Text style={[styles.unit, { color: theme.subtitle }]}>{config.unit}</Text></View><Text style={[styles.time, { color: theme.subtitle }]}>{vitalTimeLabel(latestRow, metric)}</Text>{sleepContext ? <View style={styles.sleepScore}><Text style={[styles.sleepScoreValue, { color: palette.purple }]}>{sleepContext.label}</Text><Text style={[styles.sleepScoreNote, { color: theme.subtitle }]}>{sleepContext.note}</Text></View> : null}</View>

          <VitalInsight key={`${metric}:${latestRow?.id ?? 'none'}:${latest ?? 'none'}`} metric={metric} row={latestRow} value={latest} config={config} emotion={emotion} cache={insightCache.current} />

          {metric === 'sleep_hours' ? <><Text style={[styles.sectionTitle, { color: theme.text }]}>Last 7 days</Text>{sleepNights.length ? <View style={styles.sleepHistory}>{sleepNights.map((session) => { const efficiency = sleepEfficiency(session); return <View key={session.source_key} style={[styles.sleepNight, { backgroundColor: theme.card }]}><Text style={[styles.sleepNightDate, { color: theme.text }]}>{sleepDateLabel(session.session_end_at)}</Text><View style={styles.sleepNightReading}><Text style={[styles.sleepNightDuration, { color: theme.text }]}>{formatSleepDuration(session.minutes_asleep)}</Text><Text style={[styles.sleepNightCaption, { color: theme.subtitle }]}>{efficiency === null ? 'Recorded sleep duration' : `Sleep efficiency ${efficiency}%`}</Text></View></View>; })}</View> : <View style={[styles.emptyChart, { backgroundColor: theme.card }]}><Text style={[styles.chartNote, { color: theme.subtitle }]}>No nightly sleep sessions are available for the last seven days.</Text></View>}</> : <><Text style={[styles.sectionTitle, { color: theme.text }]}>Recent readings</Text>{recent.length ? <View style={[styles.chartCard, { backgroundColor: theme.card }]}><View style={styles.bars}>{recent.map((item, index) => { const height = 18 + ((item.value - minimum) / range) * 54; return <View key={`${item.at}:${index}`} style={styles.barColumn}><Text numberOfLines={1} style={[styles.barValue, { color: theme.subtitle }]}>{metricNumber(item.value, config.digits)}</Text><View style={[styles.bar, { height, backgroundColor: config.color }]} /><Text style={[styles.barDate, { color: theme.subtitle }]}>{new Date(item.at).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</Text></View>; })}</View><Text style={[styles.chartNote, { color: theme.subtitle }]}>Up to seven most recent synchronized values</Text></View> : <View style={[styles.emptyChart, { backgroundColor: theme.card }]}><Text style={[styles.chartNote, { color: theme.subtitle }]}>No recent values are available for this metric.</Text></View>}</>}

          <InfoSection title="What it means" body={config.about} color={theme.text} subtitle={theme.subtitle} />
          <InfoSection title="Where this value comes from" body={config.source} color={theme.text} subtitle={theme.subtitle} />
          <View style={[styles.caution, { backgroundColor: `${palette.warning}12` }]}><Ionicons name="information-circle-outline" size={20} color={palette.warning} /><Text style={[styles.cautionText, { color: theme.text }]}>{config.caution}</Text></View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function VitalInsight({ metric, row, value, config, emotion, cache }: { metric: VitalMetricKey; row: VitalLog | null; value: number | null; config: MetricConfig; emotion: 'happy' | 'neutral' | 'worried'; cache: Map<string, string> }) {
  const theme = getTheme(useColorScheme() === 'dark');
  const [attempt, setAttempt] = useState(0);
  const [insight, setInsight] = useState<{ status: 'empty' | 'loading' | 'ready' | 'error'; text: string }>({ status: 'empty', text: '' });
  const cacheKey = `${row?.elderly_id ?? 'none'}:${metric}:${row?.id ?? 'none'}:${row?.measurement_times?.[metric] ?? 'none'}:${value ?? 'none'}`;

  useEffect(() => {
    if (value === null) {
      setInsight({ status: 'empty', text: '' });
      return;
    }
    const saved = cache.get(cacheKey);
    if (saved) {
      setInsight({ status: 'ready', text: saved });
      return;
    }
    let active = true;
    setInsight({ status: 'loading', text: '' });
    const question = `The caregiver opened the patient's ${config.title} card. Give a concise, friendly 1-2 sentence observation about this specific recorded ${config.shortTitle} reading (${metricNumber(value, config.digits)} ${config.unit}). Start by stating the actual value and what it represents for the patient. Add useful context or a real trend only if supported by the database. Do not give a generic compliment, infer sleep quality from duration, diagnose, or invent conditions, symptoms, or prior readings. Refer to the patient, not the caregiver.`;
    void supabase.functions.invoke<VitalInsightResponse>('ai-care-assistant', {
      body: { message: question, insightMetric: metric, clientNow: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    }).then(({ data, error }) => {
      if (error) throw error;
      const text = (data?.reply ?? data?.content ?? '').trim();
      if (!text) throw new Error('Elle returned an empty insight.');
      cache.set(cacheKey, text);
      if (active) setInsight({ status: 'ready', text });
    }).catch((error: unknown) => {
      console.warn('Vital insight failed:', error instanceof Error ? error.message : error);
      if (active) setInsight({ status: 'error', text: '' });
    });
    return () => { active = false; };
  }, [attempt, cache, cacheKey, config, metric, value]);

  return <View style={[styles.elleCard, { backgroundColor: emotion === 'worried' ? `${palette.warning}12` : `${palette.primary}10` }]}><Image source={elleImages[emotion]} style={styles.elle} resizeMode="cover" /><View style={styles.elleCopy}><Text style={[styles.elleName, { color: theme.text }]}>Elle insight</Text>{insight.status === 'loading' ? <View style={styles.insightLoading}><ActivityIndicator size="small" color={palette.primaryDark} /><Text style={[styles.elleText, { color: theme.subtitle }]}>Reviewing recent readings...</Text></View> : <Text style={[styles.elleText, { color: theme.subtitle }]}>{insight.status === 'ready' ? insight.text : insight.status === 'empty' ? `A synchronized ${config.shortTitle} reading is needed for an insight.` : 'Insight is unavailable right now.'}</Text>}{insight.status === 'error' ? <Pressable accessibilityRole="button" onPress={() => setAttempt((current) => current + 1)} style={styles.insightRetry}><Ionicons name="refresh" size={14} color={palette.primaryDark} /><Text style={styles.retryText}>Retry insight</Text></Pressable> : null}<Text style={[styles.insightNote, { color: theme.subtitle }]}>Informational only. Not a medical assessment.</Text></View></View>;
}

function InfoSection({ title, body, color, subtitle }: { title: string; body: string; color: string; subtitle: string }) { return <View style={styles.infoSection}><Text style={[styles.sectionTitle, { color }]}>{title}</Text><Text style={[styles.body, { color: subtitle }]}>{body}</Text></View>; }

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.58)' }, sheet: { maxHeight: '91%', borderTopLeftRadius: 20, borderTopRightRadius: 20 }, handle: { alignSelf: 'center', width: 46, height: 5, borderRadius: 3, backgroundColor: palette.border, marginTop: 9 }, content: { padding: 19, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center' }, heroIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1, marginLeft: 11 }, eyebrow: { fontSize: 9.5, fontFamily: fontFamily.medium }, title: { marginTop: 2, ...typeScale.sectionTitle }, close: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  readingCard: { marginTop: 17, padding: 16, borderRadius: 14 }, readingLabel: { ...typeScale.eyebrow }, readingRow: { marginTop: 5, flexDirection: 'row', alignItems: 'baseline', gap: 6 }, reading: { ...typeScale.display, fontVariant: ['tabular-nums'] }, unit: { fontSize: 12, fontFamily: fontFamily.medium }, time: { marginTop: 2, ...typeScale.caption }, sleepScore: { marginTop: 13, gap: 3 }, sleepScoreValue: { fontSize: 14, fontFamily: fontFamily.bold }, sleepScoreNote: { fontSize: 10.5, lineHeight: 15 },
  elleCard: { marginTop: 13, minHeight: 90, padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center' }, elle: { width: 65, height: 58, borderRadius: 11 }, elleCopy: { flex: 1, marginLeft: 11 }, elleName: { ...typeScale.cardTitle }, elleText: { marginTop: 3, fontSize: 11.5, lineHeight: 17 }, insightLoading: { flexDirection: 'row', alignItems: 'center', gap: 7 }, insightNote: { marginTop: 6, fontSize: 10, lineHeight: 14 }, insightRetry: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }, retryText: { color: palette.primaryDark, fontSize: 11, fontFamily: fontFamily.semiBold },
  sectionTitle: { marginTop: 19, marginBottom: 8, ...typeScale.cardTitle }, chartCard: { padding: 14, borderRadius: 14 }, bars: { height: 108, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 5 }, barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' }, barValue: { fontSize: 8.5, marginBottom: 4 }, bar: { width: '62%', minWidth: 9, maxWidth: 24, borderRadius: 4 }, barDate: { marginTop: 4, fontSize: 8 }, chartNote: { marginTop: 8, fontSize: 10.5, textAlign: 'center' }, emptyChart: { padding: 18, borderRadius: 14 },
  sleepHistory: { gap: 8 }, sleepNight: { minHeight: 76, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sleepNightDate: { ...typeScale.cardTitle, flex: 1 }, sleepNightReading: { alignItems: 'flex-end', flexShrink: 1 }, sleepNightDuration: { fontSize: 21, fontFamily: fontFamily.bold, fontVariant: ['tabular-nums'] }, sleepNightCaption: { marginTop: 2, fontSize: 10.5, textAlign: 'right' },
  infoSection: { marginTop: 2 }, body: { ...typeScale.body }, caution: { marginTop: 18, padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, cautionText: { flex: 1, ...typeScale.subhead },
});
