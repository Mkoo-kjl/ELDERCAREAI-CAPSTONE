import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !authorization) return json({ error: 'Invalid request.' }, 400);

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ error: 'Authentication required.' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: token } = await admin.from('google_health_tokens').select('google_access_token, google_refresh_token').eq('user_id', userData.user.id).maybeSingle();
  const revokeToken = token?.google_refresh_token ?? token?.google_access_token;
  if (revokeToken) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(revokeToken)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }
  await admin.from('google_health_tokens').delete().eq('user_id', userData.user.id);
  await admin.from('onboarding_progress').update({
    wearable_status: 'skipped', paired_device_count: 0, updated_at: new Date().toISOString(),
  }).eq('user_id', userData.user.id);
  return json({ disconnected: true });
});
