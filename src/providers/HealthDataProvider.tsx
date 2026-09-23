import * as Location from 'expo-location';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getFunctionErrorMessage } from '@/src/lib/function-error';
import { supabase } from '@/src/lib/supabase';
import { notifyAbnormalVital } from '@/src/lib/notifications';
import { useAuth } from '@/src/providers/AuthProvider';

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
  stress_score: number | null;
  skin_temp_celsius: number | null;
  steps_count: number | null;
  sleep_hours: number | null;
  overall_status: string | null;
  ai_risk_score: number | null;
  source: string | null;
  recorded_at: string;
  synced_at: string | null;
};

type ContextValue = {
  elderly: ElderlyProfile | null;
  vital: VitalLog | null;
  history: VitalLog[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  syncState: 'idle' | 'syncing' | 'success' | 'error';
  lastSuccessfulSyncAt: string | null;
  newReadingAt: string | null;
  refresh: (sync?: boolean) => Promise<void>;
};

const HealthDataContext = createContext<ContextValue | null>(null);

export function HealthDataProvider({ children }: PropsWithChildren) {
  const { session, onboarding } = useAuth();
  const userId = session?.user.id;
  const [elderly, setElderly] = useState<ElderlyProfile | null>(null);
  const [history, setHistory] = useState<VitalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<ContextValue['syncState']>('idle');
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<string | null>(null);
  const [newReadingAt, setNewReadingAt] = useState<string | null>(null);
  const syncInFlight = useRef(false);
  const refreshRef = useRef<(sync?: boolean) => Promise<void>>(async () => undefined);
  const realtimeInstanceId = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const realtimeGeneration = useRef(0);

  const load = useCallback(async () => {
    if (!session) return;
    const { data: profile, error: profileError } = await supabase.from('elderly_profiles')
      .select('elderly_id, full_name, age, gender, weight_kg, height_cm, blood_type, medical_conditions, medications, emergency_contact, emergency_contact_phone, photo_url')
      .eq('caregiver_id', session.user.id).order('created_at').limit(1).maybeSingle();
    if (profileError) throw profileError;
    setElderly(profile as ElderlyProfile | null);
    if (!profile) {
      setHistory([]);
      return;
    }
    const { data: logs, error: logsError } = await supabase.from('vital_sign_logs')
      .select('*').eq('elderly_id', profile.elderly_id).order('recorded_at', { ascending: false }).limit(30);
    if (logsError) throw logsError;
    const typedLogs = (logs as VitalLog[]) ?? [];
    setHistory(typedLogs);
    if (typedLogs[0]) setLastSuccessfulSyncAt((current) => current ?? typedLogs[0].synced_at ?? typedLogs[0].recorded_at);
  }, [session]);

  const recordSyncLocation = useCallback(async () => {
    if (!session || !elderly || onboarding?.location_permission !== 'granted') return;
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return;
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await supabase.from('wearable_sync_locations').insert({
      user_id: session.user.id,
      elderly_id: elderly.elderly_id,
      event_type: 'health_sync',
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy_m: position.coords.accuracy,
      recorded_at: new Date(position.timestamp).toISOString(),
    });
  }, [elderly, onboarding?.location_permission, session]);

  const refresh = useCallback(async (sync = false) => {
    const authorized = onboarding?.wearable_status === 'connected' || onboarding?.wearable_status === 'authorized_no_device';
    if (sync && authorized && syncInFlight.current) return;
    let startedSync = false;
    setRefreshing(true);
    if (sync && authorized) setSyncState('syncing');
    setError(null);
    try {
      if (sync && authorized) {
        syncInFlight.current = true;
        startedSync = true;
        const { data: syncData, error: syncError } = await supabase.functions.invoke<{ vital?: VitalLog }>('google-health-sync');
        if (syncError) throw syncError;
        if (syncData?.vital && elderly) await notifyAbnormalVital(syncData.vital, elderly.full_name);
        await recordSyncLocation();
        const completedAt = new Date().toISOString();
        setLastSuccessfulSyncAt(completedAt);
        setSyncState('success');
      }
      await load();
    } catch (caught) {
      setError(await getFunctionErrorMessage(caught, 'Unable to refresh health data.'));
      if (sync) setSyncState('error');
    } finally {
      if (startedSync) syncInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [elderly, load, onboarding?.wearable_status, recordSyncLocation]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

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
          setNewReadingAt(new Date().toISOString());
          if (payload.eventType !== 'DELETE') setLastSuccessfulSyncAt(new Date().toISOString());
          void load();
        })
        .subscribe((status, subscriptionError) => {
          if (subscriptionError) console.warn(`Vital-sign Realtime ${status}:`, subscriptionError.message);
        });
    } catch (subscriptionError) {
      // Polling and manual synchronization remain available if Realtime cannot
      // start, so a socket problem must not interrupt Google Health OAuth/sync.
      console.warn('Unable to start vital-sign Realtime:', subscriptionError);
    }
    return () => {
      void supabase.removeChannel(channel).catch((removalError) => {
        console.warn('Unable to remove vital-sign Realtime channel:', removalError);
      });
    };
  }, [elderly?.elderly_id, load, userId]);

  useEffect(() => {
    const authorized = onboarding?.wearable_status === 'connected' || onboarding?.wearable_status === 'authorized_no_device';
    if (!session || !authorized) return;
    let active = AppState.currentState === 'active';
    const synchronize = () => { if (active) void refreshRef.current(true); };
    synchronize();
    const timer = setInterval(synchronize, 60_000);
    const subscription = AppState.addEventListener('change', (state) => {
      const wasActive = active;
      active = state === 'active';
      if (active && !wasActive) synchronize();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [onboarding?.wearable_status, session]);

  const value = useMemo(() => ({ elderly, vital: history[0] ?? null, history, loading, refreshing, error, syncState, lastSuccessfulSyncAt, newReadingAt, refresh }), [elderly, error, history, lastSuccessfulSyncAt, loading, newReadingAt, refresh, refreshing, syncState]);
  return <HealthDataContext.Provider value={value}>{children}</HealthDataContext.Provider>;
}

export function useHealthData() {
  const value = useContext(HealthDataContext);
  if (!value) throw new Error('useHealthData must be used inside HealthDataProvider.');
  return value;
}
