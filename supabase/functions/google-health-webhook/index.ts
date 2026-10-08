import { createClient } from 'npm:@supabase/supabase-js@2';

import { HealthSyncError, syncGoogleHealthForUser } from '../_shared/google-health-sync.ts';
import { verifyHealthSignature, type Keyset } from '../_shared/health-signature.ts';
import { matchesWebhookSecret, webhookHealthUsers } from '../_shared/health-webhook.ts';

let cachedKeys: { fetchedAt: number; value: Keyset } | null = null;
async function googlePublicKeys() {
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < 24 * 60 * 60 * 1000) return cachedKeys.value;
  const response = await fetch('https://www.gstatic.com/googlehealthapi/webhooks/webhooks_public_keyset.json');
  if (!response.ok) throw new Error(`Google Health keyset HTTP ${response.status}`);
  const value = await response.json() as Keyset;
  cachedKeys = { fetchedAt: Date.now(), value };
  return value;
}

async function processHealthUser(healthUserId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const clientId = Deno.env.get('GOOGLE_HEALTH_CLIENT_ID') ?? Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_HEALTH_CLIENT_SECRET') ?? Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!supabaseUrl || !serviceRoleKey || !clientId || !clientSecret) throw new Error('Webhook sync is not configured.');

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: token, error } = await admin.from('google_health_tokens')
    .select('user_id').eq('google_health_user_id', healthUserId).maybeSingle();
  if (error) throw error;
  if (!token) {
    throw new Error('Google Health webhook user has no connected caregiver account.');
  }

  try {
    const result = await syncGoogleHealthForUser(admin, token.user_id, clientId, clientSecret);
    console.info(`Google Health webhook processed: ${result.changed ? 'database updated' : 'no new reading'}.`);
  } catch (caught) {
    if (caught instanceof HealthSyncError && caught.code === 'NO_HEALTH_DATA') {
      console.info('Google Health webhook processed: no readable measurements yet.');
      return;
    }
    throw caught;
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('GOOGLE_HEALTH_WEBHOOK_SECRET');
  if (!secret) return new Response('Webhook is not configured', { status: 503 });
  if (!matchesWebhookSecret(request.headers.get('Authorization'), secret)) return new Response('Unauthorized', { status: 401 });

  const rawBody = await request.text();
  const payload = (() => { try { return JSON.parse(rawBody); } catch { return null; } })();
  if (!payload) return new Response('Invalid JSON', { status: 400 });
  if (payload.type === 'verification') return new Response('ok', { status: 201 });
  if (!request.headers.get('GOOGLE-HEALTH-API-SIGNATURE')) return new Response('Missing signature', { status: 403 });

  try {
    const verified = await verifyHealthSignature(rawBody, request.headers.get('GOOGLE-HEALTH-API-SIGNATURE'), await googlePublicKeys());
    if (!verified) return new Response('Invalid signature', { status: 403 });
  } catch (error) {
    console.error('Unable to verify Google Health webhook:', error);
    return new Response('Signature verification unavailable', { status: 503 });
  }

  const healthUserIds = webhookHealthUsers(payload);
  console.info(`Google Health webhook received: ${healthUserIds.length} connected account(s) to synchronize.`);
  try {
    await Promise.all(healthUserIds.map(processHealthUser));
  } catch (error) {
    console.error('Google Health webhook sync failed:', error instanceof Error ? error.message : error);
    return new Response('Temporary health sync failure', { status: 503 });
  }
  return new Response(null, { status: 204 });
});
