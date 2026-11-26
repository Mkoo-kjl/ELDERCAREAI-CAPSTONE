import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(await readFile('supabase/functions/_shared/care-push.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Date});
const {carePushPayload,carePushDeliveryPlan,CARE_PUSH_BANNER_GAP_MS}=module.exports;
const messages=['medication','appointment','vital','sos'].flatMap(kind=>['a','b'].map(id=>carePushPayload({notification_id:`${kind}-${id}`,token:'fixture',title:'Reminder',body:'Fixture',kind,channel_version:2})));
assert.equal(new Set(messages.map(message=>message.tag)).size,8);
assert.equal(new Set(messages.map(message=>message.collapseId)).size,8);
assert.ok(messages.every(message=>message.priority==='high'&&message.sound.endsWith('.wav')));
assert.equal(carePushPayload({notification_id:'medication-a',kind:'medication',channel_version:2}).tag,messages[0].tag);
assert.equal(carePushPayload({notification_id:'old',kind:'medication',channel_version:1}).sound,'default');
console.log('PASS push payload: simultaneous events keep distinct tags/collapse IDs; retries retain identity; medication/appointment/vital/SOS sounds and old-channel compatibility preserved');
const jobs=[
  {id:'visit',notification_id:'visit',token:'phone-a',kind:'appointment'},
  {id:'med',notification_id:'med',token:'phone-a',kind:'medication'},
  {id:'other',notification_id:'other',token:'phone-b',kind:'medication'},
  {id:'extra',notification_id:'extra',token:'phone-a',kind:'medication'},
];
const plan=carePushDeliveryPlan(jobs);
assert.equal(CARE_PUSH_BANNER_GAP_MS,8000);
assert.ok(plan.batches.every(batch=>new Set(batch.map(job=>job.token)).size===batch.length));
assert.deepEqual(Array.from(plan.batches[0],job=>job.id),['med','other']);
assert.deepEqual(Array.from(plan.batches[1],job=>job.id),['extra']);
assert.deepEqual(Array.from(plan.deferred,job=>job.id),['visit']);
assert.deepEqual(Array.from(carePushDeliveryPlan(jobs.slice(0,2)).batches,batch=>batch[0].kind),['medication','appointment']);
assert.equal(plan.batches.flat().length+plan.deferred.length,jobs.length);
const urgent=[1,2,3].map(id=>({id:`sos-${id}`,token:'phone-a',kind:'sos'}));
const urgentPlan=carePushDeliveryPlan([...jobs.slice(0,2),...urgent]);
assert.ok(urgent.every(job=>urgentPlan.batches[0].includes(job)));
assert.equal(urgentPlan.deferred.length,0);
console.log('PASS simultaneous phone banners are separated per device; overflow remains queued; medication and appointment retain distinct delivery slots');

// Exercise the actual worker with a fake transport and database. Never send push.
const claimed=jobs.map(job=>({...job,lease_id:`lease:${job.id}`,attempts:1,title:'Fixture',body:'Fixture',data:null,channel_version:2}));
const writes=[],sent=[],gaps=[];
const db={
  rpc:async name=>({data:name==='claim_care_push'?claimed:0,error:null}),
  from:()=>{
    let values=null;const filters={};
    const query={
      update:patch=>{values=patch;return query;},
      select:()=>query,eq:(key,value)=>{filters[key]=value;return query;},lt:()=>query,
      limit:async()=>({data:[],error:null}),
      then:resolve=>{writes.push({values,filters});return Promise.resolve({error:null}).then(resolve);},
    };return query;
  },
};
let worker;
const workerExports={exports:{}};
vm.runInNewContext(ts.transpileModule(await readFile('supabase/functions/care-notification-worker/index.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{
  module:workerExports,exports:workerExports.exports,
  require:name=>{
    if(name.startsWith('npm:'))return {createClient:()=>db};
    if(name.endsWith('/cors.ts'))return {json:(body,status=200)=>new Response(JSON.stringify(body),{status})};
    if(name.endsWith('/care-push.ts'))return module.exports;
    throw Error(`Unexpected worker dependency ${name}`);
  },
  Deno:{env:{get:()=> 'fixture'},serve:handler=>{worker=handler;}},
  Date,Set,Promise,AbortSignal,console,
  setTimeout:(done,delay)=>{gaps.push(delay);queueMicrotask(done);return 0;},
  fetch:async(_url,options)=>{
    const batch=JSON.parse(options.body);sent.push(batch);
    return new Response(JSON.stringify({data:batch.map(item=>({status:'ok',id:`ticket:${item.tag}`}))}),{status:200});
  },
});
const result=await worker(new Request('http://fixture/worker',{method:'POST',headers:{'x-worker-key':'fixture'}}));
assert.equal(result.status,200);
assert.equal((await result.json()).submitted,3);
assert.deepEqual(gaps,[8000]);
assert.deepEqual(sent.map(batch=>batch.map(item=>item.tag)),[['med','other'],['extra']]);
for(const job of claimed){
  const write=writes.find(item=>item.filters.id===job.id);
  assert.equal(write.filters.lease_id,job.lease_id);
  if(job.id==='visit'){
    assert.equal(write.values.status,'pending');assert.equal(write.values.attempts,0);
    assert.equal(write.values.lease_id,null);
  }else assert.equal(write.values.ticket_id,`ticket:${job.notification_id}`);
}
console.log('PASS actual push worker spaces phone batches, matches each ticket to its own leased event, and requeues overflow without spending a retry');
