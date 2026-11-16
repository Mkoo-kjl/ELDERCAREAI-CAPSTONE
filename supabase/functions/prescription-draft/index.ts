import {createClient} from 'npm:@supabase/supabase-js@2';
import {corsHeaders,json} from '../_shared/cors.ts';
import {isActiveCaregiver} from '../_shared/caregiver-access.ts';
import {extractPrescription,prescriptionModels,PrescriptionExtractionError} from '../_shared/prescription-extraction.ts';

const pending=new Set<string>();
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const aiKey=Deno.env.get('GEMINI_API_KEY')??Deno.env.get('GOOGLE_AI_API_KEY');
  if(!url||!key)return json({error:'Prescription service is unavailable.'},503);
  const admin=createClient(url,key,{auth:{persistSession:false}});
  const bearer=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
  if(!bearer)return json({error:'Sign in before importing a prescription.'},401);
  const auth=await admin.auth.getUser(bearer);const user=auth.data?.user;
  if(auth.error||!user)return json({error:'Your session expired. Sign in again.'},401);
  if(!await isActiveCaregiver(admin,user.id))return json({error:'Active caregiver access required.'},403);
  if(pending.has(user.id))return json({error:'An extraction is already running. Wait for it to finish.'},429);
  pending.add(user.id);
  try{
    const input=await request.json().catch(()=>null);
    if(!input||typeof input.elderly_id!=='string'||typeof input.path!=='string'||input.path.length>500||input.path.includes('..')||!input.path.startsWith(`${user.id}/${input.elderly_id}/prescription-`))return json({error:'Choose a prescription image for the selected patient.'},400);
    const patient=await admin.from('elderly_profiles').select('elderly_id').eq('elderly_id',input.elderly_id).eq('caregiver_id',user.id).maybeSingle();
    if(patient.error||!patient.data)return json({error:'This patient is not available to the signed-in caregiver.'},403);
    if(!aiKey)return json({error:'Prescription extraction needs the server Gemini API key. Manual entry is still available.'},503);
    const image=await admin.storage.from('care-files').download(input.path);
    if(image.error||!image.data)return json({error:'The private prescription image could not be read. Upload it again.'},404);
    if(!['image/jpeg','image/png','image/webp'].includes(image.data.type)||image.data.size>10*1024*1024)return json({error:'Use a JPG, PNG or WebP prescription image under 10 MB.'},400);
    const bytes=new Uint8Array(await image.data.arrayBuffer());let binary='';
    for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    const draft=await extractPrescription({apiKey:aiKey,models:prescriptionModels(Deno.env.get('PRESCRIPTION_MODEL')??Deno.env.get('GEMINI_MODEL'),Deno.env.get('PRESCRIPTION_FALLBACK_MODELS')??Deno.env.get('GEMINI_FALLBACK_MODELS')),mimeType:image.data.type,image:btoa(binary)});
    return json({...draft,review_required:true});
  }catch(error){
    if(error instanceof PrescriptionExtractionError)return json({error:error.message,code:error.code},error.status);
    console.error('prescription_extraction_failed',{kind:error instanceof Error?error.name:'unknown'});
    return json({error:'Extraction did not finish. Your image is retained and no medication was created. Retry.',code:'extraction_failed'},500);
  }
  finally{pending.delete(user.id);}
});
