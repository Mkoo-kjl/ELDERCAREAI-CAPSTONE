import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/src/lib/supabase';
import type { MapPosition } from '@/src/lib/location-map';
export type WatchTrackPoint = MapPosition & {id:string;device_id:string;elderly_id:string};
export function useWatchTrack(elderlyId?:string,deviceId?:string){
  const [points,setPoints]=useState<WatchTrackPoint[]>([]);const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    setPoints([]);setError(null);if(!elderlyId||!deviceId)return;
    let active=true;let loading=false;let latestMeasured=0;
    const receive=(rows:WatchTrackPoint[])=>{
      for(const point of rows)if(['watch_gps','fused','network'].includes(point.location_source)&&point.device_id===deviceId&&point.elderly_id===elderlyId&&Date.parse(point.measured_at)<=Date.now()+10_000)latestMeasured=Math.max(latestMeasured,Date.parse(point.measured_at)||0);
      merge(rows);
    };
    const merge=(rows:WatchTrackPoint[])=>setPoints(current=>Array.from(new Map([...current,...rows].map(point=>[point.id,point])).values())
      .filter(point=>['watch_gps','fused','network'].includes(point.location_source)&&point.device_id===deviceId&&point.elderly_id===elderlyId&&Date.parse(point.measured_at)>Date.now()-30*60_000&&Date.parse(point.measured_at)<=Date.now()+10_000).sort((a,b)=>Date.parse(a.measured_at)-Date.parse(b.measured_at)).slice(-500));
    const load=async()=>{
      if(loading)return;loading=true;
      try{const result=await supabase.from('watch_location_points').select('*').eq('elderly_id',elderlyId).eq('device_id',deviceId)
        .gte('measured_at',new Date(Math.max(Date.now()-30*60_000,latestMeasured-10_000)).toISOString()).order('measured_at',{ascending:false}).limit(500);
        if(!active)return;if(result.error)throw result.error;receive((result.data??[]) as WatchTrackPoint[]);setError(null);
      }catch{if(active)setError('The movement trail could not refresh. The latest marker can still update.');}finally{loading=false;}
    };
    const channel=supabase.channel(`watch-route:${deviceId}:${Date.now()}`).on('postgres_changes',
      {event:'INSERT',schema:'public',table:'watch_location_points',filter:`device_id=eq.${deviceId}`},payload=>{
        const point=payload.new as WatchTrackPoint;if(active&&point.device_id===deviceId&&point.elderly_id===elderlyId)receive([point]);
      }).subscribe(status=>{if(active&&status==='SUBSCRIBED')void load();});
    void load();const resume=AppState.addEventListener('change',status=>{if(status==='active')void load();});
    const reconcile=setInterval(()=>{if(AppState.currentState==='active')void load();},3_000);
    return()=>{active=false;clearInterval(reconcile);resume.remove();void supabase.removeChannel(channel);};
  },[elderlyId,deviceId]);
  return{points:points.filter(point=>point.elderly_id===elderlyId&&point.device_id===deviceId&&['watch_gps','fused','network'].includes(point.location_source)),error};
}
