import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export async function testDailySteps(db,{caregiver,other}){
  await db.exec('reset role');
  const patient=randomUUID(),credential='daily-step-test',code=randomUUID();
  await db.query('insert into elderly_profiles(elderly_id,caregiver_id) values($1,$2)',[patient,caregiver]);
  await db.query("insert into galaxy_watch_pairings values($1,$2,$3,now()+interval '10 minutes',now())",[code,caregiver,patient]);
  const device=(await db.query('select claim_galaxy_watch($1,$2,$3,$4) id',[code,credential,'Test watch',randomUUID()])).rows[0].id;
  const samples=[
    {id:randomUUID(),metric:'steps_count',value:100,measured_at:'2026-01-01T00:00:00Z'},
    {id:randomUUID(),metric:'steps_count',value:150,measured_at:'2026-01-01T01:00:00Z'},
  ];
  const send=async events=>(await db.query('select ingest_galaxy_watch($1,$2::jsonb) accepted',[credential,JSON.stringify({captured_at:new Date().toISOString(),monitoring:true,samples:events})])).rows[0].accepted;
  assert.equal(await send(samples),true);
  const before=(await db.query('select count(*) n from vital_sign_logs')).rows[0].n;
  const tableCount=(await db.query("select count(*) n from information_schema.tables where table_schema='public'")).rows[0].n;
  await db.exec(await readFile(new URL('../supabase/migrations/20261108010000_daily_watch_steps.sql',import.meta.url),'utf8'));
  assert.equal((await db.query("select count(*) n from information_schema.tables where table_schema='public'")).rows[0].n,tableCount);
  assert.equal((await db.query('select count(*) n from vital_sign_logs')).rows[0].n,before,'Backfill must preserve every previous row');
  const daily=async()=> (await db.query("select id,steps_count,steps_day,recorded_at from vital_sign_logs where elderly_id=$1 and watch_metric='steps_count' and not is_superseded order by steps_day",[patient])).rows;
  assert.equal((await daily()).length,1);assert.equal((await daily())[0].steps_count,150);
  await send(samples); // Both archived and retained original sample IDs replay safely.
  const step=(value,at)=>({id:randomUUID(),metric:'steps_count',value,measured_at:at});
  await send([step(170,'2026-01-01T02:00:00Z'),step(90,'2026-01-01T03:00:00Z')]);
  const retained=(await daily())[0];assert.equal(retained.steps_count,170);
  assert.equal(retained.recorded_at.toISOString(),'2026-01-01T02:00:00.000Z','Daily timestamp belongs to its actual maximum sample');
  await send([step(180,'2026-01-01T15:59:00Z'),step(0,'2026-01-01T16:00:00Z'),step(20,'2026-01-01T17:00:00Z')]);
  const days=await daily();assert.deepEqual(days.map(row=>row.steps_count),[180,20]);assert.equal(days[0].id,retained.id,'The same daily record is updated');
  await send([step(190,'2026-01-01T15:59:30Z')]);
  const live=(await db.query('select steps_count,steps_measured_at from wearable_live_state where elderly_id=$1',[patient])).rows[0];
  assert.equal(live.steps_count,20,'Late previous-day events must not replace today’s live count');
  assert.equal(live.steps_measured_at.toISOString(),'2026-01-01T17:00:00.000Z');
  await send([{id:randomUUID(),metric:'heart_rate_bpm',value:111,measured_at:'2026-01-01T18:00:00Z'},{id:randomUUID(),metric:'heart_rate_bpm',value:111,measured_at:'2026-01-01T18:00:01Z'}]);
  assert.equal((await db.query("select count(*) n from vital_sign_logs where elderly_id=$1 and watch_metric='heart_rate_bpm'",[patient])).rows[0].n,2,'All non-step readings still log independently');
  // A retained daily row may have been recorded by another linked watch. Max,
  // not sum, avoids double-counting overlapping cumulative step counters.
  assert.ok(device);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[caregiver]);await db.exec('set role authenticated');
  const history=(await db.query("select steps_count from daily_step_history($1,'2026-01-01','2026-01-02')",[patient])).rows;
  assert.deepEqual(history.map(row=>row.steps_count),[20,190]);
  await assert.rejects(db.query("select * from daily_step_history($1,'2026-01-03','2026-01-01')",[patient]));
  await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);await db.exec('set role authenticated');
  await assert.rejects(db.query("select * from daily_step_history($1,'2026-01-01','2026-01-02')",[patient]),/Patient access denied/);
  await db.exec('reset role');
  console.log('PASS daily steps: no new tables or deleted history, daily max/update, Manila midnight, duplicate and archived replays, late uploads, distinct BPM events, owner-only date filtering');
}
