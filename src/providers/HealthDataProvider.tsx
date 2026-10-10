import * as Location from 'expo-location';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { automaticHealthSyncDue } from '@/src/lib/automatic-health-sync';
import { getFunctionErrorMessage } from '@/src/lib/function-error';
import { supabase } from '@/src/lib/supabase';
import { notifyAbnormalVital } from '@/src/lib/notifications';
import type { MeasurementTimes } from '@/src/lib/vital-time';
import type { WatchSyncIssue } from '@/supabase/functions/_shared/google-health-sync';
import { useAuth } from '@/src/providers/AuthProvider';

export type WatchSyncStatus = {
  deviceVersion: string | null;
  lastSyncTime: string | null;
};

export type ElderlyProfile = {
  elderly_id: string;
  full_name: string;
  age: number | null;
  gender: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  blood_type: string | null;
  medical_conditions: string | null;
  medications: string | null;
  emergency_contact: string | null;
  emergency_contact_phone: string | null;
  photo_url: string | null;
};

export type VitalLog = {
  id: string;
  elderly_id: string;
  heart_rate_bpm: number | null;
  spo2_percent: number | null;
  hrv_rmssd_ms: number | null;
  skin_temp_celsius: number | null;
  steps_count: number | null;
  sleep_hours: number | null;
  overall_status: string | null;
  ai_risk_score: number | null;
  source: string | null;
  recorded_at: string;
  synced_at: string | null;
  measurement_times?: MeasurementTimes | null;
  sleep_history?: SleepSession[] | null;
};

export type SleepSession = {
  source_key: string;
  session_start_at: string;
  session_end_at: string;
  minutes_asleep: number;
  minutes_in_sleep_period: number | null;
  is_main_sleep: boolean;
  is_processed: boolean;
};

type ContextValue = {
  elderly: ElderlyProfile | null;
  vital: VitalLog | null;
  history: VitalLog[];
  sleepSessions: SleepSession[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  syncState: 'idle' | 'syncing' | 'success' | 'error';
  lastSuccessfulSyncAt: string | null;
  lastGoogleHealthCheckAt: string | null;
  watchSync: WatchSyncStatus | null;
  watchSyncIssue: WatchSyncIssue;
  newReadingAt: string | null;
  refresh: (sync?: boolean, silent?: boolean) => Promise<void>;
};

const HealthDataContext = createContext<ContextValue | null>(null);
const SYNC_SCHEDULE_TICK_MS = 15 * 1000;

export function HealthDataProvider({ children }: PropsWithChildren) {
  const { session, onboarding } = useAuth();
  const userId = session?.user.id;
  const [elderly, setElderly] = useState<ElderlyProfile | null>(null);
  const [history, setHistory] = useState<VitalLog[]>([]);
  const [sleepSessions, setSleepSessions] = useState<SleepSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<ContextValue['syncState']>('idle');
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<string | null>(null);
  const [lastGoogleHealthCheckAt, setLastGoogleHealthCheckAt] = useState<string | null>(null);
  const [watchSync, setWatchSync] = useState<WatchSyncStatus | null>(null);
  const [watchSyncIssue, setWatchSyncIssue] = useState<WatchSyncIssue>(null);
  const [newReadingAt, setNewReadingAt] = useState<string | null>(null);
  const syncInFlight = useRef(false);
  const lastSyncAttemptAt = useRef(0);
  const lastSyncAttemptFailed = useRef(false);
  const lastSuccessfulSyncAtRef = useRef<string | null>(null);
  const watchLastSyncAtRef = useRef<string | null>(null);
  const heartMeasuredAtRef = useRef<string | null>(null);
  const realtimeInstanceId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const realtimeGeneration = useRef(0);
  const realtimeRevision = useRef(0);

  const load = useCallback(async () => {
    if (!userId) return;
    const revisionAtStart = realtimeRevision.current;
    const { data: profile, error: profileError } = await supabase.from('elderly_profiles')
      .select('elderly_id, full_name, age, gender, weight_kg, height_cm, blood_type, medical_conditions, medications, emergency_contact, emergency_contact_phone, photo_url')
      .eq('caregiver_id', userId).order('created_at').limit(1).maybeSingle();
    if (profileError) throw profileError;
    setElderly(profile as ElderlyProfile | null);
    if (!profile) {
      setHistory([]);
      setSleepSessions([]);
      return;
    }
    const { data: logs, error: logsError } = await supabase.from('vital_sign_logs')
      .select('*').eq('elderly_id', profile.elderly_id).order('synced_at', { ascending: false, nullsFirst: false }).order('recorded_at', { ascending: false }).limit(30);
    if (logsError) throw logsError;
    const typedLogs = (logs as VitalLog[]) ?? [];
    if (revisionAtStart === realtimeRevision.current) setHistory(typedLogs);
    if (typedLogs[0]) setLastSuccessfulSyncAt((current) => current ?? typedLogs[0].synced_at ?? typedLogs[0].recorded_at);
    const savedSleep = typedLogs.find((row) => row.source === 'google_health_v4' && Array.isArray(row.sleep_history))?.sleep_history;
    if (revisionAtStart === realtimeRevision.current) setSleepSessions(savedSleep ?? []);
  }, [userId]);

  const recordSyncLocation = useCallback(async () => {
    if (!userId || !elderly?.elderly_id || onboarding?.location_permission !== 'granted') return;
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return;
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await supabase.from('wearable_sync_locations').insert({
      user_id: userId,
      elderly_id: elderly.elderly_id,
      event_type: 'health_sync',
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_m: position.coords.accuracy,
      recorded_at: new Date(position.timestamp).toISOString(),
    });
  }, [elderly?.elderly_id, onboarding?.location_permission, userId]);

  const refresh = useCallback(async (sync = false, silent = false) => {
    const authorized = onboarding?.wearable_status === 'connected' || onboarding?.wearable_status === 'authorized_no_device';
    if (sync && authorized && syncInFlight.current) return;
    let startedSync = false;
    if (!silent) {
      setRefreshing(true);
      if (sync && authorized) setSyncState('syncing');
      setError(null);
    }
    try {
      if (sync && authorized) {
        syncInFlight.current = true;
        startedSync = true;
        lastSyncAttemptAt.current = Date.now();
        const { data: syncData, error: syncError } = await supabase.functions.invoke<{ vital?: VitalLog; changed?: boolean; checkedAt?: string; watchSync?: WatchSyncStatus | null; watchSyncIssue?: WatchSyncIssue }>('google-health-sync');
        if (syncError) throw syncError;
        if (syncData?.changed && syncData.vital && elderly?.full_name) {
          void notifyAbnormalVital(syncData.vital, elderly.full_name).catch((notificationError) => {
            console.warn('Unable to show health-reading notification:', notificationError);
          });
        }
        if (!silent) await recordSyncLocation();
        const checkedAt = syncData?.checkedAt ?? new Date().toISOString();
        lastSuccessfulSyncAtRef.current = checkedAt;
        watchLastSyncAtRef.current = syncData?.watchSync?.lastSyncTime ?? null;
        setLastSuccessfulSyncAt(checkedAt);
        setLastGoogleHealthCheckAt(checkedAt);
        setWatchSync(syncData?.watchSync ?? null);
        setWatchSyncIssue(syncData?.watchSyncIssue ?? null);
        if (!silent) setSyncState('success');
      }
      await load();
      if (startedSync) lastSyncAttemptFailed.current = false;
      setError(null);
    } catch (caught) {
      if (startedSync) lastSyncAttemptFailed.current = true;
      setError(await getFunctionErrorMessage(caught, 'Unable to refresh health data.'));
      if (sync && !silent) setSyncState('error');
    } finally {
      if (startedSync) syncInFlight.current = false;
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, [elderly?.full_name, load, onboarding?.wearable_status, recordSyncLocation]);
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => { lastSuccessfulSyncAtRef.current = lastSuccessfulSyncAt; }, [lastSuccessfulSyncAt]);
  useEffect(() => { watchLastSyncAtRef.current = watchSync?.lastSyncTime ?? null; }, [watchSync?.lastSyncTime]);
  useEffect(() => { heartMeasuredAtRef.current = history[0]?.measurement_times?.heart_rate_bpm ?? null; }, [history]);

  useEffect(() => {
    setSleepSessions([]);
    setWatchSync(null);
    setWatchSyncIssue(null);
    setLastSuccessfulSyncAt(null);
    setLastGoogleHealthCheckAt(null);
    lastSuccessfulSyncAtRef.current = null;
    watchLastSyncAtRef.current = null;
    heartMeasuredAtRef.current = null;
    lastSyncAttemptAt.current = 0;
    lastSyncAttemptFailed.current = false;
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load health data.'))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!userId || !elderly?.elderly_id) return;
    // RealtimeClient.channel() reuses a matching topic. OAuth/session refreshes can
    // rerun this effect before the previous async removal finishes, so every
    // subscription lifecycle receives a unique topic and can never inherit an
    // already-subscribed channel.
    const generation = ++realtimeGeneration.current;
    const topic = `vital-signs:${elderly.elderly_id}:${realtimeInstanceId.current}:${generation}`;
    const channel = supabase.channel(topic);
    try {
      channel
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'vital_sign_logs', filter: `elderly_id=eq.${elderly.elderly_id}`,
        }, (payload) => {
          realtimeRevision.current += 1;
          if (payload.eventType === 'DELETE') {
            void load();
            return;
          }
          const incoming = payload.new as VitalLog;
          if (!incoming?.id) return;
          setHistory((current) => [incoming, ...current.filter((row) => row.id !== incoming.id)]
            .sort((left, right) => new Date(right.synced_at ?? right.recorded_at).getTime() - new Date(left.synced_at ?? left.recorded_at).getTime())
            .slice(0, 30));
          if (incoming.source === 'google_health_v4' && Array.isArray(incoming.sleep_history)) setSleepSessions(incoming.sleep_history);
          setNewReadingAt(new Date().toISOString());
          if (incoming.synced_at) setLastSuccessfulSyncAt(incoming.synced_at);
          void notifyAbnormalVital(incoming, elderly.full_name).catch((notificationError) => {
            console.warn('Unable to show health-reading notification:', notificationError);
          });
        })
        .subscribe((status, subscriptionError) => {
          if (subscriptionError) console.warn(`Vital-sign Realtime ${status}:`, subscriptionError.message);
          if (status === 'SUBSCRIBED') void load();
        });
    } catch (subscriptionError) {
      // A foreground database reload and manual sync remain available if the
      // Realtime socket cannot start.
      console.warn('Unable to start vital-sign Realtime:', subscriptionError);
    }
    return () => {
      void supabase.removeChannel(channel).catch((removalError) => {
        console.warn('Unable to remove vital-sign Realtime channel:', removalError);
      });
    };
  }, [elderly?.elderly_id, elderly?.full_name, load, userId]);

  useEffect(() => {
    if (!userId) return;
    const authorized = onboarding?.wearable_status === 'connected' || onboarding?.wearable_status === 'authorized_no_device';
    let active = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    if (authorized) void refreshRef.current(true, true);
    const timer = setInterval(() => {
      if (authorized && automaticHealthSyncDue({
        now: Date.now(),
        watchLastSyncAt: watchLastSyncAtRef.current,
        heartMeasuredAt: heartMeasuredAtRef.current,
        lastCheckedAt: lastSuccessfulSyncAtRef.current,
        lastAttemptAt: lastSyncAttemptAt.current,
        lastAttemptFailed: lastSyncAttemptFailed.current,
      })) {
        void refreshRef.current(true, true);
      }
    }, SYNC_SCHEDULE_TICK_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      const wasActive = active;
      active = state === 'active';
      if (active && !wasActive) {
        if (authorized) void refreshRef.current(true, true);
        else void load().catch((caught) => {
          setError(caught instanceof Error ? caught.message : 'Unable to load health data.');
        });
      }
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [load, onboarding?.wearable_status, userId]);

  const value = useMemo(() => ({ elderly, vital: history[0] ?? null, history, sleepSessions, loading, refreshing, error, syncState, lastSuccessfulSyncAt, lastGoogleHealthCheckAt, watchSync, watchSyncIssue, newReadingAt, refresh }), [elderly, error, history, sleepSessions, lastSuccessfulSyncAt, lastGoogleHealthCheckAt, loading, newReadingAt, refresh, refreshing, syncState, watchSync, watchSyncIssue]);
  return <HealthDataContext.Provider value={value}>{children}</HealthDataContext.Provider>;
}

export function useHealthData() {
  const value = useContext(HealthDataContext);
  if (!value) throw new Error('useHealthData must be used inside HealthDataProvider.');
  return value;
}
