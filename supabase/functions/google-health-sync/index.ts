import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { HealthSyncError, syncGoogleHealthForUser } from '../_shared/google-health-sync.ts';

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

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    return json(await syncGoogleHealthForUser(admin, userData.user.id, clientId, clientSecret, true));
  } catch (error) {
    if (error instanceof HealthSyncError) return json({ error: error.message, code: error.code, details: error.details }, error.status);
    return json({ error: error instanceof Error ? error.message : 'Google Health synchronization failed.' }, 500);
  }
});
