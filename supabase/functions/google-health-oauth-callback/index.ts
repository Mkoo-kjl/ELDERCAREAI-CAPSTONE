import { createClient } from 'npm:@supabase/supabase-js@2';
import { syncGoogleHealthForUser } from '../_shared/google-health-sync.ts';

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { Location: location } });
}

function withResult(appRedirectUri: string, values: Record<string, string>) {
  const url = new URL(appRedirectUri);
  Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

Deno.serve(async (request) => {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get('state');
  const code = requestUrl.searchParams.get('code');
  const oauthError = requestUrl.searchParams.get('error');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const clientId = Deno.env.get('GOOGLE_HEALTH_CLIENT_ID') ?? Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_HEALTH_CLIENT_SECRET') ?? Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret || !state) {
    return new Response('Invalid or incomplete OAuth callback.', { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: oauthState, error: stateError } = await admin
    .from('google_health_oauth_states')
    .select('*')
    .eq('state', state)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (stateError || !oauthState) return new Response('OAuth state is invalid or expired.', { status: 400 });
  await admin.from('google_health_oauth_states').delete().eq('state', state);

  if (oauthError || !code) {
    return redirect(withResult(oauthState.app_redirect_uri, {
      error: oauthError ?? 'authorization_cancelled',
    }));
  }

  try {
    const callbackUri = `${supabaseUrl}/functions/v1/google-health-oauth-callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUri,
        grant_type: 'authorization_code',
        code_verifier: oauthState.code_verifier,
      }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description ?? tokenData.error ?? 'Token exchange failed.');
    }

    // Validate the granted token against the v4 API and capture the Google
    // Health user identifier. This is a real service call, not a demo flag.
    const identityResponse = await fetch('https://health.googleapis.com/v4/users/me/identity', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const identity = await identityResponse.json();
    if (!identityResponse.ok || !identity.healthUserId) {
      throw new Error(identity.error?.message ?? 'Google Health identity validation failed.');
    }

    // The settings scope allows this v4 call to verify whether an Inspire 3
    // or another supported Fitbit/Pixel device is paired to the account.
    const devicesResponse = await fetch('https://health.googleapis.com/v4/users/me/pairedDevices?pageSize=100', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const devices = devicesResponse.ok ? await devicesResponse.json() : { pairedDevices: [] };

    const { data: existingToken } = await admin.from('google_health_tokens')
      .select('google_refresh_token')
      .eq('user_id', oauthState.user_id)
      .maybeSingle();
    const deviceCount = Number(devices.pairedDevices?.length ?? 0);

    const { error: tokenError } = await admin.from('google_health_tokens').upsert({
      user_id: oauthState.user_id,
      google_access_token: tokenData.access_token,
      google_refresh_token: tokenData.refresh_token ?? existingToken?.google_refresh_token ?? null,
      token_expires_at: new Date(Date.now() + Number(tokenData.expires_in ?? 3600) * 1000).toISOString(),
      scopes: tokenData.scope ?? null,
      google_health_user_id: identity.healthUserId,
      provider: 'google_health_v4',
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (tokenError) throw tokenError;

    const { error: progressError } = await admin.from('onboarding_progress').upsert({
      user_id: oauthState.user_id,
      wearable_status: deviceCount > 0 ? 'connected' : 'authorized_no_device',
      paired_device_count: deviceCount,
      wearable_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (progressError) throw progressError;

    EdgeRuntime.waitUntil(syncGoogleHealthForUser(admin, oauthState.user_id, clientId, clientSecret)
      .catch((error) => console.warn('Initial Google Health sync skipped:', error instanceof Error ? error.message : error)));

    return redirect(withResult(oauthState.app_redirect_uri, {
      connected: '1',
      provider: 'google_health_v4',
      devices: String(deviceCount),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Health connection failed.';
    await admin.from('onboarding_progress').upsert({
      user_id: oauthState.user_id,
      wearable_status: 'error',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    return redirect(withResult(oauthState.app_redirect_uri, { error: message }));
  }
});
