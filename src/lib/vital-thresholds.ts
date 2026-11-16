import {VITAL_REVIEW_RULES} from './vital-review';
export const thresholdFields=[
  ['heartRateLow','Heart rate below (BPM)',1,349,50],
  ['heartRateHigh','Heart rate above (BPM)',2,350,110],
  ['oxygenLow','Blood oxygen below (%)',2,100,95],
  ['oxygenCritical','Critical blood oxygen at or below (%)',1,99,92],
  ['sleepHoursLow','Recorded sleep below (hours)',0,24,5],
  ['skinTemperatureChangeC','Wrist temperature change (°C)',0.1,10,0.8],
  ['hrvLow','HRV below (ms) · optional',1,500,null],
  ['stressHigh','Stress estimate above (0–100) · optional',0,100,null],
  ['stepsHigh','Daily monitored steps above · optional',1,200000,null],
] as const;
export type ThresholdKey=typeof thresholdFields[number][0];
export type PatientThresholds=Record<ThresholdKey,number|null>;
export const DEFAULT_PATIENT_THRESHOLDS:PatientThresholds=Object.fromEntries(thresholdFields.map(field=>[field[0],field[4]])) as PatientThresholds;
export function patientThresholds(value:unknown):PatientThresholds{
  const result={...DEFAULT_PATIENT_THRESHOLDS},row=value&&typeof value==='object'?value as Record<string,unknown>:{};
  for(const [key,,min,max,fallback] of thresholdFields){const n=row[key];if(typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max)result[key]=n;else result[key]=fallback;}
  if(result.heartRateLow!>=result.heartRateHigh!){result.heartRateLow=50;result.heartRateHigh=110;}
  result.oxygenCritical=Math.min(result.oxygenCritical!,result.oxygenLow!-1);
  return result;
}
export type PatientReviewRules=Omit<typeof VITAL_REVIEW_RULES,ThresholdKey>&{heartRateLow:number;heartRateHigh:number;oxygenLow:number;oxygenCritical:number;sleepHoursLow:number;skinTemperatureChangeC:number;hrvLow:number|null;stressHigh:number|null;stepsHigh:number|null};
export function patientReviewRules(value:unknown):PatientReviewRules{return {...VITAL_REVIEW_RULES,...patientThresholds(value)} as PatientReviewRules;}
export function thresholdDraftError(draft:Record<ThresholdKey,string>){
  for(const [key,label,min,max,fallback] of thresholdFields){const text=draft[key].trim();if(!text&&fallback===null)continue;const n=Number(text);if(!text||!Number.isFinite(n)||n<min||n>max)return `${label}: enter a number from ${min} to ${max}.`;}
  if(Number(draft.heartRateLow)>=Number(draft.heartRateHigh))return 'Heart rate lower threshold must be less than the upper threshold.';
  if(Number(draft.oxygenCritical)>=Number(draft.oxygenLow))return 'Critical oxygen threshold must be below the oxygen warning threshold.';
  if(draft.stepsHigh&& !Number.isInteger(Number(draft.stepsHigh)))return 'Steps threshold must be a whole number.';
  return null;
}
