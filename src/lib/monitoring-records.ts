import type {VitalLog} from '@/src/providers/HealthDataProvider';
import type {VitalMetric} from './vital-time';
import {careZoneParts} from './care-time';
export const STEP_DAY_TIMEZONE='Asia/Manila';
export function dailyStepRecords(rows:VitalLog[]){
  const days=new Map<string,VitalLog>();
  for(const row of rows){
    if(row.is_superseded||typeof row.steps_count!=='number'||!Number.isFinite(row.steps_count)||row.steps_count<0)continue;
    const at=row.measurement_times?.steps_count??row.recorded_at;
    if(!Number.isFinite(Date.parse(at)))continue;
    const day=row.steps_day??careZoneParts(new Date(at),STEP_DAY_TIMEZONE).day;
    const previous=days.get(day),previousAt=previous?.measurement_times?.steps_count??previous?.recorded_at??'';
    if(!previous||row.steps_count>previous.steps_count!||row.steps_count===previous.steps_count&&Date.parse(at)>Date.parse(previousAt))days.set(day,{...row,steps_day:day});
  }
  return [...days.values()].sort((a,b)=>a.steps_day!.localeCompare(b.steps_day!));
}
export function metricRecords(rows:VitalLog[],metric:VitalMetric,from=-Infinity,to=Infinity){
  const seen=new Set<string>();
  return (metric==='steps_count'?dailyStepRecords(rows):rows).filter(row=>!row.is_superseded).map(row=>({row,value:row[metric],at:row.measurement_times?.[metric]??row.recorded_at})).filter((item):item is {row:VitalLog;value:number;at:string}=>{
    const at=Date.parse(item.at),key=`${item.row.id}:${metric}`;
    if(typeof item.value!=='number'||!Number.isFinite(item.value)||!Number.isFinite(at)||at<from||at>=to||seen.has(key))return false;seen.add(key);return true;
  }).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.row.id.localeCompare(b.row.id));
}
