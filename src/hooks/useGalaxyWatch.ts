import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import { watchMapPosition, watchLiveLabel, watchReadingFresh, type WatchLiveState } from '@/src/lib/galaxy-watch';

export function useGalaxyWatch(elderlyId: string | undefined, enabled: boolean) {
  const [state, setState] = useState<WatchLiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const revision = useRef(0);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const reload = useCallback(async () => {
    if (!enabled || !elderlyId) return;
    if (inFlight.current) return;
    inFlight.current = true;
    const version = revision.current;
    try {
      const { data, error: queryError } = await supabase.from('wearable_live_state').select('*').eq('elderly_id', elderlyId).maybeSingle();
      if (version !== revision.current) return;
      if (queryError) setError(queryError.message);
      else { setState(data as WatchLiveState | null); setError(null); }
    } catch { if (version === revision.current) setError('Watch data could not refresh. Retrying automatically.'); }
    finally { inFlight.current = false; }

  }, [elderlyId, enabled]);
  useEffect(() => {
    revision.current += 1;
    setState(null); setError(null);
    if (!enabled || !elderlyId) return;
    const channel = supabase.channel(`watch-live:${elderlyId}:${Date.now()}:${++generation.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wearable_live_state', filter: `elderly_id=eq.${elderlyId}` }, (payload) => {
        if (payload.eventType === 'DELETE' && payload.old.elderly_id !== elderlyId) return;
        revision.current += 1;
        setState(payload.eventType === 'DELETE' ? null : payload.new as WatchLiveState);
        setError(null);
      }).subscribe((status, subscriptionError) => {
        if (subscriptionError) setError('Live connection interrupted. Showing the last received readings.');
        if (status === 'SUBSCRIBED') void reload();
      });
    void reload();
    const resume = AppState.addEventListener('change', (status) => { if (status === 'active') void reload(); });
    const clock = setInterval(() => setNow(Date.now()), 1_000);
    const reconcile = setInterval(() => { if (AppState.currentState === 'active') void reload(); }, 5_000);
    return () => {
      revision.current += 1;
      resume.remove(); clearInterval(clock); clearInterval(reconcile);
      void supabase.removeChannel(channel);
    };
  }, [elderlyId, enabled, reload]);
  const live = enabled && state?.elderly_id === elderlyId ? state : null;
  return { state: live, error, reload, status: watchLiveLabel(live, now),
    heartRateFresh: Boolean(live?.monitoring && watchReadingFresh(live.status_at, now, 30_000) && watchReadingFresh(live.received_at, now, 30_000) && watchReadingFresh(live.heart_rate_measured_at, now, 30_000)),
    gpsFresh: Boolean(watchMapPosition(live) && live?.monitoring && watchReadingFresh(live.status_at, now, 30_000) && watchReadingFresh(live.received_at, now, 30_000) && watchReadingFresh(live.gps_measured_at, now, 15_000)),
  };
}
