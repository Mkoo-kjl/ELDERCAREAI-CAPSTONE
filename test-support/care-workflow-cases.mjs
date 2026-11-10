import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function testCareWorkflow(db,{caregiver,other,patient}){
  const asUser=async(id)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  const system=async()=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");};
  await system();
  const alert=randomUUID(),event=randomUUID();
  await db.query("insert into health_alerts(id,elderly_id,alert_type,severity,title,message) values($1,$2,'sos','critical','Fixture alert','Isolated PostgreSQL fixture')",[alert,patient]);
  await db.query("insert into emergency_events(id,elderly_id,is_resolved) values($1,$2,false)",[event,patient]);
  await db.query("insert into caregiver_notifications(caregiver_id,elderly_id,alert_id,notification_type,title,body,data) values($1,$2,$3,'emergency','Fixture','Fixture',jsonb_build_object('watch_sos_id',$4::text))",[caregiver,patient,alert,event]);
  await asUser(other);
  await assert.rejects(()=>db.query("select respond_to_care_alert($1,'acknowledge')",[alert]),/access denied/);
  assert.equal((await db.query('select * from alert_response_events')).rows.length,0);
  await asUser(caregiver);
  const acknowledged=(await db.query("select respond_to_care_alert($1,'acknowledge') result",[alert])).rows[0].result;
  assert.equal(acknowledged.acknowledged_by,caregiver);assert.equal(acknowledged.is_resolved,false);
  await db.query("select respond_to_care_alert($1,'acknowledge')",[alert]);
  assert.equal((await db.query('select * from alert_response_events where alert_id=$1',[alert])).rows.length,1);
  await assert.rejects(()=>db.query("select respond_to_care_alert($1,'resolve','')",[alert]),/response note/);
  await system();await db.query('delete from caregiver_notifications where alert_id=$1',[alert]);await asUser(caregiver);
  const resolved=(await db.query("select respond_to_care_alert($1,'resolve','Called the patient and checked in.') result",[alert])).rows[0].result;
  assert.equal(resolved.is_resolved,true);assert.equal(resolved.resolved_by,caregiver);
  await db.query("select respond_to_care_alert($1,'resolve','Retry must not overwrite the original note.')",[alert]);
  const audit=(await db.query('select * from alert_response_events where alert_id=$1 order by occurred_at',[alert])).rows;
  assert.equal(audit.length,2);assert.equal(audit[1].note,'Called the patient and checked in.');
  await system();await assert.rejects(()=>db.query("update health_alerts set resolved_at=now()+interval '1 hour' where id=$1",[alert]),/actor and time are final/);
  await system();assert.equal((await db.query('select is_resolved from emergency_events where id=$1',[event])).rows[0].is_resolved,true);
  console.log('PASS owner-only acknowledgment, final notes, idempotent response history and linked SOS resolution');

  await asUser(other);await assert.rejects(()=>db.query('select save_patient_safe_zone($1,$2,10,123,200,true)',[patient,'Home']),/access denied/);
  await asUser(caregiver);await assert.rejects(()=>db.query('select save_patient_safe_zone($1,$2,10,123,9,true)',[patient,'Home']),/valid name/);
  await db.query('select save_patient_safe_zone($1,$2,10,123,200,true)',[patient,'Home']);
  await system();
  const device=randomUUID();
  await db.query('update wearable_devices set revoked_at=now() where elderly_id=$1 and revoked_at is null',[patient]);
  await db.query("insert into wearable_devices(id,caregiver_id,elderly_id,device_name,token_hash) values($1,$2,$3,'Zone fixture',$4)",[device,caregiver,patient,randomUUID()]);
  await db.query('update wearable_live_state set device_id=$1,monitoring=true,status_at=now() where elderly_id=$2',[device,patient]);
  const now=Date.now();
  const fix=async(age,latitude=10.0001,source='watch_gps',accuracy=8)=>db.query('insert into watch_location_points(elderly_id,device_id,latitude,longitude,accuracy_m,location_source,measured_at) values($1,$2,$3,123,$4,$5,$6)',[patient,device,latitude,accuracy,source,new Date(now-age*1000).toISOString()]);
  const state=async()=>(await db.query('select * from patient_safe_zone_state where elderly_id=$1',[patient])).rows[0];
  await fix(-600,10.01);assert.equal((await state()).last_point_at,null);
  await fix(85);await fix(75);await fix(65);assert.equal((await state()).status,'inside');
  assert.equal((await db.query('select * from safe_zone_events where elderly_id=$1',[patient])).rows.length,0);
  await fix(60,10.01);await fix(50,10.01);assert.equal((await state()).status,'inside');
  await fix(40,10.01);assert.equal((await state()).status,'outside');
  const zoneAlert=(await state()).last_alert_id;assert.ok(zoneAlert);
  const exit=(await db.query("select n.id,care_push_is_current(n.id) current from caregiver_notifications n where n.alert_id=$1",[zoneAlert])).rows[0];
  assert.equal(exit.current,true);
  await fix(30);await fix(20);await fix(10);assert.equal((await state()).status,'inside');
  assert.equal((await db.query('select care_push_is_current($1) current',[exit.id])).rows[0].current,false);
  assert.deepEqual((await db.query('select direction from safe_zone_events where elderly_id=$1 order by measured_at',[patient])).rows.map(x=>x.direction),['outside','inside']);
  await asUser(other);
  assert.equal((await db.query('select * from patient_safe_zones')).rows.length,0);
  assert.equal((await db.query('select * from patient_safe_zone_state')).rows.length,0);
  assert.equal((await db.query('select * from safe_zone_events')).rows.length,0);
  await asUser(caregiver);await db.query('select save_patient_safe_zone($1,$2,10,123,200,true)',[patient,'Home']);
  await system();await db.query('delete from watch_location_points where device_id=$1',[device]);
  await fix(85,10.01,'fused');await fix(75,10.01,'network');await fix(65,10.01,'watch_gps',150);
  assert.equal((await state()).status,'unknown');
  await fix(60,10.01);await fix(55,10.0018);await fix(50,10.01);await fix(40,10.01);
  assert.equal((await state()).status,'unknown');await fix(30,10.01);assert.equal((await state()).status,'outside');
  await fix(120,10.0001);assert.equal((await state()).status,'outside');
  await asUser(caregiver);await db.query('select save_patient_safe_zone($1,$2,10,123,200,false)',[patient,'Home']);
  await system();await fix(5,10.01);assert.equal((await state()).status,'unknown');
  console.log('PASS safe-zone ownership, radius validation, GPS-only confirmation, boundary jitter, stale/out-of-order fixes, return events, pause and obsolete-push cancellation');

  await asUser(caregiver);
  await assert.rejects(()=>db.query('select save_patient_safe_zone($1,$2,10,123,9,true)',[patient,'Small home']),/10/);
  await db.query('select save_patient_safe_zone($1,$2,10,123,50,true)',[patient,'Small home']);
  await db.query('select register_care_push_v2($1,$2)',['ExpoPushToken[small-zone-fixture]','UTC']);
  await system();
  await assert.rejects(()=>db.query('update patient_safe_zones set radius_m=9 where elderly_id=$1',[patient]),/radius_m_check/);
  await db.query('delete from watch_location_points where device_id=$1',[device]);
  const eventCount=(await db.query('select count(*)::int count from safe_zone_events where elderly_id=$1',[patient])).rows[0].count;
  // At the maximum accepted 25 m accuracy, a center fix must still establish inside.
  await fix(85,10.00005,'watch_gps',25);await fix(75,10.00005,'watch_gps',25);await fix(65,10.00005,'watch_gps',25);
  assert.equal((await state()).status,'inside');
  await fix(60,10.0005);assert.equal((await state()).candidate,null); // ~56 m: uncertain, no exit.
  await fix(55,10.0007,'watch_gps',26);assert.equal((await state()).candidate_count,0);
  await fix(50,10.0007);await fix(40,10.0007);assert.equal((await state()).status,'inside');
  await fix(30,10.0007);assert.equal((await state()).status,'outside');
  const smallAlert=(await state()).last_alert_id;
  const smallExit=(await db.query('select n.id,care_push_is_current(n.id) current from caregiver_notifications n where n.alert_id=$1',[smallAlert])).rows[0];
  assert.equal(smallExit.current,true);
  assert.ok((await db.query('select id from care_push_jobs where notification_id=$1',[smallExit.id])).rows.length>0);
  await fix(25,10.0007);
  assert.equal((await db.query('select count(*)::int count from safe_zone_events where elderly_id=$1',[patient])).rows[0].count,eventCount+1);
  await fix(20,10.00005);await fix(10,10.00005);await fix(0,10.00005);
  assert.equal((await state()).status,'inside');
  assert.equal((await db.query('select care_push_is_current($1) current',[smallExit.id])).rows[0].current,false);
  assert.equal((await db.query('select count(*)::int count from safe_zone_events where elderly_id=$1',[patient])).rows[0].count,eventCount+2);
  console.log('PASS 50 m zones: minimum enforced, inside at 25 m accuracy, boundary jitter withheld, poor GPS rejected, confirmed exit queues one push, return cancels obsolete push');

  for(const radius of [10,20]){
    await asUser(caregiver);await db.query('select save_patient_safe_zone($1,$2,10,123,$3,true)',[patient,'House',radius]);
    await system();await db.query('delete from watch_location_points where device_id=$1',[device]);
    const accuracy=radius/2;
    await fix(85,10.000005,'watch_gps',accuracy);await fix(75,10.000005,'watch_gps',accuracy);await fix(65,10.000005,'watch_gps',accuracy);
    assert.equal((await state()).status,'inside');
    await fix(60,10+radius/111195,'watch_gps',accuracy);assert.equal((await state()).candidate,null);
    await fix(55,10+radius*2.5/111195,'watch_gps',accuracy+1);assert.equal((await state()).candidate_count,0);
    await fix(50,10+radius*2.5/111195,'watch_gps',accuracy);await fix(40,10+radius*2.5/111195,'watch_gps',accuracy);
    assert.equal((await state()).status,'inside');
    await fix(30,10+radius*2.5/111195,'watch_gps',accuracy);assert.equal((await state()).status,'outside');
    const notification=(await db.query('select id from caregiver_notifications where alert_id=$1',[(await state()).last_alert_id])).rows[0];
    assert.ok((await db.query('select id from care_push_jobs where notification_id=$1',[notification.id])).rows.length>0);
    await fix(20,10.000005,'watch_gps',accuracy);await fix(10,10.000005,'watch_gps',accuracy);await fix(0,10.000005,'watch_gps',accuracy);
    assert.equal((await state()).status,'inside');
    assert.equal((await db.query('select care_push_is_current($1) current',[notification.id])).rows[0].current,false);
  }
  console.log('PASS 10/20 m zones: accurate inside/exit/return confirmation, uncertainty withheld, poor GPS rejected, exit push queued and obsolete push cancelled');

  await asUser(caregiver);await db.query('select save_patient_safe_zone($1,$2,10,123,20,true)',[patient,'Hybrid home']);
  await system();await db.query('delete from watch_location_points where device_id=$1',[device]);
  const beforeHybrid=(await db.query('select count(*)::int n from safe_zone_events where elderly_id=$1',[patient])).rows[0].n;
  // 30 m from center +/-5 m is clearly outside a 20 m zone. Interleaved
  // phone-assisted inside points must not starve satellite confirmation.
  const outsideLat=10+30/111195;
  await fix(85,outsideLat,'watch_gps',5);await fix(80,10,'fused',3);
  assert.equal((await state()).candidate_count,1);
  await fix(75,outsideLat,'watch_gps',5);await fix(70,10,'network',3);
  await fix(65,outsideLat,'watch_gps',5);
  assert.equal((await state()).status,'outside');
  const hybridAlert=(await state()).last_alert_id;
  const hybridNotice=(await db.query('select id from caregiver_notifications where alert_id=$1',[hybridAlert])).rows[0];
  assert.ok(hybridNotice);assert.ok((await db.query('select id from care_push_jobs where notification_id=$1',[hybridNotice.id])).rows.length);
  await fix(60,outsideLat,'watch_gps',5);
  assert.equal((await db.query('select count(*)::int n from safe_zone_events where elderly_id=$1',[patient])).rows[0].n,beforeHybrid+1);
  await fix(50,10,'watch_gps',5);await fix(45,outsideLat,'fused',3);
  await fix(40,10,'watch_gps',5);await fix(35,outsideLat,'network',3);await fix(30,10,'watch_gps',5);
  assert.equal((await state()).status,'inside');
  console.log('PASS interleaved hybrid points preserve GPS exit/return confirmation, small-zone exit queues a push and repeated outside fixes do not duplicate alerts');

  await db.exec('set role service_role');
  await assert.rejects(()=>db.query("select watch_vital_evidence($1,$2,'heart_rate_bpm',100,'gte',null,null)",[other,patient]),/access denied/);
  const samples=(await db.query("select watch_vital_evidence($1,$2,'heart_rate_bpm',100,'gte',null,null) result",[caregiver,patient])).rows[0].result;
  assert.ok(samples.length>0&&samples.length<=8);assert.ok(samples.every(row=>row.elderly_id===patient&&row.heart_rate_bpm>=100&&!row.is_superseded));
  assert.equal((await db.query("select watch_vital_evidence($1,$2,'heart_rate_bpm',999,'gte',null,null) result",[caregiver,patient])).rows[0].result.length,0);
  await system();
  console.log('PASS evidence is selected from authorized matching rows with bounded samples and no invented record IDs');
}
