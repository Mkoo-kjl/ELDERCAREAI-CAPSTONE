import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

type Json = Record<string, any>;

async function refreshGoogleToken(token: Json, clientId: string, clientSecret: string) {
  const expiresAt = token.token_expires_at ? new Date(token.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return token.google_access_token as string;
  if (!token.google_refresh_token) throw new Error('Google Health authorization expired. Reconnect Google Health.');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.google_refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description ?? 'Unable to refresh Google Health access.');
  return { accessToken: data.access_token as string, expiresIn: Number(data.expires_in ?? 3600) };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const clientId = Deno.env.get('GOOGLE_HEALTH_CLIENT_ID') ?? Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_HEALTH_CLIENT_SECRET') ?? Deno.env.get('GOOGLE_CLIENT_SECRET');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !clientId || !clientSecret) return json({ error: 'Server configuration is incomplete.' }, 500);
  if (!authorization) return json({ error: 'Authentication required.' }, 401);

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Invalid user session.' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const [{ data: token }, { data: elderly }] = await Promise.all([
    admin.from('google_health_tokens').select('*').eq('user_id', userData.user.id).maybeSingle(),
    admin.from('elderly_profiles').select('elderly_id').eq('caregiver_id', userData.user.id).order('created_at').limit(1).maybeSingle(),
  ]);
  if (!token) return json({ error: 'Google Health is not connected.', code: 'NOT_CONNECTED' }, 409);
  if (!elderly) return json({ error: 'Complete the older adult profile first.' }, 409);

  try {
    const refreshed = await refreshGoogleToken(token, clientId, clientSecret);
    const accessToken = typeof refreshed === 'string' ? refreshed : refreshed.accessToken;
    if (typeof refreshed !== 'string') {
      await admin.from('google_health_tokens').update({
        google_access_token: accessToken,
        token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('user_id', userData.user.id);
    }

    const getPoints = async (dataType: string, filter?: string, pageSize = 1) => {
      const url = new URL(`https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints`);
      url.searchParams.set('pageSize', String(pageSize));
      if (filter) url.searchParams.set('filter', filter);
      const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        return {
          dataPoints: [],
          warning: {
            dataType,
            status: response.status,
            message: failure?.error?.message ?? `Google Health returned HTTP ${response.status}.`,
          },
        };
      }
      return await response.json();
    };

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [heart, oxygen, dailyOxygen, sleep, steps, temperature, hrv] = await Promise.all([
      getPoints('heart-rate'),
      getPoints('oxygen-saturation'),
      getPoints('daily-oxygen-saturation'),
      getPoints('sleep'),
      getPoints('steps', `steps.interval.start_time >= "${since}"`, 10000),
      getPoints('daily-sleep-temperature-derivations'),
      getPoints('heart-rate-variability'),
    ]);

    const heartRate = Number(heart.dataPoints?.[0]?.heartRate?.beatsPerMinute) || null;
    const spo2 = Number(oxygen.dataPoints?.[0]?.oxygenSaturation?.percentage)
      || Number(dailyOxygen.dataPoints?.[0]?.dailyOxygenSaturation?.averagePercentage)
      || null;
    const sleepPoint = sleep.dataPoints?.[0]?.sleep;
    const sleepMinutes = Number(sleepPoint?.summary?.minutesAsleep)
      || (sleepPoint?.interval?.startTime && sleepPoint?.interval?.endTime
        ? (new Date(sleepPoint.interval.endTime).getTime() - new Date(sleepPoint.interval.startTime).getTime()) / 60000
        : 0);
    const stepCount = (steps.dataPoints ?? []).reduce((sum: number, point: Json) => sum + (Number(point.steps?.count) || 0), 0) || null;
    const skinTemp = Number(temperature.dataPoints?.[0]?.dailySleepTemperatureDerivations?.nightlyTemperatureCelsius) || null;
    const rmssd = Number(hrv.dataPoints?.[0]?.heartRateVariability?.rootMeanSquareOfSuccessiveDifferencesMilliseconds) || null;
    const stressScore = rmssd === null ? null : rmssd >= 50 ? 25 : rmssd >= 30 ? 50 : 75;
    const riskScore = Math.min(100, (heartRate && heartRate > 100 ? 25 : 0) + (spo2 && spo2 < 95 ? 45 : 0) + (sleepMinutes && sleepMinutes < 360 ? 20 : 0));
    const status = riskScore >= 45 ? 'warning' : 'normal';

    const warnings = [heart, oxygen, dailyOxygen, sleep, steps, temperature, hrv]
      .map((result) => result.warning)
      .filter(Boolean);
    const hasData = [heartRate, spo2, sleepMinutes, stepCount, skinTemp, rmssd]
      .some((value) => typeof value === 'number' && Number.isFinite(value));
    if (!hasData) {
      return json({
        error: warnings.length
          ? 'Google Health did not return any readable vitals. Review the API/scopes details below.'
          : 'Google Health is connected, but no readings are available yet. Open the Fitbit app and synchronize the Inspire 3, then try again.',
        code: warnings.length ? 'GOOGLE_HEALTH_API_ERROR' : 'NO_HEALTH_DATA',
        details: warnings,
      }, 422);
    }

    const log = {
      elderly_id: elderly.elderly_id,
      heart_rate_bpm: heartRate,
      spo2_percent: spo2,
      stress_score: stressScore,
      skin_temp_celsius: skinTemp,
      steps_count: stepCount,
      sleep_hours: sleepMinutes ? Math.round((sleepMinutes / 60) * 10) / 10 : null,
      overall_status: status,
      ai_risk_score: riskScore,
      source: 'google_health_v4',
      recorded_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    };
    const { data: latest } = await admin.from('vital_sign_logs')
      .select('*')
      .eq('elderly_id', elderly.elderly_id)
      .eq('source', 'google_health_v4')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const metricKeys = ['heart_rate_bpm', 'spo2_percent', 'stress_score', 'skin_temp_celsius', 'steps_count', 'sleep_hours'] as const;
    const unchanged = latest && metricKeys.every((key) => latest[key] === log[key]);
    const saveQuery = unchanged
      ? admin.from('vital_sign_logs').update({ synced_at: log.synced_at }).eq('id', latest.id)
      : admin.from('vital_sign_logs').insert(log);
    const { data: saved, error: saveError } = await saveQuery.select().single();
    if (saveError) throw saveError;
    return json({ vital: saved, hasData: true, changed: !unchanged, warnings });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Google Health synchronization failed.' }, 500);
  }
});
