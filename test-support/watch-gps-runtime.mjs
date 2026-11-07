// Exercise the shipped upload handler without network, credentials or patient writes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const modules={},calls=[];let handler;
const deno={env:{get:name=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'}[name])},serve:fn=>{handler=fn;}};
async function load(path){
  const module={exports:{}};
  const code=ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:name=>modules[name],console,Date,Request,Response,Headers,TextEncoder,Uint8Array,crypto:webcrypto,Deno:deno});
  return module.exports;
}
modules['npm:@supabase/supabase-js@2']={createClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:true,error:null};}})};
modules['../_shared/cors.ts']=await load('supabase/functions/_shared/cors.ts');
modules['../_shared/watch-payload.ts']=await load('supabase/functions/_shared/watch-payload.ts');
await load('supabase/functions/galaxy-watch/index.ts');
const stamp=new Date().toISOString(),id='11111111-1111-4111-8111-111111111111';
const base={action:'ingest',upload_id:id,captured_at:stamp,monitoring:true,samples:[{id,metric:'heart_rate_bpm',value:78,measured_at:stamp}],latitude:10,longitude:123,accuracy_m:3,gps_measured_at:stamp,elderly_id:'foreign-patient'};
const request=(body,auth=true)=>handler(new Request('https://fixture.invalid',{method:'POST',headers:{...(auth?{Authorization:`Bearer ${'a'.repeat(64)}`}:{})},body:JSON.stringify(body)}));
for(const source of ['fused','network']){
  const response=await request({...base,location_source:source});assert.equal(response.status,200);
  const body=await response.json();assert.deepEqual(body.accepted_sample_ids,[id]);
  const payload=calls.at(-1).args.p_payload;
  assert.equal(payload.latitude,10);assert.equal(payload.location_source,source);assert.equal(payload.elderly_id,undefined);
  assert.equal(payload.samples[0].value,78);
}
assert.equal((await request(base)).status,200);assert.equal(calls.at(-1).args.p_payload.latitude,undefined);
assert.equal(calls.at(-1).args.p_payload.samples[0].value,78);
assert.equal((await request({...base,location_source:'watch_gps'})).status,200);
assert.equal(calls.at(-1).args.p_payload.latitude,10);assert.equal(calls.at(-1).args.p_payload.location_source,'watch_gps');
const before=calls.length;
assert.equal((await request(base,false)).status,401);
assert.equal((await request({...base,location_source:'invented'})).status,400);assert.equal(calls.length,before);
console.log('PASS actual hybrid ingestion: retains GPS/fused/network sources, ignores unknown coordinates, preserves and acknowledges vitals, denies unauthenticated and invalid requests');
