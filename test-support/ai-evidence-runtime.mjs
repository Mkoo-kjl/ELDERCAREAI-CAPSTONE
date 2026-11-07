// Exercise the shipped Edge handler without network, secrets or patient mutations.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const modules={};
async function load(path){
  const module={exports:{}};const code=ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:name=>modules[name],console,Intl,Date,Request,Response,Headers,Deno:deno,fetch:fakeFetch,setTimeout});return module.exports;
}
let handler,geminiCalls=0,geminiBody=null,active=true,wrongSession=false;
const deno={env:{get:name=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture',GEMINI_API_KEY:'fixture'}[name])},serve:fn=>{handler=fn;}};
const row={id:'11111111-1111-4111-8111-111111111111',elderly_id:'patient',source:'galaxy_watch',is_superseded:false,heart_rate_bpm:118,recorded_at:'2026-11-07T01:00:00Z',measurement_times:{heart_rate_bpm:'2026-11-07T00:59:59Z'}};
const history={scope:'all',timezone:'Asia/Manila',from:null,until:null,generated_at:'2026-11-07T01:00:10Z',threshold:{metric:'heart_rate_bpm',value:110,comparison:'gt',count:1,first_at:row.recorded_at},metrics:{heart_rate_bpm:{count:10,max:118}}};
const queried=[],rpcs=[];
function query(table){
  const filters=[];
  const result=()=>{
    queried.push({table,filters});
    const rows={user_access:{role:'caregiver',status:active?'active':'suspended'},caregivers:{full_name:'Caregiver'},profiles:{},ai_chatbot_sessions:wrongSession?null:{id:'chat',caregiver_id:'caregiver',elderly_id:'patient'},elderly_profiles:{elderly_id:'patient',full_name:'Maria'},vital_sign_logs:[row],doctor_contacts:null,ai_chatbot_messages:[]};
    return Promise.resolve({data:Object.hasOwn(rows,table)?rows[table]:[],error:null});
  };
  const q={select:()=>q,eq:(key,value)=>{filters.push([key,value]);return q;},not:()=>q,gte:()=>q,order:()=>q,limit:()=>q,maybeSingle:result,then:(resolve,reject)=>result().then(resolve,reject)};return q;
}
const client={auth:{getUser:async()=>({data:{user:{id:'caregiver',email:'fixture@example.invalid'}},error:null})},from:query,rpc:async(name,args)=>{
  rpcs.push({name,args});return {data:name==='watch_vital_history'?history:[row],error:null};
}};
async function fakeFetch(_url,options){geminiCalls++;geminiBody=JSON.parse(options.body);return Response.json({candidates:[{content:{parts:[{text:'The patient’s saved heart rate is 118 BPM [V1]. Reference [V999].'}]}}]});}
modules['npm:@supabase/supabase-js@2']={createClient:()=>client};
modules['../_shared/cors.ts']=await load('supabase/functions/_shared/cors.ts');
modules['../_shared/vital-history.ts']=await load('supabase/functions/_shared/vital-history.ts');
modules['../_shared/care-evidence.ts']=await load('supabase/functions/_shared/care-evidence.ts');
await load('supabase/functions/ai-care-assistant/index.ts');
const request=body=>handler(new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify(body)}));
let response=await request({message:'Did my patient ever go above 110 BPM?',sessionId:'chat',timeZone:'Asia/Manila'}),data=await response.json();
assert.equal(response.status,200);assert.equal(data.model,'verified-database-history');assert.equal(geminiCalls,0);assert.equal(data.evidence[0].record_id,row.id);assert.equal(data.evidence[0].measured_at,row.measurement_times.heart_rate_bpm);assert.equal(data.evidence_summary.sample_count,10);
assert.equal(rpcs.at(-1).args.p_caregiver,'caregiver');assert.equal(rpcs.at(-1).args.p_elderly,'patient');
response=await request({message:'Summarize the heart reading',sessionId:'chat'});data=await response.json();
assert.equal(geminiCalls,1);assert.equal(data.evidence.length,1);assert.ok(!data.reply.includes('[V999]'));assert.ok(data.reply.includes('[V1]'));assert.ok(geminiBody.systemInstruction.parts[0].text.includes('source_reading_references'));
wrongSession=true;response=await request({message:'hello',sessionId:'other-account-chat'});assert.equal(response.status,404);assert.equal(geminiCalls,1);
wrongSession=false;active=false;response=await request({message:'hello'});assert.equal(response.status,403);assert.equal(geminiCalls,1);
assert.ok(queried.filter(item=>item.table==='ai_chatbot_sessions').every(item=>item.filters.some(([key,value])=>key==='caregiver_id'&&value==='caregiver')));
assert.ok(queried.filter(item=>item.table==='elderly_profiles').every(item=>item.filters.some(([key,value])=>key==='caregiver_id'&&value==='caregiver')));
console.log('PASS real Edge handler: authenticated scope, complete-history answer with matching source, valid-only model citations, foreign session denial and suspended-account denial');
