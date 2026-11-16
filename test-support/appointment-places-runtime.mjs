import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
let actor='fixture-user';
let handler,authenticated=true,allowed=true,fail=false,fetches=0,lastUrl='';
const db={auth:{getUser:async()=>({data:{user:authenticated?{id:actor}:null},error:null})}};
const modules={'npm:@supabase/supabase-js@2':{createClient:()=>db},'../_shared/caregiver-access.ts':{isActiveCaregiver:async()=>allowed}};
async function load(path){
  const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:name=>modules[name],Date,URL,Request,Response,Headers,AbortSignal,console,Deno:{env:{get:name=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'}[name])},serve:fn=>{handler=fn;}},fetch:async url=>{fetches++;lastUrl=String(url);if(fail)return new Response('',{status:503});return new Response(JSON.stringify({features:[{geometry:{coordinates:[123.9,10.3]},properties:{name:'Fixture Hospital',city:'Cebu',country:'Philippines'}},{geometry:{coordinates:[null,null]},properties:{name:'Invalid'}}]}));}});
  return module.exports;
}
modules['../_shared/cors.ts']=await load('supabase/functions/_shared/cors.ts');await load('supabase/functions/appointment-places/index.ts');
const request=(body,auth=true)=>handler(new Request('https://fixture.invalid',{method:'POST',headers:auth?{Authorization:'Bearer fixture'}:{},body:JSON.stringify(body)}));
assert.equal((await request({query:'hospital'},false)).status,401);
authenticated=false;assert.equal((await request({query:'hospital'})).status,401);authenticated=true;
allowed=false;assert.equal((await request({query:'hospital'})).status,403);allowed=true;
assert.equal((await request({query:'ab'})).status,400);
const search={query:'Cebu hospital',center:{latitude:10.312345,longitude:123.912345},elderly_id:'never-send',medical_conditions:'never-send'};
const response=await request(search);assert.equal(response.status,200);const body=await response.json();
assert.deepEqual(body.places,[{latitude:10.3,longitude:123.9,label:'Fixture Hospital, Cebu, Philippines'}]);
assert.equal(new URL(lastUrl).searchParams.get('lat'),'10.312');assert.equal(new URL(lastUrl).searchParams.get('q'),'Cebu hospital');assert.ok(!lastUrl.includes('never-send'));
assert.equal((await request(search)).status,200);assert.equal(fetches,1,'Repeated search must use cache');
assert.equal((await request({query:'different query'})).status,429);
actor='fixture-user-2';fail=true;assert.equal((await request({query:'different hospital'})).status,502);
console.log('PASS actual place handler: authentication, caregiver access, bounded validated results, coarse bias, cache and throttling without patient data');
