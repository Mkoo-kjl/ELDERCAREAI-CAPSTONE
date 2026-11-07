import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {supabase} from '@/src/lib/supabase';
import {type SafeZone,type SafeZoneEvent,type SafeZoneState,type ZoneOverlay,zoneInputError} from '@/src/lib/safe-zone';

export function useSafeZone(caregiverId?:string,elderlyId?:string){
  const identity=`${caregiverId??''}:${elderlyId??''}`;
  const activeIdentity=useRef(identity);activeIdentity.current=identity;
  const [data,setData]=useState<{identity:string;zone:SafeZone|null;state:SafeZoneState|null;events:SafeZoneEvent[]}>({identity,zone:null,state:null,events:[]});
  const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false);
  const savingRef=useRef<string|null>(null),refreshRef=useRef<()=>Promise<void>>(async()=>{});
  useEffect(()=>{
    let active=true,request=0;
    savingRef.current=null;setSaving(false);
    setData({identity,zone:null,state:null,events:[]});setError(null);setLoading(Boolean(caregiverId&&elderlyId));
    const load=async()=>{
      if(!caregiverId||!elderlyId)return;
      const sequence=++request;
      try{
        const results=await Promise.all([
          supabase.from('patient_safe_zones').select('*').eq('elderly_id',elderlyId).eq('caregiver_id',caregiverId).maybeSingle(),
          supabase.from('patient_safe_zone_state').select('*').eq('elderly_id',elderlyId).maybeSingle(),
          supabase.from('safe_zone_events').select('*').eq('elderly_id',elderlyId).order('measured_at',{ascending:false}).limit(4),
        ]);
        if(!active||sequence!==request)return;
        const failure=results.find(r=>r.error)?.error;if(failure)throw failure;
        setData({identity,zone:results[0].data as SafeZone|null,state:results[1].data as SafeZoneState|null,events:(results[2].data??[]) as SafeZoneEvent[]});setError(null);
      }catch{if(active&&sequence===request)setError('Safe-zone status could not refresh. Check your connection and retry.');}
      finally{if(active&&sequence===request)setLoading(false);}
    };
    refreshRef.current=load;void load();
    if(!caregiverId||!elderlyId)return()=>{active=false;};
    let channel=supabase.channel(`safe-zone:${identity}:${Date.now()}`);
    for(const table of ['patient_safe_zones','patient_safe_zone_state','safe_zone_events'])channel=channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`elderly_id=eq.${elderlyId}`},()=>void load());
    channel.subscribe();const timer=setInterval(()=>void load(),15_000);
    const resume=AppState.addEventListener('change',s=>{if(s==='active')void load();});
    return()=>{active=false;request++;clearInterval(timer);resume.remove();void supabase.removeChannel(channel);};
  },[caregiverId,elderlyId,identity]);
  const save=useCallback(async(zone:ZoneOverlay&{enabled:boolean})=>{
    if(savingRef.current)throw new Error('A save is already in progress.');
    if(!caregiverId||!elderlyId)throw new Error('Your patient profile is not ready.');
    const invalid=zoneInputError(zone.name,zone.latitude,zone.longitude,zone.radius_m);if(invalid)throw new Error(invalid);
    const operation=`${identity}:${Date.now()}`;savingRef.current=operation;setSaving(true);const owner=identity;
    try{
      const result=await supabase.rpc('save_patient_safe_zone',{p_elderly:elderlyId,p_name:zone.name.trim(),p_latitude:zone.latitude,p_longitude:zone.longitude,p_radius:zone.radius_m,p_enabled:zone.enabled});
      if(result.error)throw new Error('Safe zone was not saved. Check your connection and try again.');
      if(activeIdentity.current!==owner)throw new Error('The active patient changed.');
      await refreshRef.current();
    }finally{if(savingRef.current===operation){savingRef.current=null;if(activeIdentity.current===owner)setSaving(false);}}
  },[caregiverId,elderlyId,identity]);
  const current=data.identity===identity?data:{zone:null,state:null,events:[]};
  return {...current,loading,error,saving,save,refresh:()=>refreshRef.current()};
}
