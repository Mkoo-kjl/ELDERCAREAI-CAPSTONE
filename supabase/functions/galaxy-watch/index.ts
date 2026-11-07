import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { validateWatchPayload } from '../_shared/watch-payload.ts';

const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32))).map((byte) => byte.toString(16).padStart(2, '0')).join('');

// Gateway JWT verification is disabled because watches use scoped device credentials.
// Every action authenticates here; no action accepts a caller-selected patient on ingest.
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (Number(request.headers.get('content-length') ?? 0) > 65536) return json({ error: 'Payload too large.' }, 413);
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 65536) return json({ error: 'Payload too large.' }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON.' }, 400); }
    if (!body || Array.isArray(body) || typeof body !== 'object') return json({ error: 'Invalid request.' }, 400);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ error: 'Watch backend is not configured.' }, 500);
    const admin = createClient(url, key, { auth: { persistSession: false } });
    if (body.action === 'claim') {
      if (typeof body.code !== 'string' || !/^\d{8}$/.test(body.code)) return json({ error: 'Enter the eight-digit pairing code.' }, 400);
      const deviceToken = token();
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
      const { data: id, error } = await admin.rpc('claim_galaxy_watch', {
        p_code_hash: await hash(body.code), p_token_hash: await hash(deviceToken),
        p_device_name: String(body.device_name ?? 'Galaxy Watch').slice(0, 100), p_request_key: await hash(ip),
      });
      if (error) throw error;
      if (!id) return json({ error: 'Code expired, already used, or too many attempts. Generate a new code; after repeated attempts wait ten minutes.' }, 400);
      return json({ device_id: id, token: deviceToken });
    }
    const authorization = request.headers.get('Authorization') ?? '';
    const credential = authorization.replace(/^Bearer\s+/i, '');
    if (!credential || credential === authorization) return json({ error: 'Authentication required.' }, 401);
    if (body.action === 'care') {
      if (!/^[a-f0-9]{64}$/.test(credential)) return json({ error: 'Invalid device credential.' }, 401);
      const operation = body.operation;
      if (!['sync', 'sos', 'medication_taken'].includes(String(operation))) return json({ error: 'Invalid care action.' }, 400);
      const payload = body.payload;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json({ error: 'Invalid care payload.' }, 400);
      const { data, error } = await admin.rpc('watch_care', { p_token_hash: await hash(credential), p_action: operation, p_payload: payload });
      if (error) return json({ error: 'Care action was rejected. Refresh the medication schedule or check pairing.' }, 400);
      if (!data) return json({ error: 'Watch access expired. Pair again.' }, 401);
      // SOS uses the same durable push queue as vital alerts and care reminders.
      const { caregiver_id: _owner, ...scopedResult } = data;
      return json(scopedResult);
    }
    if (body.action === 'ingest') {
      if (!/^[a-f0-9]{64}$/.test(credential)) return json({ error: 'Invalid device credential. Pair the watch again.' }, 401);
      let payload;
      try { payload = validateWatchPayload(body); } catch (error) { return json({ error: (error as Error).message }, 400); }
      const { data: accepted, error } = await admin.rpc('ingest_galaxy_watch', { p_token_hash: await hash(credential), p_payload: payload });
      if (error) throw error;
      if (!accepted) return json({ error: 'Device access expired or was disconnected. Pair the watch again.' }, 401);
      return json({ accepted: true, accepted_sample_ids: payload.samples.map((sample) => sample.id), received_at: new Date().toISOString() });
    }
    const { data: user, error: authError } = await admin.auth.getUser(credential);
    if (authError || !user.user) return json({ error: 'An active caregiver session is required.' }, 401);
    const { data: access, error: accessError } = await admin.from('user_access').select('role, status').eq('user_id', user.user.id).maybeSingle();
    if (accessError) throw accessError;
    if (access?.role !== 'caregiver' || access.status !== 'active') return json({ error: 'An active caregiver session is required.' }, 403);
    const { data: patient, error: patientError } = await admin.from('elderly_profiles').select('elderly_id')
      .eq('caregiver_id', user.user.id).order('created_at').limit(1).maybeSingle();
    if (patientError) throw patientError;
    if (!patient) return json({ error: 'Create the older-adult profile first.' }, 400);
    if(body.action==='link_samsung_health'){
      if(typeof body.source_device_id!=='string'||!body.source_device_id||body.source_device_id.length>256)return json({error:'Choose the patient’s Samsung Health watch.'},400);
      const {error}=await admin.from('samsung_health_links').upsert({elderly_id:patient.elderly_id,caregiver_id:user.user.id,source_device_id:body.source_device_id,
        source_name:String(body.source_name??'Galaxy Watch').slice(0,200),linked_at:new Date().toISOString()});
      if(error)throw error;return json({linked:true});
    }
    if(body.action==='unlink_samsung_health'){
      const {error}=await admin.from('samsung_health_links').delete().eq('elderly_id',patient.elderly_id).eq('caregiver_id',user.user.id);
      if(error)throw error;return json({unlinked:true});
    }
    if(body.action==='import_samsung_health'){
      if(typeof body.source_device_id!=='string'||!Array.isArray(body.samples)||body.samples.length>120)return json({error:'Invalid Samsung Health import.'},400);
      const {data,error}=await admin.rpc('import_samsung_health',{p_caregiver:user.user.id,p_elderly:patient.elderly_id,p_source:body.source_device_id,p_samples:body.samples});
      const importMetric=(body.samples[0] as Record<string,unknown>|undefined)?.metric;
      const diagnostic=await admin.from('samsung_health_links').update({last_import_at:new Date().toISOString(),
        last_import_metric:['sleep_hours','spo2_percent'].includes(String(importMetric))?String(importMetric):null,
        last_import_count:error?0:Number(data??0),last_import_error_code:error?.code??null,
        last_import_error:error?String(error.message).slice(0,240):null})
        .eq('elderly_id',patient.elderly_id).eq('caregiver_id',user.user.id).eq('source_device_id',body.source_device_id);
      if(diagnostic.error)console.error('Health history diagnostic could not be saved',{code:diagnostic.error.code});
      if(error){
        const reason=error.message==='Invalid Samsung Health sample'?'A Samsung Health sample has an invalid value, identifier or timestamp.':
          error.message==='Invalid sleep session'?'A Samsung Health sleep session has inconsistent duration or timestamps.':
          error.message==='Samsung Health source is not linked to this patient'?'Reconnect Samsung Health to the patient’s selected watch.':
          error.message==='Pair an active Galaxy Watch first'?'Pair an active Galaxy Watch before importing Samsung Health.':
          'Samsung Health samples were not accepted. Check the linked watch and original timestamps.';
        console.error('Samsung Health import rejected',{code:error.code??'IMPORT_REJECTED',samples:body.samples.length});
        return json({error:reason,code:error.code??'IMPORT_REJECTED'},400);
      }
      return json({accepted:true,inserted:data});
    }
    if (body.action === 'pair') {
      const { error: deleteError } = await admin.from('galaxy_watch_pairings').delete().eq('caregiver_id', user.user.id);
      if (deleteError) throw deleteError;
      const code = (crypto.getRandomValues(new Uint32Array(1))[0] % 100_000_000).toString().padStart(8, '0');
      const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      const { error } = await admin.from('galaxy_watch_pairings').insert({ code_hash: await hash(code), caregiver_id: user.user.id, elderly_id: patient.elderly_id, expires_at: expiresAt });
      if (error) throw error;
      return json({ code, expires_at: expiresAt });
    }
    if (body.action === 'disconnect') {
      const { error } = await admin.from('wearable_devices').update({ revoked_at: new Date().toISOString() })
        .eq('caregiver_id', user.user.id).eq('elderly_id', patient.elderly_id).is('revoked_at', null);
      if (error) throw error;
      const { error: stateError } = await admin.from('wearable_live_state').update({ monitoring: false, status_at: new Date().toISOString() }).eq('elderly_id', patient.elderly_id);
      if (stateError) throw stateError;
      const { error: progressError } = await admin.from('onboarding_progress').update({ wearable_status: 'not_started', paired_device_count: 0, updated_at: new Date().toISOString() }).eq('user_id', user.user.id);
      if (progressError) throw progressError;
      await admin.from('galaxy_watch_pairings').delete().eq('caregiver_id', user.user.id);
      return json({ disconnected: true });
    }
    return json({ error: 'Unknown watch action.' }, 400);
  } catch (error) {
    console.error('Watch backend request failed:', error instanceof Error ? error.message : 'Database operation failed');
    return json({ error: 'Watch backend operation failed. Check its deployment and database migration.' }, 500);
  }
});
