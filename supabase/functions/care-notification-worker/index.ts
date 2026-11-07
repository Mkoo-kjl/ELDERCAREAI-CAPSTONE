import {createClient} from 'npm:@supabase/supabase-js@2';
import {json} from '../_shared/cors.ts';
import {carePushPayload,carePushRetry,carePushError,type CarePushJob} from '../_shared/care-push.ts';

Deno.serve(async request=>{
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),workerSecret=Deno.env.get('CARE_NOTIFICATION_WORKER_SECRET');
  if(!url||!key||!workerSecret)return json({error:'Worker configuration unavailable'},500);
  if(request.headers.get('x-worker-key')!==workerSecret)return json({error:'Worker authentication required'},401);
  const db=createClient(url,key,{auth:{persistSession:false}});
  let submitted=0,retrying=0,receipts=0;
  try{
    const scheduled=await db.rpc('schedule_care_reminders');if(scheduled.error)throw scheduled.error;
    const claim=await db.rpc('claim_care_push',{p_limit:50});if(claim.error)throw claim.error;
    const jobs=(claim.data??[]) as CarePushJob[];
    const changed=new Set<string>();
    if(jobs.length){
      let tickets:Record<string,any>[]=[];let transportError:string|null=null;
      try{
        const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify(jobs.map(carePushPayload)),signal:AbortSignal.timeout(15000)});
        if(!response.ok)transportError=`PushHTTP${response.status}`;
        else{const payload=await response.json();tickets=Array.isArray(payload.data)?payload.data:payload.data?[payload.data]:[];}
      }catch{transportError='PushNetworkError';}
      for(const [index,job] of jobs.entries()){
        const ticket=tickets[index];const accepted=ticket?.status==='ok'&&typeof ticket.id==='string';
        const error=accepted?null:transportError??carePushError(ticket);
        const invalid=error==='DeviceNotRegistered';
        const update=await db.from('care_push_jobs').update({status:accepted?'submitted':invalid||job.attempts>=12?'failed':'pending',
          ticket_id:accepted?ticket.id:null,error,leased_until:null,lease_id:null,next_attempt_at:carePushRetry(job.attempts),
          receipt_checked_at:accepted?new Date().toISOString():null}).eq('id',job.id).eq('lease_id',job.lease_id);
        if(update.error)throw update.error;
        if(invalid){const removed=await db.from('caregiver_push_tokens').delete().eq('token',job.token);if(removed.error)throw removed.error;}
        if(accepted)submitted++;else retrying++;
        changed.add(job.notification_id);
      }
    }
    // Expo recommends checking receipts later. Acceptance is not proof of display.
    const pending=await db.from('care_push_jobs').select('id,notification_id,token,ticket_id,attempts')
      .eq('status','submitted').lt('receipt_checked_at',new Date(Date.now()-15*60000).toISOString()).limit(100);
    if(pending.error)throw pending.error;
    if(pending.data?.length){
      const response=await fetch('https://exp.host/--/api/v2/push/getReceipts',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ids:pending.data.map(job=>job.ticket_id)}),signal:AbortSignal.timeout(15000)});
      if(response.ok){
        const payload=await response.json();
        for(const job of pending.data){
          const receipt=payload.data?.[job.ticket_id];const accepted=receipt?.status==='ok';
          const error=receipt?.status==='error'?carePushError(receipt):null;
          const patch:Record<string,unknown>={receipt_checked_at:new Date().toISOString()};
          if(accepted){patch.status='confirmed';patch.error=null;receipts++;}
          else if(error){patch.status=error==='DeviceNotRegistered'||job.attempts>=12?'failed':'pending';patch.error=error;patch.next_attempt_at=carePushRetry(job.attempts);patch.ticket_id=null;}
          const updated=await db.from('care_push_jobs').update(patch).eq('id',job.id).eq('status','submitted');if(updated.error)throw updated.error;
          if(error==='DeviceNotRegistered'){const removed=await db.from('caregiver_push_tokens').delete().eq('token',job.token);if(removed.error)throw removed.error;}
          changed.add(job.notification_id);
        }
      }
    }
    for(const id of changed){const refreshed=await db.rpc('refresh_care_push_status',{p_notification:id});if(refreshed.error)throw refreshed.error;}
    return json({scheduled:scheduled.data,claimed:jobs.length,submitted,retrying,provider_receipts:receipts,at:new Date().toISOString()});
  }catch(error){
    console.error('Care notification worker failed',{code:(error as {code?:string})?.code??'WORKER_ERROR'});
    return json({error:'Notification processing will retry on the next scheduled run.'},500);
  }
});
