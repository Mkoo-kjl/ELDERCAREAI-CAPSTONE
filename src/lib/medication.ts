import type {VitalMetric} from './vital-time';
export type MedicationRecord={id:string;medication_name:string;dosage:string|null;frequency:string;instructions:string|null;color_tag:string|null;is_active:boolean;times_of_day:string[]|null;reminder_enabled:boolean|null;start_date:string|null;end_date?:string|null;prescribed_by?:string|null;timezone?:string;image_path?:string|null;prescription_path?:string|null;prescription_reviewed_at?:string|null;related_vitals?:VitalMetric[]};
export const medicationVitalOptions:[VitalMetric,string][]=[['heart_rate_bpm','Heart rate'],['spo2_percent','Blood oxygen'],['sleep_hours','Sleep'],['steps_count','Activity'],['skin_temp_celsius','Skin temperature'],['hrv_rmssd_ms','Stress / HRV']];
export const medicationSelect='id,medication_name,dosage,frequency,instructions,color_tag,is_active,times_of_day,reminder_enabled,start_date,end_date,prescribed_by,timezone,image_path,prescription_path,prescription_reviewed_at,related_vitals';
export function vitalForRule(rule:string|undefined):VitalMetric|null{
  if(rule==='heart_low'||rule==='heart_high')return 'heart_rate_bpm';
  if(rule==='oxygen_low')return 'spo2_percent';
  if(rule==='sleep_short')return 'sleep_hours';
  if(rule==='skin_change')return 'skin_temp_celsius';
  if(rule==='stress_high')return 'hrv_rmssd_ms';
  return null;
}
