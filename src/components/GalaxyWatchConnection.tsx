import { useEffect, useState } from 'react';
import { AppState, Image, StyleSheet, useColorScheme, View } from 'react-native';
import { AppText as Text } from '@/src/components/AppText';
import { GradientButton } from '@/src/components/GradientButton';
import { getFunctionErrorMessage } from '@/src/lib/function-error';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/providers/AuthProvider';
import { getTheme, palette } from '@/src/theme/colors';
import { typeScale } from '@/src/theme/typography';

export function GalaxyWatchConnection({ onConnected }: { onConnected: () => void }) {
  const { session, refreshOnboarding } = useAuth();
  const theme = getTheme(useColorScheme() === 'dark');
  const [pairing, setPairing] = useState<{ code: string; expires_at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!pairing || !session) return;
    let active = true;
    let checking = false;
    const check = async () => {
      if (!active || checking || AppState.currentState !== 'active') return;
      if (Date.now() >= Date.parse(pairing.expires_at)) { setExpired(true); return; }
      checking = true;
      try {
        const { data, error: queryError } = await supabase.from('wearable_devices').select('id').eq('caregiver_id', session.user.id)
          .is('revoked_at', null).gte('paired_at', new Date(Date.parse(pairing.expires_at) - 10 * 60_000).toISOString()).limit(1);
        if (!active) return;
        if (queryError) setError(queryError.message);
        else if (data?.length) { active = false; await refreshOnboarding(); onConnected(); }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : 'Unable to check watch pairing.'); }
      finally { checking = false; }
    };
    const timer = setInterval(() => { void check(); }, 3_000);
    return () => { active = false; clearInterval(timer); };
  }, [onConnected, pairing, refreshOnboarding, session]);
  const pair = async () => {
    setBusy(true); setError(null);
    try {
      const { data, error: functionError } = await supabase.functions.invoke('galaxy-watch', { body: { action: 'pair' } });
      if (functionError) throw functionError;
      if (!data?.code || !data?.expires_at) throw new Error('The pairing code was not returned.');
      setPairing(data); setExpired(false);
    } catch (caught) { setError(await getFunctionErrorMessage(caught, 'Unable to create a watch pairing code.')); }
    finally { setBusy(false); }
  };
  return <View style={[styles.card, { backgroundColor: theme.cardElevated }]}>
    <Image source={require('@/assets/images/galaxy-watch-6.jpg')} resizeMode="contain" accessibilityLabel="Samsung Galaxy Watch6" style={{ width: '100%', height: 190, borderRadius: 12, backgroundColor: '#fff', marginBottom: 14 }} /><Text style={[styles.title, { color: theme.text }]}>Galaxy Watch6</Text>
    <Text style={[styles.body, { color: theme.subtitle }]}>Receive heart rate, skin temperature, estimated RMSSD HRV, monitored steps and location while monitoring is running. Install ElderCareAI Watch, enter the code below, then tap Start monitoring on the watch.</Text>
    <Text style={[styles.body, { color: theme.subtitle }]}>Blood oxygen is a spot measurement started on the watch. Skin temperature and HRV need Samsung sensor access. Sleep is not available from live sensors. Each new vital measurement is saved with its own timestamp.</Text>
    {pairing ? <>
      <Text selectable style={[styles.code, { color: theme.text }]}>{pairing.code}</Text>
      <Text style={[styles.body, { color: theme.subtitle }]}>{expired ? 'Code expired. Generate another code.' : 'Waiting for the watch. Code expires in ten minutes.'}</Text>
    </> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <GradientButton label={pairing ? 'Generate another code' : 'Connect Galaxy Watch'} icon="watch-outline" loading={busy} onPress={() => void pair()} />
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 14, marginBottom: 18 }, title: { ...typeScale.sectionTitle },
  body: { ...typeScale.body, marginTop: 9 }, code: { fontSize: 30, textAlign: 'center', letterSpacing: 5, marginVertical: 12 },
  error: { color: palette.error, marginVertical: 10 },
});
