import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
let handler,owner=true,authenticated=true,fetches=0;
const calls=[];
const db={auth:{getUser:async()=>({data:{user:authenticated?{id:'owner'}:null},error:null})},from:table=>{
  calls.push(table);if(table==='medication_schedules')throw Error('Extraction must never write medication records');
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:owner?{elderly_id:'patient'}:null,error:null})};return query;
},storage:{from:bucket=>{assert.equal(bucket,'care-files');return {download:async path=>{assert.equal(path,'owner/patient/prescription-test.jpg');return {data:new Blob(['test-only-image'],{type:'image/jpeg'}),error:null};}};}}};
const modules={'npm:@supabase/supabase-js@2':{createClient:()=>db},'../_shared/caregiver-access.ts':{isActiveCaregiver:async()=>true}};
async function load(path){const module={exports:{}};const code=ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:name=>modules[name],Date,Request,Response,Blob,Headers,Uint8Array,Set,console,btoa,AbortSignal,Deno:{env:{get:name=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-key',GEMINI_API_KEY:'test-key',GEMINI_MODEL:'test-model'}[name])},serve:fn=>{handler=fn;}},fetch:async(_url,input)=>{fetches++;const body=JSON.parse(input.body);assert.ok(body.systemInstruction.parts[0].text.includes('Do not prescribe'));assert.equal(body.contents[0].parts[1].inlineData.mimeType,'image/jpeg');return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({medications:[{medication_name:'Visible text',dosage:null,times_of_day:[]}]})}]}}]}));}});return module.exports;}
modules['../_shared/cors.ts']=await load('supabase/functions/_shared/cors.ts');await load('supabase/functions/prescription-draft/index.ts');
const request=(body,auth=true)=>handler(new Request('https://fixture.invalid',{method:'POST',headers:auth?{Authorization:'Bearer test-user'}:{},body:JSON.stringify(body)}));
assert.equal((await request({path:'owner/patient/prescription-test.jpg',elderly_id:'patient'},false)).status,401);
authenticated=false;assert.equal((await request({path:'owner/patient/prescription-test.jpg',elderly_id:'patient'})).status,401);authenticated=true;
assert.equal((await request({path:'other/patient/prescription-test.jpg',elderly_id:'patient'})).status,400);
owner=false;assert.equal((await request({path:'owner/patient/prescription-test.jpg',elderly_id:'patient'})).status,403);owner=true;
const response=await request({path:'owner/patient/prescription-test.jpg',elderly_id:'patient'});assert.equal(response.status,200);
const result=await response.json();assert.equal(result.review_required,true);assert.equal(result.medications[0].dosage,null);assert.equal(fetches,1);assert.ok(!calls.includes('medication_schedules'));
console.log('PASS actual prescription handler: authenticated owner only, private image, draft-only AI prompt, missing dose preserved, no medication writes');
