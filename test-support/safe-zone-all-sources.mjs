import assert from 'node:assert/strict';

export async function testAllLocationSafeZones(db,{caregiver,patient}){
  const system=async()=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");};
  const save=async(enabled=true)=>{
    await system();await db.query("select set_config('request.jwt.claim.sub',$1,false)",[caregiver]);await db.exec('set role authenticated');
    await db.query('select save_patient_safe_zone($1,$2,10,123,20,$3)',[patient,'Estimate home',enabled]);await system();
  };
  await system();
  const device=(await db.query('select device_id from wearable_live_state where elderly_id=$1',[patient])).rows[0].device_id;
  await db.query('update wearable_live_state set monitoring=true,status_at=now() where elderly_id=$1',[patient]);
  for(const source of ['watch_gps','fused','network','mixed']){
    await save();await db.query('delete from watch_location_points where device_id=$1',[device]);
    const now=Date.now();
    const fix=async(age,distance,accuracy=30,provider=source==='mixed'?'fused':source)=>db.query(
      'insert into watch_location_points(elderly_id,device_id,latitude,longitude,accuracy_m,location_source,measured_at) values($1,$2,$3,123,$4,$5,$6)',
      [patient,device,10+distance/111195,accuracy,provider,new Date(now-age*1000).toISOString()]);
    const state=async()=>(await db.query('select * from patient_safe_zone_state where elderly_id=$1',[patient])).rows[0];
    await fix(85,0);await fix(75,0);await fix(65,0);assert.equal((await state()).status,'inside');
    await fix(60,24,51);assert.equal((await state()).candidate_count,0);
    // The marker is outside at 24 m even though +/-30 m overlaps the 20 m zone.
    await fix(55,24);await fix(45,24,30,source==='mixed'?'network':source);
    assert.equal((await state()).status,'inside');
    await fix(35,24,30,source==='mixed'?'watch_gps':source);assert.equal((await state()).status,'outside');
    const alert=(await state()).last_alert_id;
    const notices=(await db.query('select * from caregiver_notifications where alert_id=$1',[alert])).rows;
    assert.equal(notices.length,1);assert.equal(notices[0].data.estimated_crossing,true);
    assert.equal(notices[0].data.location_source,source==='mixed'?'watch_gps':source);
    assert.equal(notices[0].data.accuracy_m,30);
    assert.match(notices[0].body,/reported accuracy/);
    assert.ok((await db.query('select id from care_push_jobs where notification_id=$1',[notices[0].id])).rows.length);
    const events=(await db.query('select count(*)::int n from safe_zone_events where elderly_id=$1',[patient])).rows[0].n;
    await fix(30,24);await fix(120,0);await fix(-600,0);
    assert.equal((await state()).status,'outside');
    assert.equal((await db.query('select count(*)::int n from safe_zone_events where elderly_id=$1',[patient])).rows[0].n,events);
    await fix(20,0);await fix(10,0);await fix(0,0);assert.equal((await state()).status,'inside');
    assert.equal((await db.query('select care_push_is_current($1) current',[notices[0].id])).rows[0].current,false);
  }
  await save(false);
  await db.query("insert into watch_location_points(elderly_id,device_id,latitude,longitude,accuracy_m,location_source,measured_at) values($1,$2,10.01,123,5,'fused',now()+interval '1 second')",[patient,device]);
  assert.equal((await db.query('select status from patient_safe_zone_state where elderly_id=$1',[patient])).rows[0].status,'unknown');
  console.log('PASS GPS/fused/network/mixed marker-based exits and returns, source-labelled alerts, push enqueue, accuracy rejection, stale/future protection, pause and deduplication');
}
