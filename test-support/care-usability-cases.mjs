import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function testCareUsability(db,{caregiver,other,patient,otherPatient}){
  await db.exec('reset role');
  const ids=[randomUUID(),randomUUID(),randomUUID(),randomUUID()];
  // Use a future synthetic clock only in this isolated database. No production notifications.
  const at='2026-12-15T02:00:00Z';
  for(const id of ids.slice(0,2))await db.query("insert into appointments(id,elderly_id,caregiver_id,title,appointment_at,status,notes) values($1,$2,$3,'Test visit',$4,null,'Routine follow-up')",[id,patient,caregiver,at]);
  await db.query("insert into appointments(id,elderly_id,caregiver_id,title,appointment_at,status) values($1,$2,$3,'Done visit',$4,'completed'),($5,$2,$3,'Cancelled visit',$4,'cancelled')",[ids[2],patient,caregiver,at,ids[3]]);
  await db.query('select schedule_care_reminders($1::timestamptz)',[at]);
  const notices=await db.query("select id,data,body,event_key from caregiver_notifications where data->>'appointment_id'=any($1::text[])",[ids]);
  assert.equal(notices.rows.length,2,'Two simultaneous appointments with NULL statuses must each create a reminder');
  assert.equal(new Set(notices.rows.map(row=>row.event_key)).size,2);
  assert.ok(notices.rows.every(row=>row.body.includes('10:00 AM')&&row.body.includes('Routine follow-up')));
  await db.query('select schedule_care_reminders($1::timestamptz)',[at]);
  assert.equal((await db.query("select count(*) n from caregiver_notifications where data->>'appointment_id'=any($1::text[])",[ids])).rows[0].n,2);
  const old=notices.rows[0];
  await db.query("update appointments set appointment_at='2026-12-17T02:00:00Z' where id=$1",[old.data.appointment_id]);
  assert.equal((await db.query('select care_push_is_current($1) current',[old.id])).rows[0].current,false,'Rescheduling must invalidate the previous reminder');
  const before='2026-12-16T01:45:00Z',future='2026-12-16T02:00:00Z',nextId=randomUUID();
  await db.query("insert into appointments(id,elderly_id,caregiver_id,title,appointment_at,status) values($1,$2,$3,'Next visit',$4,'upcoming')",[nextId,patient,caregiver,future]);
  await db.query('select schedule_care_reminders($1::timestamptz)',[before]);
  const advance=await db.query("select title,data from caregiver_notifications where data->>'appointment_id'=$1",[nextId]);
  assert.equal(advance.rows.length,1);assert.equal(advance.rows[0].data.lead_minutes,15);
  await db.query('select schedule_care_reminders($1::timestamptz)',[future]);
  assert.equal((await db.query("select count(*) n from caregiver_notifications where data->>'appointment_id'=$1",[nextId])).rows[0].n,2);
  const medIds=[randomUUID(),randomUUID()];
  for(const id of medIds)await db.query("insert into medication_schedules(id,elderly_id,caregiver_id,medication_name,frequency,times_of_day,start_date,end_date,timezone) values($1,$2,$3,'Test prescription','Custom',array['10:00'],'2026-12-15','2026-12-15','Asia/Manila')",[id,patient,caregiver]);
  await db.query('select schedule_care_reminders($1::timestamptz)',[at]);
  assert.equal((await db.query("select count(*) n from caregiver_notifications where data->>'schedule_id'=any($1::text[])",[medIds])).rows[0].n,2);
  await db.query('select schedule_care_reminders($1::timestamptz)',['2026-12-16T02:00:00Z']);
  assert.equal((await db.query("select count(*) n from caregiver_notifications where data->>'schedule_id'=any($1::text[])",[medIds])).rows[0].n,2,'Ended schedules must not generate further reminders');
  await db.query("delete from care_vital_rule_state where elderly_id=$1 and rule='oxygen_low'",[patient]);
  const oxygenIds=[randomUUID(),randomUUID(),randomUUID()];
  for(let index=0;index<3;index++)await db.query("insert into vital_sign_logs(id,elderly_id,source,watch_metric,spo2_percent,recorded_at) values($1,$2,'galaxy_watch','spo2_percent',$3,now()+$4*interval '1 second')",[oxygenIds[index],patient,[94,92,91][index],index]);
  const oxygenAlerts=await db.query("select a.severity from health_alerts a join caregiver_notifications n on n.alert_id=a.id where n.data->>'vital_log_id'=any($1::text[]) order by n.data->>'vital_log_id'",[oxygenIds]);
  assert.equal(oxygenAlerts.rows.length,2,'Critical oxygen must escalate an earlier warning, then retain cooldown');
  assert.deepEqual(new Set(oxygenAlerts.rows.map(row=>row.severity)),new Set(['warning','critical']));
  // Private storage ownership is enforced by the actual migration policies.
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[caregiver]);await db.exec('set role authenticated');
  const own=`${caregiver}/${patient}/medication-test.jpg`,foreign=`${other}/${otherPatient}/prescription-test.jpg`;
  await db.query("insert into storage.objects(bucket_id,name) values('care-files',$1)",[own]);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('care-files',$1)",[foreign]));
  await db.exec('reset role');await db.query("insert into storage.objects(bucket_id,name) values('care-files',$1)",[foreign]);
  await db.exec('set role authenticated');const files=await db.query("select name from storage.objects where bucket_id='care-files'");
  assert.deepEqual(files.rows.map(row=>row.name),[own]);await db.exec('reset role');
  console.log('PASS no-new-table care migration: simultaneous appointments/medications, NULL status, 15-minute advance, deduplication, end-date exclusion, private-file ownership');
}
