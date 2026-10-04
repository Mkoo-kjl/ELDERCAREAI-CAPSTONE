import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { relativeTime } from '@/src/lib/format';
import { buildHealthAnomalies, buildHealthInsights, buildHealthPredictions, type AnalysisMetric, type AnalysisResult } from '@/src/lib/health-analysis';
import { useHealthData, type VitalLog } from '@/src/providers/HealthDataProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { fontFamily, typeScale } from '@/src/theme/typography';

type TabName = 'Vitals' | 'AI Insights' | 'Predictions' | 'Anomalies';
const tabs: TabName[] = ['Vitals', 'AI Insights', 'Predictions', 'Anomalies'];

export default function HealthScreen() {
  const insets = useSafeAreaInsets();
  const theme = getTheme(useColorScheme() === 'dark');
  const { vital, history, refreshing, refresh } = useHealthData();
  const [tab, setTab] = useState<TabName>('Vitals');

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}><Text style={[styles.title, { color: theme.text }]}>Health</Text><Text style={[styles.subtitle, { color: theme.subtitle }]}>Synced readings and trends</Text></View>
      <View style={{ height: 46 }}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{tabs.map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, { backgroundColor: tab === item ? palette.aquaSurface : theme.cardElevated, borderColor: tab === item ? palette.aquaSurface : theme.border }]}><Text style={[styles.tabText, { color: tab === item ? palette.text : theme.subtitle }]}>{item}</Text></Pressable>)}</ScrollView></View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} colors={[palette.primary]} />} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 90 }]}>
        {tab === 'Vitals' ? <Vitals vital={vital} /> : null}
        {tab === 'AI Insights' ? <Insights history={history} /> : null}
        {tab === 'Predictions' ? <Predictions history={history} /> : null}
        {tab === 'Anomalies' ? <Anomalies history={history} /> : null}
      </ScrollView>
    </View>
  );
}

const metricDefinitions = [
  ['heart', 'Heart Rate', 'heart_rate_bpm', 'bpm', palette.error], ['water', 'Blood Oxygen', 'spo2_percent', '%', palette.primaryDark],
  ['thermometer', 'Overnight Skin Temp', 'skin_temp_celsius', '°C', palette.warning], ['leaf', 'Heart Rate Variability', 'hrv_rmssd_ms', 'ms', palette.pink],
  ['moon', 'Sleep', 'sleep_hours', 'hours', palette.purple], ['footsteps', 'Steps', 'steps_count', 'steps', palette.accentDark],
] as const;

function Vitals({ vital }: { vital: VitalLog | null }) {
  const isDark = useColorScheme() === 'dark';
  const theme = getTheme(isDark);
  const surfaces = [palette.lemonSurface, palette.aquaSurface, palette.peachSurface, palette.lavenderSurface, palette.lavenderSurface, palette.mintSurface];
  return <View style={styles.list}>{metricDefinitions.map(([icon, label, key, unit, color], index) => { const raw = vital?.[key]; const value = typeof raw === 'number' ? (key === 'steps_count' ? raw.toLocaleString() : raw.toFixed(key === 'spo2_percent' || key === 'skin_temp_celsius' || key === 'sleep_hours' ? 1 : 0)) : '--'; return <View key={label} style={[styles.metricRow, { backgroundColor: isDark ? theme.cardElevated : surfaces[index], borderColor: theme.border }]}><View style={[styles.metricIcon, { backgroundColor: theme.cardElevated }]}><Ionicons name={icon} size={19} color={color} /></View><View style={styles.metricCopy}><Text style={[styles.metricLabel, { color: theme.text }]}>{label}</Text><Text style={[styles.metricTime, { color: theme.subtitle }]}>{relativeTime(vital?.synced_at ?? vital?.recorded_at)}</Text></View><Text style={[styles.metricValue, { color: theme.text }]}>{value} <Text style={[styles.metricUnit, { color: theme.subtitle }]}>{unit}</Text></Text></View>; })}</View>;
}

function Insights({ history }: { history: VitalLog[] }) {
  const theme = getTheme(useColorScheme() === 'dark');
  const cards = buildHealthInsights(history);
  return <><View style={[styles.disclaimer, { backgroundColor: `${palette.primary}12` }]}><Ionicons name="analytics-outline" size={20} color={palette.primaryDark} /><Text style={[styles.disclaimerText, { color: theme.text }]}><Text style={{ fontWeight: '800' }}>Personalized analysis:</Text> Insights compare synchronized readings with recent history. They are statistical summaries, not a diagnosis or trained clinical model.</Text></View>{cards.map((card) => <AnalysisCard key={card.id} item={card} />)}</>;
}

function Predictions({ history }: { history: VitalLog[] }) {
  const theme = getTheme(useColorScheme() === 'dark');
  const cards = buildHealthPredictions(history);
  return <><View style={[styles.disclaimer, { backgroundColor: `${palette.purple}12` }]}><Ionicons name="trending-up-outline" size={20} color={palette.purple} /><Text style={[styles.disclaimerText, { color: theme.text }]}>Trend projections use linear regression over recent distinct readings. Confidence reflects sample count and fit; these are not clinical forecasts.</Text></View>{cards.map((card) => <AnalysisCard key={card.id} item={card} />)}</>;
}

function Anomalies({ history }: { history: VitalLog[] }) {
  const theme = getTheme(useColorScheme() === 'dark');
  const anomalies = buildHealthAnomalies(history);
  return <><View style={[styles.disclaimer, { backgroundColor: `${palette.warning}12` }]}><Ionicons name="shield-checkmark-outline" size={20} color={palette.warning} /><Text style={[styles.disclaimerText, { color: theme.text }]}>Anomalies combine review thresholds with personal-baseline deviation when enough history exists. Wearable readings should be confirmed when symptoms or concerns are present.</Text></View>{anomalies.map((item) => <AnalysisCard key={item.id} item={item} />)}</>;
}

const analysisVisuals: Record<AnalysisMetric, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  heart: { icon: 'heart-outline', color: palette.error }, oxygen: { icon: 'water-outline', color: palette.primaryDark }, sleep: { icon: 'moon-outline', color: palette.purple },
  steps: { icon: 'footsteps-outline', color: palette.accentDark }, temperature: { icon: 'thermometer-outline', color: palette.warning }, hrv: { icon: 'leaf-outline', color: palette.pink }, data: { icon: 'analytics-outline', color: palette.primaryDark },
};
function AnalysisCard({ item }: { item: AnalysisResult }) { const theme = getTheme(useColorScheme() === 'dark'); const visual = analysisVisuals[item.metric]; const severityColor = item.severity === 'critical' ? palette.error : item.severity === 'warning' ? palette.warning : item.severity === 'positive' ? palette.accentDark : visual.color; return <View style={[styles.insight, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}><View style={[styles.insightIcon, { backgroundColor: `${severityColor}16` }]}><Ionicons name={visual.icon} size={23} color={severityColor} /></View><View style={styles.insightCopy}><View style={styles.insightTitleRow}><Text style={[styles.insightTitle, { color: theme.text }]}>{item.title}</Text>{item.confidence ? <Text style={[styles.confidence, { color: severityColor, backgroundColor: `${severityColor}14` }]}>{item.confidence}</Text> : null}</View><Text style={[styles.insightBody, { color: theme.subtitle }]}>{item.body}</Text></View></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14 }, title: { ...typeScale.screenTitle }, subtitle: { marginTop: 3, fontSize: 12, lineHeight: 18 },
  tabs: { paddingHorizontal: 18, gap: 7 }, tab: { height: 35, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, tabText: { fontSize: 11, fontFamily: fontFamily.medium },
  content: { padding: 18 }, list: { gap: 8 }, metricRow: { minHeight: 72, borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center' }, metricIcon: { width: 38, height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, metricCopy: { flex: 1, marginLeft: 11 }, metricLabel: { fontSize: 12.5, fontFamily: fontFamily.semiBold }, metricTime: { marginTop: 3, fontSize: 10 }, metricValue: { fontSize: 18, fontFamily: fontFamily.semiBold, fontVariant: ['tabular-nums'] }, metricUnit: { fontSize: 10, fontFamily: fontFamily.medium },
  disclaimer: { marginBottom: 13, padding: 14, borderRadius: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, disclaimerText: { flex: 1, fontSize: 12, lineHeight: 18 }, insight: { marginBottom: 8, padding: 14, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start' }, insightIcon: { width: 39, height: 39, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, insightCopy: { flex: 1, marginLeft: 11 }, insightTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 }, insightTitle: { flex: 1, fontSize: 13.5, fontFamily: fontFamily.semiBold }, insightBody: { marginTop: 5, fontSize: 12, lineHeight: 18 }, confidence: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, overflow: 'hidden', fontSize: 9, fontFamily: fontFamily.medium },
});
