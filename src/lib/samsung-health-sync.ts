import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import {Platform} from 'react-native';
import SamsungHealth,{type ImportedHealthSample,type SamsungHealthSource} from '@/modules/samsung-health';
import {supabase} from '@/src/lib/supabase';
export type SamsungLink={userId:string;elderlyId:string;sourceId:string;sourceName:string;sleep:boolean;oxygen:boolean};
const linkKey='eldercare:samsung-health-link';
const task='eldercare-samsung-health-import-v1';
const inFlight=new Map<string,Promise<number>>();
let connectionRevision=0;
const scopedLinkKey=(userId:string,elderlyId:string)=>`${linkKey}:${encodeURIComponent(userId)}:${encodeURIComponent(elderlyId)}`;
function parseLink(saved:string|null):SamsungLink|null{
  try{
    const link=saved?JSON.parse(saved):null;
    return link&&typeof link.userId==='string'&&typeof link.elderlyId==='string'&&typeof link.sourceId==='string'&&
      typeof link.sourceName==='string'&&typeof link.sleep==='boolean'&&typeof link.oxygen==='boolean'?link:null;
  }catch{return null;}
}
export async function getSamsungLink(userId?:string,elderlyId?:string):Promise<SamsungLink|null>{
  if(userId&&elderlyId){
    const scoped=parseLink(await AsyncStorage.getItem(scopedLinkKey(userId,elderlyId)));
    if(scoped?.userId===userId&&scoped.elderlyId===elderlyId)return scoped;
  }
  const legacy=parseLink(await AsyncStorage.getItem(linkKey));
  if(userId&&legacy?.userId!==userId||elderlyId&&legacy?.elderlyId!==elderlyId)return null;
  return legacy;
}
async function signedIn(userId:string){
  const {data:{session}}=await supabase.auth.getSession();
  if(session?.user.id!==userId)throw Error('The signed-in caregiver changed. Connect Health history again.');
  return session;
}
async function saveLink(link:SamsungLink){
  await AsyncStorage.setItem(scopedLinkKey(link.userId,link.elderlyId),JSON.stringify(link));
  await signedIn(link.userId);
  await AsyncStorage.setItem(linkKey,JSON.stringify(link));
}
async function registerBackgroundImport(){
  if(Platform.OS==='android'&&await BackgroundTask.getStatusAsync()===BackgroundTask.BackgroundTaskStatus.Available)
    await BackgroundTask.registerTaskAsync(task,{minimumInterval:15}).catch(()=>undefined);
}
/** Recover only the source explicitly linked to this caregiver/patient. Never
 * choose another watch just because it happens to be paired to this phone.
 */
export async function restoreSamsungHealthLink(userId:string,elderlyId:string){
  const version=connectionRevision;
  await signedIn(userId);
  let link=await getSamsungLink(userId,elderlyId);
  if(!link){
    const {data,error}=await supabase.from('samsung_health_links').select('source_device_id,source_name')
      .eq('caregiver_id',userId).eq('elderly_id',elderlyId).maybeSingle();
    if(error)throw Error('Unable to restore Health history. Saved readings are still available. Try again when connected.');
    if(!data)return null;
    if(!SamsungHealth?.getAccess)throw Error('Reconnect Health history once, or install the updated phone app to restore this account’s connection. Saved readings are retained.');
    const permissions=await SamsungHealth.getAccess();
    if(!permissions.sleep&&!permissions.oxygen)throw Error('Reconnect Health history and allow Sleep or Blood oxygen access. Saved readings are retained.');
    link={userId,elderlyId,sourceId:data.source_device_id,sourceName:data.source_name,...permissions};
  }
  await signedIn(userId);
  if(version!==connectionRevision)return null;
  await saveLink(link);
  await registerBackgroundImport();
  return link;
}
async function action(body:Record<string,unknown>,userId:string){
  const session=await signedIn(userId);
  // Pin the credential to the checked owner: an account change must not send
  // the preceding account's queued samples under the new account's token.
  const {data,error}=await supabase.functions.invoke('galaxy-watch',{body,headers:{Authorization:`Bearer ${session.access_token}`}});
  if(error||data?.error){
    let detail=typeof data?.error==='string'?data.error:null;
    const response=error?.context;
    let serverCode:string|null=null;
    // functions.invoke keeps non-2xx JSON in error.context, rather than data.
    if(response&&typeof response.json==='function')try{
      const payload=await response.json();
      if(typeof payload?.error==='string')detail=payload.error;
      if(typeof payload?.code==='string')serverCode=payload.code;
    }catch{/* Non-JSON gateway/network errors still need a useful retry message. */}
    const status=typeof response?.status==='number'?` (HTTP ${response.status}${serverCode?`, ${serverCode}`:''})`:'';
    throw Error(`${detail?.replaceAll('Samsung Health','Health history')??'Health history upload failed. Saved SDK records will be retried.'}${status}`);
  }
  return data;
}
export async function connectSamsungHealth(userId:string,elderlyId:string,source:SamsungHealthSource,permissions:{sleep:boolean;oxygen:boolean}){
  const version=++connectionRevision;
  await action({action:'link_samsung_health',source_device_id:source.id,source_name:`${source.name} ${source.model}`},userId);
  await signedIn(userId);
  if(version!==connectionRevision)throw Error('Health history connection changed.');
  await saveLink({userId,elderlyId,sourceId:source.id,sourceName:source.name||source.model,...permissions});
  await registerBackgroundImport();
}
export async function disconnectSamsungHealth(userId?:string,elderlyId?:string){
  const link=await getSamsungLink(userId,elderlyId);if(!link)return;
  const version=++connectionRevision;
  await action({action:'unlink_samsung_health'},link.userId);
  if(version!==connectionRevision)return;
  await AsyncStorage.removeItem(scopedLinkKey(link.userId,link.elderlyId));
  const active=await getSamsungLink();
  if(active?.userId===link.userId&&active.elderlyId===link.elderlyId)await AsyncStorage.removeItem(linkKey);
  if(Platform.OS==='android'&&await TaskManager.isTaskRegisteredAsync(task))await BackgroundTask.unregisterTaskAsync(task);
}
export async function clearSamsungHealthLocalLink(){
  ++connectionRevision;
  // Sign-out pauses imports; it does not unlink this patient's history source.
  const link=await getSamsungLink();
  if(link)await AsyncStorage.setItem(scopedLinkKey(link.userId,link.elderlyId),JSON.stringify(link));
  await AsyncStorage.removeItem(linkKey);
  if(Platform.OS==='android'&&await TaskManager.isTaskRegisteredAsync(task))await BackgroundTask.unregisterTaskAsync(task);
}
export async function syncSamsungHealth(userId?:string,elderlyId?:string):Promise<number>{
  if(!SamsungHealth)return 0;
  const link=await getSamsungLink(userId,elderlyId);if(!link)return 0;
  const version=connectionRevision;
  const key=JSON.stringify([link.userId,link.elderlyId,link.sourceId,version]);
  const running=inFlight.get(key);if(running)return running;
  const job=runSync(link,version).finally(()=>{if(inFlight.get(key)===job)inFlight.delete(key);});
  inFlight.set(key,job);return job;
}
async function runSync(link:SamsungLink,version:number){
  if(!SamsungHealth)return 0;
  const {data:{session}}=await supabase.auth.getSession();
  if(!session||session.user.id!==link.userId)throw Error('Sign in to the linked caregiver account before syncing Health history.');
  const checkpointKey=`samsung-health-progress:${link.userId}:${link.elderlyId}:${link.sourceId}`;
  const saved=await AsyncStorage.getItem(checkpointKey);
  let progress:Record<string,{revision:string;offset:number}> = {};
  try{
    const parsed=saved?JSON.parse(saved):{};
    if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))for(const [key,value] of Object.entries(parsed)){
      const entry=value as {revision?:unknown;offset?:unknown};
      if(entry&&typeof entry.revision==='string'&&Number.isFinite(Date.parse(entry.revision))&&typeof entry.offset==='number'&&Number.isSafeInteger(entry.offset)&&entry.offset>=0)
        progress[key]={revision:entry.revision,offset:entry.offset};
    }
  }catch{/* Invalid local checkpoints can safely replay server-deduplicated records. */}
  let inserted=0;
  const completed:string[]=[];
  const lastSync=await AsyncStorage.getItem(`samsung-health-last-sync:${link.userId}:${link.elderlyId}`);
  for(const kind of ['sleep','oxygen'] as const){
    if(!link[kind])continue;
    const label=kind==='sleep'?'Sleep':'Blood oxygen';
    try{
    const until=new Date().toISOString();const defaultFrom=Date.now()-(kind==='sleep'?30:7)*86400_000;
    const from=new Date(lastSync&&Number.isFinite(Date.parse(lastSync))?Math.min(defaultFrom,Date.parse(lastSync)-86400_000):defaultFrom).toISOString();
    let cursor:string|null=null;
    do{
      const current=await getSamsungLink(link.userId,link.elderlyId);if(version!==connectionRevision||!current||current.sourceId!==link.sourceId)throw Error('Health history connection changed.');
      const page=await SamsungHealth.readPage(kind,link.sourceId,from,until,cursor);
      await signedIn(link.userId);
      if(version!==connectionRevision)throw Error('Health history connection changed.');
      const groups=new Map<string,ImportedHealthSample[]>();
      for(const sample of page.records){const key=sample.source_group_key;groups.set(key,[...(groups.get(key)??[]),sample]);}
      for(const [group,records] of groups){
        records.sort((a,b)=>Date.parse(a.measured_at)-Date.parse(b.measured_at)||a.source_record_key.localeCompare(b.source_record_key));
        const revision=records[0].source_revision_at;
        let offset=progress[group]?.revision===revision?progress[group].offset:0;
        while(offset<records.length){
          const active=await getSamsungLink(link.userId,link.elderlyId);const {data:{session:currentSession}}=await supabase.auth.getSession();
          if(version!==connectionRevision||!active||active.sourceId!==link.sourceId||currentSession?.user.id!==link.userId)throw Error('Health history connection changed.');
          const batch=records.slice(offset,offset+120);
          const result=await action({action:'import_samsung_health',source_device_id:link.sourceId,samples:batch},link.userId);
          inserted+=Number(result.inserted??0);offset+=batch.length;
          progress[group]={revision,offset};
          await AsyncStorage.setItem(checkpointKey,JSON.stringify(progress));
        }
      }
      cursor=page.cursor;
    }while(cursor);
      completed.push(label);
    }catch(error){
      const detail=error instanceof Error?error.message:'The import could not finish.';
      throw Error(`${completed.length?`${completed.join(' and ')} check completed. `:''}${label} sync paused: ${detail} Previously saved readings are retained.`);
    }
  }
  await signedIn(link.userId);
  if(version!==connectionRevision)throw Error('Health history connection changed.');
  await AsyncStorage.setItem(`samsung-health-last-sync:${link.userId}:${link.elderlyId}`,new Date().toISOString());
  return inserted;
}
if(Platform.OS==='android'&&!TaskManager.isTaskDefined(task))TaskManager.defineTask(task,async()=>{
  try{await syncSamsungHealth();return BackgroundTask.BackgroundTaskResult.Success;}catch{return BackgroundTask.BackgroundTaskResult.Failed;}
});
