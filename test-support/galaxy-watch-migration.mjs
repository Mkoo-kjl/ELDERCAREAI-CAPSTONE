import {testDailySteps} from './daily-steps-cases.mjs';
import {testAllLocationSafeZones} from './safe-zone-all-sources.mjs';
import {testCareUsability} from './care-usability-cases.mjs';
// Isolated PostgreSQL check, never connects to the user's Supabase database.
// npm install --prefix tmp/watch-db-check --no-package-lock --ignore-scripts @electric-sql/pglite
// node test-support/galaxy-watch-migration.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tmp/watch-db-check/node_modules/@electric-sql/pglite/dist/index.js';
import {testCareWorkflow} from './care-workflow-cases.mjs';

const db = new PGlite();
const caregiver = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const patient = '00000000-0000-4000-8000-000000000011';
const otherPatient = '00000000-0000-4000-8000-000000000012';
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
    grant usage on schema storage to authenticated;
    grant select,insert,delete on storage.objects to authenticated;
    create schema vault; create schema net;
    create table vault.decrypted_secrets(name text primary key,decrypted_secret text);
    insert into vault.decrypted_secrets values ('eldercare_project_url','https://unit-test.invalid'),('eldercare_care_worker_key','test-only-worker-key');
    create table public.care_dispatch_requests(id bigserial primary key,endpoint text,payload jsonb);
    create function net.http_post(url text,body jsonb default '{}'::jsonb,params jsonb default '{}'::jsonb,
      headers jsonb default '{}'::jsonb,timeout_milliseconds integer default 2000) returns bigint language plpgsql as
      $$ declare request_id bigint; begin
        if current_setting('care.test_dispatch_failure',true)='true' then raise exception 'Unit dispatch unavailable'; end if;
        insert into public.care_dispatch_requests(endpoint,payload) values($1,$2) returning id into request_id;return request_id;
      end $$;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, service_role, anon;
    create table public.user_access(user_id uuid primary key, role text, status text);
    create function public.is_active_caregiver() returns boolean language sql security definer as
      $$ select exists(select 1 from public.user_access where user_id = auth.uid() and role = 'caregiver' and status = 'active') $$;
    create table public.elderly_profiles(elderly_id uuid primary key, caregiver_id uuid, created_at timestamptz default now(), full_name text default 'Test patient');
    create table public.medication_schedules(id uuid primary key,elderly_id uuid,caregiver_id uuid,medication_name text,dosage text,frequency text,
      times_of_day text[],start_date date,end_date date,is_active boolean default true,reminder_enabled boolean default true,created_at timestamptz default now(),updated_at timestamptz default now());
    create table public.appointments(id uuid primary key,elderly_id uuid,caregiver_id uuid,title text,doctor_name text,location text,appointment_at timestamptz,status text default 'upcoming',notes text,reminder_sent boolean default false);
    create table public.caregiver_notes(id uuid primary key);
    create table public.medication_logs(id uuid primary key default gen_random_uuid(),schedule_id uuid,elderly_id uuid,scheduled_time timestamptz,
      taken_at timestamptz,status text,recorded_by uuid,notes text);
    create table public.emergency_events(id uuid primary key default gen_random_uuid(),elderly_id uuid,event_type text,severity text,description text,vital_snapshot jsonb,
      is_resolved boolean default false,responded_by uuid,responded_at timestamptz,resolution_notes text);
    create table public.health_alerts(id uuid primary key default gen_random_uuid(),elderly_id uuid,alert_type text,severity text,title text,message text,ai_generated boolean,
      is_read boolean default false,is_resolved boolean default false,triggered_at timestamptz default now(),resolved_at timestamptz,resolved_by uuid);
    create table public.ai_chatbot_messages(id uuid primary key default gen_random_uuid(),content text);
    create table public.caregiver_notifications(id uuid primary key default gen_random_uuid(),caregiver_id uuid,elderly_id uuid,alert_id uuid,notification_type text,
      title text,body text,data jsonb,channel text,delivery_status text,sent_at timestamptz default now(),is_read boolean default false,read_at timestamptz);
    alter table public.elderly_profiles enable row level security;
    grant select on public.elderly_profiles to authenticated;
    create policy own_patient on public.elderly_profiles for select to authenticated using (caregiver_id = auth.uid());
    create table public.onboarding_progress(user_id uuid primary key, wearable_status text, paired_device_count integer,
      wearable_completed_at timestamptz, updated_at timestamptz);
    create table public.vital_sign_logs(id uuid primary key default gen_random_uuid(), elderly_id uuid,
      heart_rate_bpm double precision, spo2_percent double precision, skin_temp_celsius double precision, hrv_rmssd_ms double precision, steps_count integer, sleep_hours double precision, sleep_history jsonb not null default '[]'::jsonb, source text, recorded_at timestamptz, synced_at timestamptz, measurement_times jsonb);
    alter table public.vital_sign_logs enable row level security;
    grant select on public.vital_sign_logs to authenticated;
    create policy own_patient_vitals on public.vital_sign_logs for select to authenticated using (
      exists(select 1 from public.elderly_profiles e where e.elderly_id=vital_sign_logs.elderly_id and e.caregiver_id=auth.uid()) and public.is_active_caregiver()
    );
    create publication supabase_realtime;
    insert into auth.users values ('${caregiver}'), ('${other}');
    insert into public.user_access values ('${caregiver}', 'caregiver', 'active'), ('${other}', 'caregiver', 'active');
    insert into public.elderly_profiles(elderly_id,caregiver_id) values ('${patient}', '${caregiver}'), ('${otherPatient}', '${other}');
    insert into public.onboarding_progress(user_id) values ('${caregiver}'), ('${other}');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261102000000_galaxy_watch_live.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261102010000_galaxy_watch_sensor_history.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261102020000_watch_location_trail.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261102030000_watch_care_actions.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261102040000_watch_vital_history.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261102050000_samsung_health_import.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261103000000_health_history_status.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261103010000_health_history_oxygen_fix.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261103020000_background_care_alerts.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261103040000_care_alert_delivery_fixes.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261103050000_care_notification_channels.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261103060000_event_care_push_dispatch.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261107000000_care_workflow_safe_zones_evidence.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261107010000_safe_zone_fifty_meter_radius.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261107020000_safe_zone_small_radius.sql', import.meta.url), 'utf8'));
  const tableCount=(await db.query("select count(*) n from information_schema.tables where table_schema='public'")).rows[0].n;
  await db.exec(await readFile(new URL('../supabase/migrations/20261108000000_care_usability_and_reminders.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261110000000_safe_zone_hybrid_confirmation.sql', import.meta.url), 'utf8'));
  assert.equal((await db.query("select count(*) n from information_schema.tables where table_schema='public'")).rows[0].n,tableCount,'Care update must not add public tables');
  console.log('PASS all watch migrations execute on PostgreSQL');
  await db.query("insert into galaxy_watch_pairings values ($1,$2,$3,now()+interval '10 minutes',now())", ['code', caregiver, patient]);
  await db.exec('set role service_role');
  const claim = await db.query('select claim_galaxy_watch($1,$2,$3,$4) as id', ['code', 'credential', 'Galaxy Watch6', 'request1']);
  assert.ok(claim.rows[0].id);
  assert.equal((await db.query('select claim_galaxy_watch($1,$2,$3,$4) as id', ['code', 'other-credential', 'Other', 'request1'])).rows[0].id, null);
  console.log('PASS pairing is single-use');
  const capturedAt = new Date().toISOString();
  const payload = { upload_id: '00000000-0000-4000-8000-000000000100', captured_at: capturedAt, monitoring: true,
    heart_rate_bpm: 78, heart_rate_measured_at: capturedAt, latitude: 0, longitude: 0, accuracy_m: 5,
    gps_measured_at: capturedAt, battery_percent: 0 };
  async function ingest(value, credential = 'credential') {
    const samples = value.samples ?? (value.heart_rate_bpm == null ? [] : [{ id: randomUUID(), metric: 'heart_rate_bpm', value: value.heart_rate_bpm, measured_at: value.heart_rate_measured_at }]);
    return (await db.query('select ingest_galaxy_watch($1,$2::jsonb) as accepted', [credential, JSON.stringify({ ...value, samples })])).rows[0].accepted;
  }
  assert.equal(await ingest(payload), true);
  assert.equal(await ingest(payload), true);
  assert.equal(await ingest(payload, 'wrong-credential'), false);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int as n from vital_sign_logs')).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int as n from watch_location_points')).rows[0].n,1);
  console.log('PASS authenticated uploads, duplicate vital history and duplicate route handling');
  await db.exec('set role service_role');
  assert.equal(await ingest({ ...payload, heart_rate_bpm: 99, latitude: 40,
    heart_rate_measured_at: new Date(Date.parse(capturedAt) - 60_000).toISOString(),
    gps_measured_at: new Date(Date.parse(capturedAt) - 60_000).toISOString() }), true);
  // A location-only update preserves the heart-rate value and measurement time.
  assert.equal(await ingest({ upload_id: payload.upload_id, captured_at: capturedAt, monitoring: true, latitude: 1,
    longitude: 2, accuracy_m: 8, gps_measured_at: new Date(Date.parse(capturedAt) + 1000).toISOString(), battery_percent: 0 }), true);
  await db.exec('reset role');
  const latest = (await db.query('select * from wearable_live_state')).rows[0];
  assert.equal(latest.heart_rate_bpm, 78);
  assert.equal(latest.latitude, 1);
  assert.equal(latest.longitude, 2);
  assert.equal(latest.battery_percent, 0);
  assert.equal(latest.heart_rate_measured_at.toISOString(), capturedAt);
  console.log('PASS independent measurement times and protection against older uploads');
  // Every new timestamp is logged, including numerically identical heart rate and non-HR updates.
  const sampleAt = (offset) => new Date(Date.parse(capturedAt) + offset).toISOString();
  const events = [
    { id: randomUUID(), metric: 'heart_rate_bpm', value: 78, measured_at: sampleAt(2000) },
    { id: randomUUID(), metric: 'heart_rate_bpm', value: 78, measured_at: sampleAt(3000) },
    { id: randomUUID(), metric: 'skin_temp_celsius', value: 33.2, measured_at: sampleAt(2000) },
    { id: randomUUID(), metric: 'hrv_rmssd_ms', value: 42.7, measured_at: sampleAt(2000) },
    { id: randomUUID(), metric: 'spo2_percent', value: 97, measured_at: sampleAt(2000) },
    { id: randomUUID(), metric: 'steps_count', value: 0, measured_at: sampleAt(2000) },
  ];
  const beforeCount = (await db.query('select count(*)::int as n from vital_sign_logs')).rows[0].n;
  await db.exec('set role service_role');
  await ingest({ upload_id: randomUUID(), captured_at: capturedAt, monitoring: true, samples: events });
  await ingest({ upload_id: randomUUID(), captured_at: capturedAt, monitoring: true, samples: events });
  // Reusing an ID with altered data must change neither history nor current state.
  await ingest({ upload_id: randomUUID(), captured_at: capturedAt, monitoring: true, samples: [{ ...events[0], value: 140, measured_at: sampleAt(10000) }] });
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int as n from vital_sign_logs')).rows[0].n, beforeCount + 6);
  const multi = (await db.query('select * from wearable_live_state')).rows[0];
  assert.equal(multi.heart_rate_bpm, 78); assert.equal(multi.skin_temp_celsius, 33.2);
  assert.equal(multi.hrv_rmssd_ms, 42.7); assert.equal(multi.spo2_percent, 97); assert.equal(multi.steps_count, 0);
  assert.equal(multi.heart_rate_measured_at.toISOString(), sampleAt(3000));
  await db.exec('set role service_role');
  await assert.rejects(ingest({ upload_id: randomUUID(), captured_at: capturedAt, monitoring: true, samples: [
    { id: randomUUID(), metric: 'spo2_percent', value: 98, measured_at: sampleAt(4000) },
    { id: randomUUID(), metric: 'spo2_percent', value: 101, measured_at: sampleAt(5000) },
  ] }), /Invalid sensor sample/);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int as n from vital_sign_logs')).rows[0].n, beforeCount + 6);
  assert.equal((await db.query('select spo2_percent from wearable_live_state')).rows[0].spo2_percent, 97);
  console.log('PASS every vital event, independent metrics, idempotent replay and atomic invalid-batch rejection');
  async function asUser(user, callback) {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    await db.exec('set role authenticated');
    try { await callback(); } finally { await db.exec('reset role'); }
  }
  await asUser(caregiver, async () => {
    assert.equal((await db.query('select * from wearable_live_state')).rows.length, 1);
    assert.equal((await db.query('select * from vital_sign_latest')).rows.length, 1);
    assert.equal((await db.query('select id from wearable_devices')).rows.length, 1);
    assert.ok((await db.query('select id from watch_location_points')).rows.length>0);
    await assert.rejects(db.query('delete from watch_location_points'),/permission denied/);
    await assert.rejects(db.query('select token_hash from wearable_devices'), /permission denied/);
    await assert.rejects(db.query('select ingest_galaxy_watch($1,$2::jsonb)', ['credential', JSON.stringify(payload)]), /permission denied/);
    await assert.rejects(db.query('update wearable_live_state set heart_rate_bpm = 1'), /permission denied/);
  });
  await asUser(other, async () => {
    assert.equal((await db.query('select * from wearable_live_state')).rows.length, 0);
    assert.equal((await db.query('select * from vital_sign_latest')).rows.length, 0);
    assert.equal((await db.query('select id from wearable_devices')).rows.length, 0);
    assert.equal((await db.query('select id from watch_location_points')).rows.length,0);
  });
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from wearable_live_state'), /permission denied/);
  await assert.rejects(db.query('select * from vital_sign_latest'), /permission denied/);
  await db.exec('reset role');
  console.log('PASS caregiver isolation, hidden credentials, and blocked client writes');
  const care = async (operation,payload={},credential='credential') => (await db.query('select watch_care($1,$2,$3::jsonb) as result',[credential,operation,JSON.stringify(payload)])).rows[0].result;
  const sosId=randomUUID();
  await db.exec('set role service_role');
  const sos=await care('sos',{id:sosId}); assert.equal(sos.accepted,true);
  assert.deepEqual(await care('sos',{id:sosId}),sos);
  assert.equal(await care('sos',{id:randomUUID()},'wrong'),null);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int n from emergency_events')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from caregiver_notifications')).rows[0].n,1);
  console.log('PASS SOS authenticates the device and atomically creates one event, alert and notification on retries');
  const doseAt=new Date(Math.floor(Date.now()/60000)*60000);
  const earlier=new Date(doseAt.getTime()-3600_000); const medication=randomUUID(); const foreignMedication=randomUUID();
  await db.query("insert into medication_schedules(id,elderly_id,caregiver_id,medication_name,frequency,times_of_day,start_date) values($1,$2,$3,'Test medication','Twice daily',$4,'2020-01-01')",
    [medication,patient,caregiver,[doseAt.toISOString().slice(11,16),earlier.toISOString().slice(11,16)]]);
  await db.query("insert into medication_schedules(id,elderly_id,caregiver_id,medication_name,frequency,times_of_day,start_date) values($1,$2,$3,'Other medication','Daily',$4,'2020-01-01')",[foreignMedication,otherPatient,other,[doseAt.toISOString().slice(11,16)]]);
  const dose={id:randomUUID(),schedule_id:medication,scheduled_time:doseAt.toISOString(),taken_at:new Date().toISOString(),timezone:'UTC'};
  await db.exec('set role service_role');
  assert.equal((await care('sync')).medications.length,1);
  assert.equal((await care('medication_taken',dose)).accepted,true);
  await care('medication_taken',dose);
  await care('medication_taken',{...dose,id:randomUUID()});
  await assert.rejects(care('medication_taken',{...dose,id:randomUUID(),schedule_id:foreignMedication}),/unavailable/);
  await assert.rejects(care('medication_taken',{...dose,id:randomUUID(),scheduled_time:new Date(doseAt.getTime()+60000).toISOString()}),/schedule/);
  await care('medication_taken',{...dose,id:randomUUID(),scheduled_time:earlier.toISOString()});
  assert.equal((await care('sync')).taken_doses.length,2);
  await db.exec('reset role');
  await asUser(caregiver,async()=>{await db.query('select mark_medication_taken($1,$2,$3)',[medication,doseAt.toISOString(),'UTC']);});
  assert.equal((await db.query('select count(*)::int n from medication_logs')).rows[0].n,2);
  await asUser(other,async()=>{await assert.rejects(db.query('select mark_medication_taken($1,$2,$3)',[medication,doseAt.toISOString(),'UTC']),/denied/);});
  console.log('PASS per-dose Taken replay, phone/watch deduplication, schedule/time checks and cross-patient denial');
  for(let bucket=1;bucket<=12;bucket++)await db.query("insert into watch_hrv_reference_buckets values($1,to_timestamp(floor(extract(epoch from now())/300)*300)-$2*interval '5 minutes',40,1) on conflict(device_id,bucket_at) do update set total=40,samples=1",[claim.rows[0].id,bucket]);
  await db.exec('set role service_role');
  for(const [index,hrv,expected] of [[0,40,50],[1,20,100],[2,80,0],[3,0,null]]){
    await ingest({upload_id:randomUUID(),captured_at:capturedAt,monitoring:true,samples:[{id:randomUUID(),metric:'hrv_rmssd_ms',value:hrv,measured_at:sampleAt(15000+index*1000)}]});
    await db.exec('reset role');assert.equal((await db.query('select stress_score from wearable_live_state')).rows[0].stress_score,expected);await db.exec('set role service_role');
  }
  await db.exec('reset role');
  console.log('PASS experimental stress scale uses a personal baseline, clamps 0–100 and withholds a score for invalid zero HRV');
  assert.equal((await db.query("select count(*)::int n from vital_sign_logs where watch_metric='hrv_rmssd_ms' and stress_model_version='hrv-relative-v1'")).rows[0].n,5);
  await db.exec('set role service_role');
  await ingest({upload_id:randomUUID(),captured_at:capturedAt,monitoring:true,samples:[{id:randomUUID(),metric:'heart_rate_bpm',value:119,measured_at:new Date(Date.parse(capturedAt)-3600_000).toISOString()}]});
  for(let second=0;second<20;second++)await ingest({upload_id:randomUUID(),captured_at:capturedAt,monitoring:true,samples:[{id:randomUUID(),metric:'heart_rate_bpm',value:80,measured_at:sampleAt(30000+second*1000)}]});
  const facts=(await db.query('select watch_vital_history($1,$2,$3,$4,$5,$6,$7,$8,$9) as result',[caregiver,patient,'Asia/Manila','all',null,null,'heart_rate_bpm',100,'gte'])).rows[0].result;
  assert.equal(facts.threshold.count,1);assert.equal(facts.metrics.heart_rate_bpm.max,119);assert.equal(facts.metrics.heart_rate_bpm.latest.value,80);
  assert.equal(facts.metrics.spo2_percent.count,1);assert.ok(facts.metrics.stress_score.count>0);
  await assert.rejects(db.query('select watch_vital_history($1,$2,$3,$4,$5,$6,$7,$8,$9)',[other,patient,'UTC','all',null,null,null,null,'gte']),/denied/);
  await db.exec('reset role');
  console.log('PASS saved stress provenance and complete-history peaks beyond recent samples, with scoped patient access');
  await db.query("insert into samsung_health_links(elderly_id,caregiver_id,source_device_id,source_name) values($1,$2,'sdk-watch','Test Watch')",[patient,caregiver]);
  const sleepEnd=new Date(Date.now()-3600_000),sleepStart=new Date(sleepEnd.getTime()-8*3600_000);
  const sleep={metric:'sleep_hours',value:7,measured_at:sleepEnd.toISOString(),source_record_key:'sleep:session1',source_group_key:'sleep:session1',source_revision_at:new Date(Date.now()-60000).toISOString(),
    session_start_at:sleepStart.toISOString(),session_end_at:sleepEnd.toISOString(),minutes_asleep:420,minutes_in_sleep_period:480};
  const importedOxygen={metric:'spo2_percent',value:97,measured_at:sleepEnd.toISOString(),source_record_key:'oxygen:night:1',source_group_key:'oxygen:night',source_revision_at:sleep.source_revision_at};
  const importHealth=async(samples,source='sdk-watch',owner=caregiver)=>(await db.query('select import_samsung_health($1,$2,$3,$4::jsonb) n',[owner,patient,source,JSON.stringify(samples)])).rows[0].n;
  await db.exec('set role service_role');
  assert.equal(await importHealth([sleep,importedOxygen]),2);assert.equal(await importHealth([sleep,importedOxygen]),0);
  const corrected={...sleep,value:7.5,minutes_asleep:450,source_revision_at:new Date().toISOString()};
  assert.equal(await importHealth([corrected]),1);
  const latestFacts=(await db.query('select watch_vital_history($1,$2,$3,$4,$5,$6,$7,$8,$9) result',[caregiver,patient,'Asia/Manila','all',null,null,null,null,'gte'])).rows[0].result;
  assert.equal(latestFacts.metrics.sleep_hours.count,1);assert.equal(latestFacts.metrics.sleep_hours.latest.value,7.5);
  await assert.rejects(importHealth([sleep],'other-watch'),/not linked/);
  await assert.rejects(importHealth([sleep],'sdk-watch',other),/not linked/);
  await assert.rejects(importHealth([{...sleep,value:9}]),/Invalid sleep/);
  await db.exec('reset role');
  assert.equal((await db.query("select count(*)::integer n from vital_sign_logs where measurement_origin='samsung_health' and sleep_hours is not null")).rows[0].n,2);
  assert.deepEqual((await db.query("select sleep_history from vital_sign_logs where measurement_origin='samsung_health' and watch_metric='spo2_percent'")).rows[0].sleep_history,[]);
  assert.equal((await db.query('select sleep_hours from wearable_live_state')).rows[0].sleep_hours,7.5);
  console.log('PASS sleep and oxygen import, exact retry deduplication, retained revisions, current-only history and source/patient isolation');
  // Exercise the actual database triggers and queue without contacting a push service.
  const pushToken='ExpoPushToken[caregiver-device]';
  await asUser(caregiver,async()=>db.query('select register_care_push_v2($1,$2)',[pushToken,'UTC']));
  assert.equal((await db.query('select notification_channel_version v from caregiver_push_tokens where token=$1',[pushToken])).rows[0].v,2);
  await db.exec('delete from care_push_jobs');
  await db.exec('delete from care_dispatch_requests');
  const ruleCount=async rule=>(await db.query('select count(*)::int n from health_alerts where elderly_id=$1 and alert_type=$2',[patient,rule])).rows[0].n;
  const sendMetric=async(metric,value,offset)=>ingest({upload_id:randomUUID(),captured_at:capturedAt,monitoring:true,
    samples:[{id:randomUUID(),metric,value,measured_at:sampleAt(offset)}]});
  const highBefore=await ruleCount('heart_high');
  await sendMetric('heart_rate_bpm',110,60000);assert.equal(await ruleCount('heart_high'),highBefore);
  assert.equal((await db.query('select count(*)::int n from care_dispatch_requests')).rows[0].n,0);
  await sendMetric('heart_rate_bpm',111,61000);assert.equal(await ruleCount('heart_high'),highBefore+1);
  assert.equal((await db.query('select count(*)::int n from care_dispatch_requests')).rows[0].n,1);
  assert.deepEqual((await db.query('select payload from care_dispatch_requests')).rows[0].payload,{});
  await sendMetric('heart_rate_bpm',150,62000);assert.equal(await ruleCount('heart_high'),highBefore+1);
  await sendMetric('heart_rate_bpm',110,63000);
  await sendMetric('heart_rate_bpm',111,64000);assert.equal(await ruleCount('heart_high'),highBefore+2);
  await sendMetric('heart_rate_bpm',160,-240000);assert.equal(await ruleCount('heart_high'),highBefore+2);
  const lowBefore=await ruleCount('heart_low');
  await sendMetric('heart_rate_bpm',50,65000);assert.equal(await ruleCount('heart_low'),lowBefore);
  await sendMetric('heart_rate_bpm',49,66000);assert.equal(await ruleCount('heart_low'),lowBefore+1);
  const oxygenBefore=await ruleCount('oxygen_low');
  await sendMetric('spo2_percent',95,65000);assert.equal(await ruleCount('oxygen_low'),oxygenBefore);
  await sendMetric('spo2_percent',94.9,66000);assert.equal(await ruleCount('oxygen_low'),oxygenBefore+1);
  for(const [index,value] of [33.1,33.2,33,33.3,33.15,33.05].entries())await sendMetric('skin_temp_celsius',value,-600000+index*60000);
  const skinBefore=await ruleCount('skin_change');
  await sendMetric('skin_temp_celsius',35,67000);assert.equal(await ruleCount('skin_change'),skinBefore+1);
  const shortEnd=new Date(Date.now()-120000),shortStart=new Date(shortEnd.getTime()-5*3600000);
  const shortSleep={...sleep,value:4,minutes_asleep:240,minutes_in_sleep_period:300,measured_at:shortEnd.toISOString(),
    session_start_at:shortStart.toISOString(),session_end_at:shortEnd.toISOString(),source_record_key:'sleep:short',source_group_key:'sleep:short'};
  const sleepBefore=await ruleCount('sleep_short');
  await importHealth([shortSleep]);await importHealth([shortSleep]);assert.equal(await ruleCount('sleep_short'),sleepBefore+1);
  const persisted=(await db.query("select count(*)::int n from health_alerts a join caregiver_notifications n on n.alert_id=a.id join care_push_jobs j on j.notification_id=n.id where a.alert_type='heart_high' and n.caregiver_id=$1 and j.token=$2",[caregiver,pushToken])).rows[0].n;
  assert.equal(persisted,2);
  await sendMetric('heart_rate_bpm',100,68000);
  await db.query("select set_config('care.test_dispatch_failure','true',false)");
  const logsBeforeDispatchFailure=(await db.query('select count(*)::int n from vital_sign_logs')).rows[0].n;
  await sendMetric('heart_rate_bpm',111,69000);
  assert.equal((await db.query('select count(*)::int n from vital_sign_logs')).rows[0].n,logsBeforeDispatchFailure+1);
  assert.equal(await ruleCount('heart_high'),highBefore+3);
  await db.query("select set_config('care.test_dispatch_failure','false',false)");
  console.log('PASS dispatch transport failure preserves the measured vital and durable alert for retry');
  console.log('PASS strict vital thresholds, saved alerts/notifications/push jobs, crossing recovery, cooldown, stale-reading rejection and sleep/skin rules');
  const reminderMedication=randomUUID(),reminderAppointment=randomUUID();
  const reminderNow=new Date(),reminderClock=reminderNow.toISOString().slice(11,16);
  await db.query("insert into medication_schedules(id,elderly_id,caregiver_id,medication_name,frequency,times_of_day,start_date,timezone) values($1,$2,$3,'Reminder fixture','Daily',$4,'2020-01-01','UTC')",[reminderMedication,patient,caregiver,[reminderClock]]);
  await db.query("insert into appointments(id,elderly_id,caregiver_id,title,appointment_at) values($1,$2,$3,'Appointment fixture',$4)",[reminderAppointment,patient,caregiver,reminderNow.toISOString()]);
  await db.query('select schedule_care_reminders($1)',[reminderNow.toISOString()]);
  await db.query('select schedule_care_reminders($1)',[reminderNow.toISOString()]);
  const reminders=(await db.query("select id,data->>'care_kind' kind from caregiver_notifications where data->>'schedule_id'=$1 or data->>'appointment_id'=$2",[reminderMedication,reminderAppointment])).rows;
  assert.equal(reminders.length,2);
  for(const reminder of reminders)assert.equal((await db.query('select care_push_is_current($1) current',[reminder.id])).rows[0].current,true);
  await db.query('update medication_schedules set is_active=false where id=$1',[reminderMedication]);
  await db.query("update appointments set status='cancelled' where id=$1",[reminderAppointment]);
  for(const reminder of reminders)assert.equal((await db.query('select care_push_is_current($1) current',[reminder.id])).rows[0].current,false);
  const pendingPush=(await db.query('select claim_care_push(100) jobs')).rows[0].jobs;
  assert.ok(pendingPush.length>0);assert.ok(pendingPush.every(job=>!reminders.some(reminder=>reminder.id===job.notification_id)));
  assert.ok(pendingPush.every(job=>job.channel_version===2));
  console.log('PASS event-triggered worker dispatch and device-specific audible channel capability');
  console.log('PASS medication/appointment scheduling, retry deduplication and cancellation before push');
  await db.exec("update care_push_jobs set status='pending',next_attempt_at=now(),leased_until=null where status='processing'");
  await db.query('delete from caregiver_push_tokens where token=$1',[pushToken]);
  assert.deepEqual((await db.query('select claim_care_push(100) jobs')).rows[0].jobs,[]);
  console.log('PASS queued notifications stop targeting a phone after its token is unregistered');
  await db.exec("update care_push_jobs set status='pending',next_attempt_at=now(),leased_until=null");
  const formerOwnerNotifications=new Set((await db.query('select id from caregiver_notifications where caregiver_id=$1',[caregiver])).rows.map(row=>row.id));
  await asUser(other,async()=>db.query('select register_care_push($1,$2)',[pushToken,'UTC']));
  const reassignedJobs=(await db.query('select claim_care_push(100) jobs')).rows[0].jobs;
  assert.ok(reassignedJobs.length>0);assert.ok(reassignedJobs.every(job=>!formerOwnerNotifications.has(job.notification_id)));
  console.log('PASS a phone token assigned to a different caregiver cannot receive its former account’s queued alerts');
  await db.query("update user_access set status = 'suspended' where user_id = $1", [caregiver]);
  await asUser(caregiver, async () => assert.equal((await db.query('select * from wearable_live_state')).rows.length, 0));
  await db.exec('set role service_role');
  assert.equal(await ingest(payload), false);
  await db.exec('reset role');
  await db.query("update user_access set status = 'active' where user_id = $1", [caregiver]);
  await db.exec('update wearable_devices set revoked_at = now()');
  await db.exec('set role service_role');
  assert.equal(await ingest(payload), false);
  await db.exec('reset role');
  console.log('PASS suspended caregivers and revoked watches cannot upload');
  await db.query("insert into galaxy_watch_pairings values ($1,$2,$3,now()+interval '10 minutes',now())", ['new-code', caregiver, patient]);
  await db.exec('set role service_role');
  for (let i = 0; i < 10; i++) {
    assert.equal((await db.query('select claim_galaxy_watch($1,$2,$3,$4) as id', ['wrong', 'credential-2', 'Watch', 'limited'])).rows[0].id, null);
  }
  assert.equal((await db.query('select claim_galaxy_watch($1,$2,$3,$4) as id', ['new-code', 'credential-2', 'Watch', 'limited'])).rows[0].id, null);
  console.log('PASS pairing attempt limit persists across failed requests');
  await db.exec('reset role');
  await testCareWorkflow(db,{caregiver,other,patient,otherPatient});
  await db.exec(await readFile(new URL('../supabase/migrations/20261110010000_safe_zone_all_location_sources.sql', import.meta.url), 'utf8'));
  await testAllLocationSafeZones(db,{caregiver,patient});
  await testCareUsability(db,{caregiver,other,patient,otherPatient});
  await testDailySteps(db,{caregiver,other});
} catch(error) { console.error('FAIL',error.stack??error.message,error.where??'',error.position??'',error.internalPosition??'',error.internalQuery??''); process.exitCode=1; } finally { await db.close(); }
