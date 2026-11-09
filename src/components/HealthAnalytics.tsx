import {MonitoringChart} from './MonitoringChart';
import {metricRecords,STEP_DAY_TIMEZONE} from '@/src/lib/monitoring-records';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,View,useColorScheme} from 'react-native';
import {AppText as Text} from './AppText';
import {PickerModal} from './PickerModal';
import {VitalStatusBadge} from './VitalStatusBadge';
import {supabase} from '@/src/lib/supabase';
import {useHealthData,type VitalLog} from '@/src/providers/HealthDataProvider';
import {formatCareDateTime,localDateKey,careZoneParts} from '@/src/lib/care-time';
import {medicationVitalOptions} from '@/src/lib/medication';
import type {VitalMetric} from '@/src/lib/vital-time';
import {vitalStatus,vitalWellnessSuggestion} from '@/src/lib/vital-status';
import {getTheme,palette} from '@/src/theme/colors';

const units:Record<VitalMetric,string>={heart_rate_bpm:'BPM',spo2_percent:'%',skin_temp_celsius:'°C',sleep_hours:'hours',steps_count:'steps',hrv_rmssd_ms:'ms HRV'};
export function PreventiveInsights(){
  const {history,vital}=useHealthData();const theme=getTheme(useColorScheme()==='dark');
  return <View style={{gap:12}}><Text style={{color:theme.text,fontSize:20}}>Preventive care insights</Text><Text style={{color:theme.subtitle,lineHeight:21}}>General wellness guidance based on recorded measurements. These rules and experimental estimates are not diagnoses or professional medical advice. Confirm concerning readings and contact a healthcare professional when concerns persist or symptoms occur.</Text>{medicationVitalOptions.map(([metric,label])=>{
    const records=metricRecords(history,metric),latest=records.at(-1),live=typeof vital?.[metric]==='number'?vital:null;
    const row=live??latest?.row??null,at=row?.measurement_times?.[metric]??row?.recorded_at;
    const values=records.slice(-6).map(x=>x.value),change=values.length>=2?values.at(-1)!-values[0]:null;
    return <View key={metric} style={{padding:16,backgroundColor:theme.cardElevated,borderRadius:14,gap:8}}><Text style={{fontSize:17,color:theme.text}}>{label}</Text><VitalStatusBadge status={vitalStatus(metric,row,history)}/><Text style={{color:theme.subtitle}}>{at?formatCareDateTime(at):'No measurement recorded'}</Text><Text style={{color:theme.text,lineHeight:21}}>{vitalStatus(metric,row,history).detail}</Text>{latest?<><Text style={{color:theme.text}}>Latest saved: {latest.value.toLocaleString(undefined,{maximumFractionDigits:2})} {units[metric]}</Text>{change!==null&&metric!=='steps_count'?<Text style={{color:theme.subtitle}}>Change across {values.length} saved readings: {change>=0?'+':''}{change.toFixed(1)} {units[metric]}. Samples may have different intervals.</Text>:null}<Text style={{color:theme.subtitle,lineHeight:21}}>General wellness: {vitalWellnessSuggestion(metric)}</Text></>:null}</View>;
  })}</View>;
}

export function HealthAnalytics(){
  const theme=getTheme(useColorScheme()==='dark');const {elderly}=useHealthData();
  const [metric,setMetric]=useState<VitalMetric>('heart_rate_bpm'),[from,setFrom]=useState(()=>{const date=new Date();date.setDate(date.getDate()-6);return localDateKey(date);}),[to,setTo]=useState(()=>localDateKey());
  const [picker,setPicker]=useState<'from'|'to'|null>(null),[rows,setRows]=useState<VitalLog[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[limited,setLimited]=useState(false),[shown,setShown]=useState(50),[ascending,setAscending]=useState(false);
  const generation=useRef(0);
  const invalidate=useCallback(()=>{generation.current++;},[]);const patient=elderly?.elderly_id;
  const load=useCallback(async()=>{
    const current=++generation.current;
    if(!patient){setRows([]);return;}
    if(from>to){setError('Choose an end date on or after the start date.');setRows([]);return;}
    setLoading(true);setError('');
    try{
      const start=new Date(`${from}T00:00:00`),end=new Date(`${to}T00:00:00`);end.setDate(end.getDate()+1);
      const collected:VitalLog[]=[];
      if(metric==='steps_count')for(let offset=0;offset<5000;offset+=1000){
        const result=await supabase.rpc('daily_step_history',{p_elderly:patient,p_from:from,p_until:to}).range(offset,offset+999);
        if(result.error)throw result.error;if(generation.current!==current)return;
        collected.push(...(result.data??[]) as VitalLog[]);if((result.data?.length??0)<1000)break;
      }
      else for(let offset=0;offset<5000;offset+=1000){
        const result=await supabase.from('vital_sign_logs').select('*').eq('elderly_id',patient).eq('source','galaxy_watch').eq('is_superseded',false).not(metric,'is',null).gte('recorded_at',start.toISOString()).lt('recorded_at',end.toISOString()).order('recorded_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999);
        if(result.error)throw result.error;if(generation.current!==current)return;
        collected.push(...(result.data??[]) as VitalLog[]);if((result.data?.length??0)<1000)break;
      }
      if(generation.current===current){setRows(collected);setLimited(collected.length>=5000);setShown(50);}
    }catch{if(generation.current===current)setError('Records could not load. Check your connection and retry; no sample data is displayed.');}
    finally{if(generation.current===current)setLoading(false);}
  },[patient,metric,from,to]);
  useEffect(()=>{
    setRows([]);void load();
    const channel=patient?supabase.channel(`analytics:${patient}:${metric}:${Date.now()}`).on('postgres_changes',{event:'*',schema:'public',table:'vital_sign_logs',filter:`elderly_id=eq.${patient}`},payload=>{
      const row=payload.new as VitalLog,removed=payload.old as Partial<VitalLog>;
      if(payload.eventType==='DELETE'){setRows(current=>current.filter(item=>item.id!==removed.id));return;}
      if(!row?.id||row.elderly_id!==patient||row.source!=='galaxy_watch')return;
      const until=new Date(`${to}T00:00:00`);until.setDate(until.getDate()+1);
      const at=Date.parse(row.recorded_at),day=row.steps_day??(Number.isFinite(at)?careZoneParts(new Date(at),STEP_DAY_TIMEZONE).day:'');
      const inRange=metric==='steps_count'?day>=from&&day<=to:at>=Date.parse(`${from}T00:00:00`)&&at<until.getTime();
      setRows(current=>{const remaining=current.filter(item=>item.id!==row.id);return row.is_superseded||!inRange||typeof row[metric]!=='number'?remaining:[row,...remaining].sort((a,b)=>Date.parse(b.recorded_at)-Date.parse(a.recorded_at)||b.id.localeCompare(a.id)).slice(0,5000);});
    }).subscribe():null;
    return()=>{invalidate();if(channel)void supabase.removeChannel(channel);};
  },[load,patient,metric,from,to,invalidate]);

  const end=new Date(`${to}T00:00:00`);end.setDate(end.getDate()+1);
  const records=metricRecords(rows,metric,metric==='steps_count'?-Infinity:Date.parse(`${from}T00:00:00`),metric==='steps_count'?Infinity:end.getTime()),values=records.map(x=>x.value),min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):0,mean=values.length?values.reduce((sum,x)=>sum+x,0)/values.length:null;
  const ordered=ascending?records:[...records].reverse();
  const daily=metric==='steps_count';
  const number=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:2});
  return <View style={{gap:14}}><Text style={{fontSize:21,color:theme.text}}>Monitoring analytics</Text><Text style={{color:theme.subtitle}}>{daily?'One daily step total · calendar days in Asia/Manila':`Saved database measurements · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{medicationVitalOptions.map(([key,label])=><Pressable key={key} accessibilityRole="radio" accessibilityState={{selected:key===metric}} onPress={()=>setMetric(key)} style={{padding:11,borderRadius:11,backgroundColor:key===metric?palette.aquaSurface:theme.cardElevated}}><Text style={{color:key===metric?palette.primaryDark:theme.text}}>{key==='steps_count'?'Steps':label}</Text></Pressable>)}</View>
    <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}><Pressable onPress={()=>setPicker('from')} style={{padding:13,borderRadius:12,backgroundColor:theme.cardElevated}}><Text style={{color:theme.text}}>From: {from}</Text></Pressable><Pressable onPress={()=>setPicker('to')} style={{padding:13,borderRadius:12,backgroundColor:theme.cardElevated}}><Text style={{color:theme.text}}>To: {to}</Text></Pressable><Pressable onPress={()=>void load()} style={{padding:13}}><Text style={{color:palette.primaryDark}}>Refresh</Text></Pressable></View>
    {loading?<ActivityIndicator accessibilityLabel="Loading saved health records" color={palette.primaryDark}/>:null}{error?<Text accessibilityRole="alert" style={{color:palette.error}}>{error}</Text>:null}{!loading&&!error&&!records.length?<Text style={{color:theme.subtitle}}>No recorded measurements in this range. Choose other dates or start monitoring.</Text>:null}
    {records.length?<><Text style={{color:theme.text}}>{records.length.toLocaleString()} {daily?(records.length===1?'day':'days'):'records'} · Min {number(min)} · Max {number(max)} {units[metric]}</Text><Text style={{color:theme.subtitle}}>Mean {number(mean!)} {units[metric]} · Change {number(values.at(-1)!-values[0])} {units[metric]}{daily?` · Total ${number(values.reduce((sum,value)=>sum+value,0))} steps across recorded days`:''}</Text>{limited?<Text style={{color:palette.warning}}>Showing the latest 5,000 records only. Narrow the date range for complete statistics.</Text>:null}
      <MonitoringChart records={records.map(point=>({id:point.row.id,value:point.value,at:point.at}))} unit={units[metric]} daily={daily}/>
      <Pressable accessibilityRole="button" onPress={()=>setAscending(!ascending)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:palette.primaryDark}}>Records: {ascending?'earliest first':'latest first'} · tap to reverse</Text></Pressable>
      {ordered.slice(0,shown).map(point=><View key={point.row.id} style={{padding:13,borderBottomWidth:1,borderBottomColor:theme.border,gap:5}}><Text style={{color:theme.text}}>{daily?`${point.row.steps_day} · `:''}{number(point.value)} {units[metric]} · {formatCareDateTime(point.at)}</Text><VitalStatusBadge status={vitalStatus(metric,point.row,rows)}/></View>)}{shown<records.length?<Pressable onPress={()=>setShown(shown+50)} style={{padding:15}}><Text style={{color:palette.primaryDark}}>Show more records</Text></Pressable>:null}
    </>:null}
    <PickerModal visible={picker!==null} mode="date" title={picker==='from'?'Start date':'End date'} value={new Date(`${picker==='from'?from:to}T12:00:00`)} onChange={date=>picker==='from'?setFrom(localDateKey(date)):setTo(localDateKey(date))} onClose={()=>setPicker(null)}/>
  </View>;
}
