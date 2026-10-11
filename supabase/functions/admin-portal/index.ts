import { createClient } from 'npm:@supabase/supabase-js@2';
import { adminPortalRedirect, editableCaregiver, editableElderly, normalizeAdminEmail, patientPhotoPath, requireUuid, safeDateRange } from '../_shared/admin-security.ts';
import { corsHeaders, json } from '../_shared/cors.ts';

type Body = Record<string, unknown>;

function problem(message: string, status: number) { return json({ error: message }, status); }
function must(result: { error: { message: string } | null; data?: unknown }) {
  if (result.error) throw result.error;
  return result.data;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return problem('Method not allowed.', 405);

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishableKey || !serviceKey) return problem('Admin service is not configured.', 500);
  const bearer = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return problem('Sign in is required.', 401);

  const userClient = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data: identity, error: identityError } = await userClient.auth.getUser(bearer);
  if (identityError || !identity.user) return problem('Session expired. Sign in again.', 401);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: access, error: accessError } = await db.from('user_access')
    .select('role, status').eq('user_id', identity.user.id).maybeSingle();
  if (accessError) return problem('Unable to verify admin permissions.', 503);
  if (access?.role !== 'admin' || access.status !== 'active') return problem('Admin access is required.', 403);

  const body = await request.json().catch(() => null) as Body | null;
  if (!body || typeof body.action !== 'string') return problem('Invalid request.', 400);
  const actorId = identity.user.id;
  const audit = async (action: string, targetType: string | null, targetId: string | null, details: Body = {}) => {
    must(await db.from('admin_audit_log').insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, details }));
  };

  try {
    if (body.action === 'session') return json({ user: { id: actorId, email: identity.user.email }, role: 'admin' });

    if (body.action === 'admins') {
      const accessRows = await db.from('user_access').select('user_id, status, updated_at')
        .eq('role', 'admin').order('updated_at', { ascending: false }).limit(100);
      must(accessRows);
      const ids = (accessRows.data ?? []).map((row) => row.user_id);
      if (!ids.length) return json({ admins: [], currentId: actorId });
      const profiles = await db.from('profiles').select('id, email, full_name, created_at').in('id', ids);
      must(profiles);
      const byId = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]));
      return json({ admins: (accessRows.data ?? []).map((row) => ({ ...row, profile: byId.get(row.user_id) ?? null })), currentId: actorId });
    }

    if (body.action === 'invite-admin') {
      const email = normalizeAdminEmail(body.email);
      let redirectTo: string;
      try { redirectTo = adminPortalRedirect(Deno.env.get('ADMIN_PORTAL_URL')); }
      catch { return problem('Admin invitations are not configured. Set ADMIN_PORTAL_URL.', 503); }
      const existing = await db.from('profiles').select('id').eq('email', email).limit(1);
      must(existing);
      if (existing.data?.length) return problem('An account already uses this email. Use a distinct admin address.', 409);
      await audit('admin.invite.requested', 'admin', null, { email });
      const invited = await db.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (invited.error || !invited.data.user) {
        console.error('Admin invitation failed:', invited.error);
        return problem('Could not send the invitation. Check the address and email delivery settings.', 400);
      }
      const id = invited.data.user.id;
      const promoted = await db.from('user_access').update({ role: 'admin', status: 'active', updated_at: new Date().toISOString() })
        .eq('user_id', id).select('user_id').single();
      if (promoted.error) {
        const rollback = await db.auth.admin.deleteUser(id);
        if (rollback.error) console.error('Admin invite rollback failed:', rollback.error);
        throw promoted.error;
      }
      await audit('admin.invited', 'admin', id, { email });
      return json({ ok: true, id });
    }

    if (body.action === 'set-admin-status') {
      const id = requireUuid(body.id);
      if (id === actorId) return problem('You cannot change your own admin access.', 403);
      if (body.status !== 'active' && body.status !== 'suspended') return problem('Invalid account status.', 400);
      const target = must(await db.from('user_access').select('role, status').eq('user_id', id).single()) as { role: string; status: string };
      if (target.role !== 'admin') return problem('This account is not an administrator.', 403);
      if (target.status === body.status) return json({ ok: true });
      if (target.status === 'active' && body.status === 'suspended') {
        const active = await db.from('user_access').select('user_id', { count: 'exact', head: true }).eq('role', 'admin').eq('status', 'active');
        must(active);
        if ((active.count ?? 0) <= 1) return problem('The last active administrator cannot be suspended.', 409);
      }
      await audit('admin.status.requested', 'admin', id, { status: body.status });
      const changed = await db.from('user_access').update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('user_id', id).select('user_id').single();
      if (changed.error?.message.includes('last active administrator')) return problem('The last active administrator cannot be suspended.', 409);
      must(changed);
      await audit('admin.status.changed', 'admin', id, { status: body.status });
      return json({ ok: true });
    }

    if (body.action === 'delete-admin') {
      const id = requireUuid(body.id);
      if (id === actorId) return problem('You cannot delete your own admin account.', 403);
      const target = must(await db.from('user_access').select('role, status').eq('user_id', id).single()) as { role: string; status: string };
      if (target.role !== 'admin') return problem('This account is not an administrator.', 403);
      if (target.status === 'active') {
        const active = await db.from('user_access').select('user_id', { count: 'exact', head: true }).eq('role', 'admin').eq('status', 'active');
        must(active);
        if ((active.count ?? 0) <= 1) return problem('The last active administrator cannot be deleted.', 409);
      }
      await audit('admin.delete.requested', 'admin', id);
      const deleted = await db.auth.admin.deleteUser(id);
      if (deleted.error?.message.includes('last active administrator')) return problem('The last active administrator cannot be deleted.', 409);
      if (deleted.error) throw deleted.error;
      await audit('admin.deleted', 'admin', id);
      return json({ ok: true });
    }

    if (body.action === 'dashboard') {
      const started = Date.now();
      const [caregivers, patients, connected, suspended, recentVitals, recentAlerts, recentEmergencies] = await Promise.all([
        db.from('user_access').select('user_id', { count: 'exact', head: true }).eq('role', 'caregiver'),
        db.from('elderly_profiles').select('elderly_id', { count: 'exact', head: true }),
        db.from('onboarding_progress').select('user_id', { count: 'exact', head: true }).eq('wearable_status', 'connected'),
        db.from('user_access').select('user_id', { count: 'exact', head: true }).eq('role', 'caregiver').eq('status', 'suspended'),
        db.from('vital_sign_logs').select('synced_at, recorded_at').order('synced_at', { ascending: false, nullsFirst: false }).limit(1),
        db.from('health_alerts').select('id, title, severity, triggered_at, is_resolved, elderly_id').order('triggered_at', { ascending: false }).limit(6),
        db.from('emergency_events').select('id, event_type, severity, triggered_at, is_resolved, elderly_id').order('triggered_at', { ascending: false }).limit(6),
      ]);
      for (const result of [caregivers, patients, connected, suspended, recentVitals, recentAlerts, recentEmergencies]) must(result);
      return json({
        stats: { caregivers: caregivers.count ?? 0, patients: patients.count ?? 0, connectedDevices: connected.count ?? 0, suspended: suspended.count ?? 0 },
        lastVitalSyncAt: recentVitals.data?.[0]?.synced_at ?? recentVitals.data?.[0]?.recorded_at ?? null,
        alerts: recentAlerts.data ?? [], emergencies: recentEmergencies.data ?? [], responseMs: Date.now() - started,
      });
    }

    if (body.action === 'accounts') {
      const page = Math.max(0, Math.min(10000, Number.parseInt(String(body.page ?? 0), 10) || 0));
      const limit = 50;
      const result = await db.from('caregivers').select('id, full_name, email, phone, age, sex, created_at', { count: 'exact' })
        .order('created_at', { ascending: false }).range(page * limit, page * limit + limit - 1);
      must(result);
      const ids = (result.data ?? []).map((row) => row.id);
      if (!ids.length) return json({ caregivers: [], patients: [], access: [], page, pages: 0 });
      const [patients, accessRows] = await Promise.all([
        db.from('elderly_profiles').select('elderly_id, caregiver_id, full_name, age, gender, emergency_contact, emergency_contact_phone, medical_conditions, created_at').in('caregiver_id', ids).order('created_at', { ascending: false }),
        db.from('user_access').select('user_id, role, status').in('user_id', ids),
      ]);
      must(patients); must(accessRows);
      const roles = accessRows.data ?? [];
      return json({ caregivers: (result.data ?? []).filter((row) => roles.find((role) => role.user_id === row.id)?.role === 'caregiver'),
        patients: patients.data ?? [], access: roles, page, pages: Math.ceil((result.count ?? 0) / limit) });
    }

    if (body.action === 'monitor') {
      const [progress, syncs, auditRows] = await Promise.all([
        db.from('onboarding_progress').select('user_id, wearable_status, paired_device_count, updated_at').order('updated_at', { ascending: false }).limit(100),
        db.from('vital_sign_logs').select('elderly_id, synced_at, recorded_at, source').order('synced_at', { ascending: false, nullsFirst: false }).limit(100),
        db.from('admin_audit_log').select('id, action, target_type, target_id, created_at').order('created_at', { ascending: false }).limit(30),
      ]);
      must(progress); must(syncs); must(auditRows);
      return json({ devices: progress.data ?? [], syncs: syncs.data ?? [], activity: auditRows.data ?? [] });
    }

    if (body.action === 'alerts') {
      const [alerts, notifications, emergencies] = await Promise.all([
        db.from('health_alerts').select('id, elderly_id, title, message, severity, is_resolved, triggered_at').order('triggered_at', { ascending: false }).limit(100),
        db.from('caregiver_notifications').select('id, caregiver_id, elderly_id, title, body, notification_type, delivery_status, sent_at').order('sent_at', { ascending: false }).limit(100),
        db.from('emergency_events').select('id, elderly_id, event_type, description, severity, is_resolved, triggered_at').order('triggered_at', { ascending: false }).limit(100),
      ]);
      must(alerts); must(notifications); must(emergencies);
      return json({ alerts: alerts.data ?? [], notifications: notifications.data ?? [], emergencies: emergencies.data ?? [] });
    }

    if (body.action === 'update-caregiver') {
      const id = requireUuid(body.id);
      const values = editableCaregiver(body);
      const role = must(await db.from('user_access').select('role').eq('user_id', id).single()) as { role: string };
      if (role.role !== 'caregiver') return problem('Only caregiver accounts can be edited here.', 403);
      must(await db.from('caregivers').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).select('id').single());
      must(await db.from('profiles').update({ full_name: values.full_name, updated_at: new Date().toISOString() }).eq('id', id));
      await audit('caregiver.updated', 'caregiver', id, { fields: ['full_name', 'phone'] });
      return json({ ok: true });
    }

    if (body.action === 'update-elderly') {
      const id = requireUuid(body.id);
      const values = editableElderly(body);
      must(await db.from('elderly_profiles').update({ ...values, updated_at: new Date().toISOString() }).eq('elderly_id', id).select('elderly_id').single());
      await audit('patient.updated', 'elderly_profile', id, { fields: Object.keys(values) });
      return json({ ok: true });
    }

    if (body.action === 'set-status') {
      const id = requireUuid(body.id);
      if (id === actorId) return problem('You cannot change your own access.', 403);
      if (body.status !== 'active' && body.status !== 'suspended') return problem('Invalid account status.', 400);
      const role = must(await db.from('user_access').select('role').eq('user_id', id).single()) as { role: string };
      if (role.role !== 'caregiver') return problem('Only caregiver accounts can be changed here.', 403);
      await audit('caregiver.status.requested', 'caregiver', id, { status: body.status });
      must(await db.from('user_access').update({ status: body.status, updated_at: new Date().toISOString() }).eq('user_id', id));
      await audit('caregiver.status.changed', 'caregiver', id, { status: body.status });
      return json({ ok: true });
    }

    if (body.action === 'delete-elderly') {
      const id = requireUuid(body.id);
      const patient = must(await db.from('elderly_profiles').select('caregiver_id, photo_url')
        .eq('elderly_id', id).single()) as { caregiver_id: string; photo_url: string | null };
      const photoPath = patientPhotoPath(patient.photo_url, patient.caregiver_id, url);
      await audit('patient.delete.requested', 'elderly_profile', id);
      must(await db.rpc('admin_delete_elderly_data', { p_elderly_id: id }));
      const cleanup = photoPath ? await db.storage.from('profile-photos').remove([photoPath]) : null;
      if (cleanup?.error) console.error('Patient photo cleanup failed:', cleanup.error);
      await audit('patient.deleted', 'elderly_profile', id, { photoCleanupFailed: Boolean(cleanup?.error) });
      return json({ ok: true, photoCleanupFailed: Boolean(cleanup?.error) });
    }

    if (body.action === 'delete-caregiver') {
      const id = requireUuid(body.id);
      if (id === actorId) return problem('You cannot delete your own admin account.', 403);
      const role = must(await db.from('user_access').select('role').eq('user_id', id).single()) as { role: string };
      if (role.role !== 'caregiver') return problem('Only caregiver accounts can be deleted here.', 403);
      await audit('caregiver.delete.requested', 'caregiver', id);
      // Auth refuses deletion while the user owns Storage objects. Use the
      // Storage API, not a direct delete from storage.objects.
      for (let page = 0; page < 20; page++) {
        const listed = await db.storage.from('profile-photos').list(id, { limit: 100 });
        if (listed.error) throw listed.error;
        const files = (listed.data ?? []).filter((file) => file.name && file.id);
        if (!files.length) break;
        const removed = await db.storage.from('profile-photos').remove(files.map((file) => `${id}/${file.name}`));
        if (removed.error) throw removed.error;
        if (page === 19) throw new Error('Too many profile photos to remove in one request.');
      }
      must(await db.from('user_access').update({ status: 'suspended' }).eq('user_id', id));
      must(await db.rpc('admin_purge_caregiver_data', { p_caregiver_id: id }));
      const { error } = await db.auth.admin.deleteUser(id);
      if (error) throw error;
      await audit('caregiver.deleted', 'caregiver', id);
      return json({ ok: true });
    }

    if (body.action === 'report') {
      const range = safeDateRange(body.from, body.to);
      const reports = {
        vitals: { table: 'vital_sign_logs', time: 'recorded_at', columns: 'elderly_id, heart_rate_bpm, spo2_percent, sleep_hours, steps_count, recorded_at, synced_at, source' },
        alerts: { table: 'health_alerts', time: 'triggered_at', columns: 'elderly_id, title, severity, is_resolved, triggered_at' },
        activities: { table: 'admin_audit_log', time: 'created_at', columns: 'actor_id, action, target_type, target_id, created_at' },
        appointments: { table: 'appointments', time: 'appointment_at', columns: 'elderly_id, title, doctor_name, status, appointment_at' },
        medications: { table: 'medication_schedules', time: 'updated_at', columns: 'elderly_id, medication_name, dosage, frequency, is_active, updated_at' },
        medicalHistory: { table: 'elderly_profiles', time: 'updated_at', columns: 'elderly_id, full_name, medical_conditions, medications, updated_at' },
      } as const;
      const type = String(body.type ?? '') as keyof typeof reports;
      const report = reports[type];
      if (!report) return problem('Invalid report type.', 400);
      const rows = await db.from(report.table).select(report.columns)
        .gte(report.time, range.from).lte(report.time, range.to)
        .order(report.time, { ascending: false }).limit(2001);
      must(rows);
      await audit('report.exported', 'report', type, { from: body.from, to: body.to, rowCount: Math.min(rows.data?.length ?? 0, 2000) });
      return json({ type, rows: (rows.data ?? []).slice(0, 2000), truncated: (rows.data?.length ?? 0) > 2000 });
    }

    return problem('Unknown admin action.', 400);
  } catch (error) {
    if (error instanceof Error && /^(Invalid|Age must|A valid|Text is|Choose a valid|Reports must|Enter a valid)/.test(error.message)) return problem(error.message, 400);
    console.error('Admin portal request failed:', error);
    return problem('The request could not be completed. Check the audit log before retrying a change.', 500);
  }
});
