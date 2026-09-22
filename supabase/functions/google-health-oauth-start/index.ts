import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
  'https://www.googleapis.com/auth/googlehealth.settings.readonly',
];

function randomBase64Url(byteLength = 48) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const clientId = Deno.env.get('GOOGLE_HEALTH_CLIENT_ID') ?? Deno.env.get('GOOGLE_CLIENT_ID');

  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !clientId) {
    return json({
      error: 'Google Health OAuth is not configured. Set GOOGLE_HEALTH_CLIENT_ID and GOOGLE_HEALTH_CLIENT_SECRET (or GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) in Supabase Edge Function secrets.',
      code: 'GOOGLE_HEALTH_NOT_CONFIGURED',
    }, 500);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Authentication required.' }, 401);

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Invalid user session.' }, 401);

  const requestBody = await request.json().catch(() => ({}));
  const appRedirectUri = String(requestBody.appRedirectUri ?? '');
  if (!appRedirectUri.startsWith('eldercareai://setup/fitness')) {
    return json({ error: 'Invalid app redirect URI.' }, 400);
  }

  const callbackUri = `${supabaseUrl}/functions/v1/google-health-oauth-callback`;
  const state = randomBase64Url(32);
  const codeVerifier = randomBase64Url(64);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { error: stateError } = await admin.from('google_health_oauth_states').insert({
    state,
    user_id: userData.user.id,
    code_verifier: codeVerifier,
    app_redirect_uri: appRedirectUri,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (stateError) return json({ error: stateError.message }, 500);

  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUri,
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent select_account',
    scope: HEALTH_SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return json({
    authorizationUrl: `${GOOGLE_AUTH_URL}?${query.toString()}`,
    callbackUri,
    scopes: HEALTH_SCOPES,
  });
});
