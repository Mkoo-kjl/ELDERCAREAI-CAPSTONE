import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useGalaxyWatch } from '@/src/hooks/useGalaxyWatch';
import { latestWatchVital, keepMetricHistory, watchMetrics, type WatchLiveState } from '@/src/lib/galaxy-watch';
import { supabase } from '@/src/lib/supabase';
import type { MeasurementTimes } from '@/src/lib/vital-time';
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
  emergency_contacts?: unknown;
  emergency_contact: string | null;
  emergency_contact_phone: string | null;
  photo_url: string | null;
};

export type VitalLog = {
  stress_score?: number | null;
  stress_baseline_rmssd?: number | null;
  stress_reference_count?: number;
  is_superseded?:boolean;
  measurement_origin?:string|null;
  source_device_id?:string|null;
  source_record_key?:string|null;
  source_revision_at?:string|null;
  id: string;
  elderly_id: string;
  heart_rate_bpm: number | null;
  spo2_percent: number | null;
  hrv_rmssd_ms: number | null;
  skin_temp_celsius: number | null;
  steps_count: number | null;
  steps_day?:string|null;
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
  elderly: ElderlyProfile | null; vital: VitalLog | null; history: VitalLog[]; sleepSessions: SleepSession[];
  loading: boolean; refreshing: boolean; error: string | null;
  syncState: 'idle' | 'syncing' | 'success' | 'error'; lastSuccessfulSyncAt: string | null; newReadingAt: string | null;
  galaxyWatch: WatchLiveState | null; galaxyWatchStatus: string; galaxyHeartRateFresh: boolean; galaxyGpsFresh: boolean;
  refresh: (sync?: boolean, silent?: boolean) => Promise<void>;
};
const HealthDataContext = createContext<ContextValue | null>(null);

export function HealthDataProvider({ children }: PropsWithChildren) {
  const { session, onboarding } = useAuth();
  const userId = session?.user.id;
  const activeUser = useRef(userId); activeUser.current = userId;
  const [elderly, setElderly] = useState<ElderlyProfile | null>(null);
  const [history, setHistory] = useState<VitalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<ContextValue['syncState']>('idle');
  const [newReadingAt, setNewReadingAt] = useState<string | null>(null);
  const revision = useRef(0);
  const generation = useRef(0);
  const galaxy = useGalaxyWatch(elderly?.elderly_id, onboarding?.wearable_status === 'connected' && onboarding?.wearable_provider === 'galaxy_watch');
  const reloadWatch = galaxy.reload;
  const load = useCallback(async () => {
    if (!userId) return;
    const atStart = revision.current;
    const { data: profile, error: profileError } = await supabase.from('elderly_profiles')
      .select('elderly_id, full_name, age, gender, weight_kg, height_cm, blood_type, medical_conditions, medications, emergency_contact, emergency_contact_phone, emergency_contacts, photo_url')
      .eq('caregiver_id', userId).order('created_at').limit(1).maybeSingle();
    if (activeUser.current !== userId) return;
    if (profileError) throw profileError;
    setElderly(profile as ElderlyProfile | null);
    if (!profile) { setHistory([]); return; }
    // Each metric has its own history budget: frequent BPM events cannot evict a spot SpO2 result.
    const results = await Promise.all(watchMetrics.map((metric) => supabase.from('vital_sign_logs').select('*')
      .eq('elderly_id', profile.elderly_id).eq('source', 'galaxy_watch').eq('is_superseded',false).not(metric, 'is', null)
      .order('recorded_at', { ascending: false }).limit(30)));
    if (activeUser.current !== userId) return;
    const failure = results.find((result) => result.error)?.error;
    if (failure) throw failure;
    const rows = results.flatMap((result) => (result.data ?? []) as VitalLog[]);
    setHistory((current) => keepMetricHistory(atStart === revision.current ? rows : [...current, ...rows]));
  }, [userId]);
  const refresh = useCallback(async (_sync = false, silent = false) => {
    if (!silent) { setRefreshing(true); setSyncState('syncing'); }
    try {
      await Promise.all([load(), reloadWatch()]);
      if (activeUser.current !== userId) return;
      setError(null); if (!silent) setSyncState('success');
    } catch (caught) {
      if (activeUser.current !== userId) return;
      setError(caught instanceof Error ? caught.message : 'Unable to load watch readings.');
      if (!silent) setSyncState('error');
    } finally { if (activeUser.current === userId) { setLoading(false); if (!silent) setRefreshing(false); } }
  }, [reloadWatch, load, userId]);
  useEffect(() => {
    activeUser.current = userId;
    revision.current++; setElderly(null); setHistory([]); setError(null); setNewReadingAt(null); setLoading(true);
    void load().catch((caught) => { if (activeUser.current === userId) setError(caught.message); })
      .finally(() => { if (activeUser.current === userId) setLoading(false); });
    return () => { activeUser.current = undefined; };
  }, [load, userId]);
  useEffect(() => {
    const resume = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load().catch((caught) => setError(caught.message));
    });
    return () => resume.remove();
  }, [load]);
  useEffect(() => {
    if (!userId || !elderly?.elderly_id) return;
    let active = true;
    const patient = elderly.elderly_id;
    const channel = supabase.channel(`watch-history:${patient}:${Date.now()}:${++generation.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vital_sign_logs', filter: `elderly_id=eq.${patient}` }, (payload) => {
        if (!active || activeUser.current !== userId) return;
        revision.current++;
        if (payload.eventType === 'DELETE') { void load().catch((caught) => setError(caught.message)); return; }
        const incoming = payload.new as VitalLog;
        if (!incoming?.id || incoming.source !== 'galaxy_watch' || incoming.elderly_id !== patient) return;
        setHistory((current) => incoming.is_superseded?current.filter(row=>row.id!==incoming.id):keepMetricHistory([incoming, ...current]));
        setNewReadingAt(new Date().toISOString());
        // The server creates threshold alerts once so foreground and background
        // delivery share the same rules without duplicate notifications.
      }).subscribe((status, subscriptionError) => {
        if (!active) return;
        if (subscriptionError) setError('History connection interrupted. Pull to refresh.');
        if (status === 'SUBSCRIBED') void load().catch((caught) => setError(caught.message));
      });
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [elderly?.elderly_id, elderly?.full_name, load, userId]);
  const vital = useMemo(() => latestWatchVital(elderly?.elderly_id, galaxy.state, history), [elderly?.elderly_id, galaxy.state, history]);
  const sleepSessions=useMemo(()=>Array.from(new Map(history.flatMap(row=>row.sleep_history??[]).map(session=>[session.source_key,session])).values()),[history]);
  const value = useMemo<ContextValue>(() => ({ elderly, vital, history, sleepSessions, loading, refreshing,
    error: galaxy.error ?? error, syncState, lastSuccessfulSyncAt: galaxy.state?.received_at ?? null, newReadingAt, refresh,
    galaxyWatch: galaxy.state, galaxyWatchStatus: galaxy.status, galaxyHeartRateFresh: galaxy.heartRateFresh, galaxyGpsFresh: galaxy.gpsFresh,
  }), [elderly, error, galaxy.error, galaxy.gpsFresh, galaxy.heartRateFresh, galaxy.state, galaxy.status, history,sleepSessions, loading, newReadingAt, refresh, refreshing, syncState, vital]);
  return <HealthDataContext.Provider value={value}>{children}</HealthDataContext.Provider>;
}
export function useHealthData() {
  const value = useContext(HealthDataContext);
  if (!value) throw new Error('useHealthData must be used inside HealthDataProvider.');
  return value;
}
