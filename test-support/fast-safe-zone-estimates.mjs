import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

export async function testFastSafeZoneEstimates(db,{caregiver,patient}){
  await db.exec('reset role');
  await db.exec(await readFile(new URL('../supabase/migrations/20261126000000_fast_safe_zone_estimates.sql',import.meta.url),'utf8'));
  const device=(await db.query('select device_id from wearable_live_state where elderly_id=$1',[patient])).rows[0].device_id;
  const save=async(enabled=true)=>{
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[caregiver]);
    await db.exec('set role authenticated');
    await db.query('select save_patient_safe_zone($1,$2,10,123,10,$3)',[patient,'Fast estimate home',enabled]);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    await db.query('delete from watch_location_points where device_id=$1',[device]);
    await db.query('update wearable_live_state set monitoring=true,status_at=now() where elderly_id=$1',[patient]);
  };
  const state=async()=>(await db.query('select * from patient_safe_zone_state where elderly_id=$1',[patient])).rows[0];
  const now=Date.now();
  const fix=(age,distance,accuracy=120,source='network')=>db.query(
    'insert into watch_location_points(elderly_id,device_id,latitude,longitude,accuracy_m,location_source,measured_at) values($1,$2,$3,123,$4,$5,$6)',
    [patient,device,10+distance/111195,accuracy,source,new Date(now-age*1000).toISOString()]);
  for(const provider of ['watch_gps','fused','network','mixed']){
    await save();
    const source=provider==='mixed'?'fused':provider;
    for(const age of [85,80,75])await fix(age,0,120,source);
    assert.equal((await state()).status,'inside');
    // A 10 m circle must match the marker even with uncertainty wider than the zone.
    await fix(70,11,120,source);
    assert.equal((await state()).status,'inside','One outside fix must not alert');
    await fix(69,11,120,source);
    assert.equal((await state()).status,'inside','A burst shorter than 2 s must not alert');
    await fix(68,11,120,provider==='mixed'?'network':source);
    assert.equal((await state()).status,'outside','Exit must not wait 30 s or reject source switches');
    const alert=(await state()).last_alert_id;
    const notices=(await db.query('select * from caregiver_notifications where alert_id=$1',[alert])).rows;
    assert.equal(notices.length,1);
    assert.equal(notices[0].data.estimated_crossing,true);
    assert.equal(notices[0].data.accuracy_m,120);
    assert.match(notices[0].body,/reported accuracy.*120 m/);
    assert.ok((await db.query('select id from care_push_jobs where notification_id=$1',[notices[0].id])).rows.length);
    const count=async()=>(await db.query('select count(*)::int n from safe_zone_events where elderly_id=$1',[patient])).rows[0].n;
    const events=await count();
    await fix(67,11,120,source);await fix(66,11,120,source);
    await fix(120,0,120,source);await fix(-600,0,120,source);
    assert.equal(await count(),events,'Sustained outside, stale and future fixes must not duplicate an alert');
    await fix(65,9.5,120,source);await fix(60,9.5,120,source);await fix(55,9.5,120,source);
    assert.equal((await state()).status,'outside','Boundary jitter must not rearm the exit');
    await fix(50,0,120,source);await fix(48,0,120,source);await fix(46,0,120,source);
    assert.equal((await state()).status,'outside','A brief return must not rearm the exit');
    await fix(40,0,120,source);assert.equal((await state()).status,'inside');
    assert.equal((await db.query('select care_push_is_current($1) current',[notices[0].id])).rows[0].current,false);
    await fix(38,11,120,source);await fix(36,11,120,source);
    assert.equal((await state()).status,'outside','A later genuine estimated exit must alert again');
    assert.equal(await count(),events+2);
  }
  await save();
  await fix(30,11,2001);assert.equal((await state()).candidate_count,0);
  await assert.rejects(fix(29,11,null),/not-null constraint/);
  await db.query('update wearable_live_state set monitoring=false where elderly_id=$1',[patient]);
  await fix(28,11);await fix(26,11);assert.equal((await state()).status,'unknown');
  await save(false);await fix(20,11);await fix(18,11);assert.equal((await state()).status,'unknown');
  await save();await fix(16,0,5,'watch_gps');await fix(14,500,5,'watch_gps');
  assert.equal((await state()).candidate_count,0,'An implausible single jump must be filtered');
  await fix(12,500,5,'watch_gps');assert.equal((await state()).status,'unknown');
  await fix(10,500,5,'watch_gps');assert.equal((await state()).status,'outside','Repeated corroborating fixes can confirm after a jump');
  console.log('PASS fast 10 m GPS/fused/network/mixed exits, 2 s debounce, uncertainty metadata, push enqueue, deduplication, return hysteresis, repeat exits, pause, freshness and jump guards');
}
