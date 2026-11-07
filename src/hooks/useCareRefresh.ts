import {useEffect} from 'react';
import {AppState} from 'react-native';
import {supabase} from '@/src/lib/supabase';
const tables=['medication_schedules','medication_logs','appointments','caregiver_notes','health_alerts','emergency_events','caregiver_notifications'];
export function useCareRefresh(elderlyId:string|undefined,load:()=>Promise<void>){
  useEffect(()=>{
    if(!elderlyId)return;
    const channel=supabase.channel(`watch-care:${elderlyId}:${Date.now()}`);
    const refresh=()=>{void load().catch(()=>undefined);};
    for(const table of tables)channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`elderly_id=eq.${elderlyId}`},refresh);
    channel.subscribe(status=>{if(status==='SUBSCRIBED')refresh();});
    const timer=setInterval(()=>{if(AppState.currentState==='active')refresh();},15_000);
    const resume=AppState.addEventListener('change',state=>{if(state==='active')refresh();});
    return()=>{clearInterval(timer);resume.remove();void supabase.removeChannel(channel);};
  },[elderlyId,load]);
}
