import type {VitalLog} from '@/src/providers/HealthDataProvider';
import type {VitalMetric} from './vital-time';
import {VITAL_REVIEW_RULES as rules} from './vital-review';

export type VitalStatus = {tone:'normal'|'attention'|'critical'|'neutral';label:string;detail:string};
const status=(tone:VitalStatus['tone'],label:string,detail:string):VitalStatus=>({tone,label,detail});
/** Display rules are wellness context, not diagnoses or individualized clinical limits. */
export function vitalStatus(metric:VitalMetric,reading:Partial<VitalLog>|null|undefined,history:VitalLog[]=[]):VitalStatus {
  const value=reading?.[metric];
  if(typeof value!=='number'||!Number.isFinite(value))return status('neutral','No reading','Waiting for a recorded measurement.');
  switch(metric){
    case 'heart_rate_bpm':
      if(value<1||value>350)return status('neutral','Check reading','The value is outside the supported sensor range.');
      if(value<rules.heartRateLow)return status('attention','Low · Attention required','Below the app’s 50 BPM review threshold. Confirm the reading and consider symptoms and activity.');
      if(value>rules.heartRateHigh)return status('attention','High · Attention required','Above the app’s 110 BPM review threshold. Confirm after resting; seek professional advice if persistent or symptomatic.');
      if(value>=80)return status('attention','High · App band','80–110 BPM is your app’s high display band. The automatic high-heart-rate warning starts above 110 BPM. Activity and symptoms still matter.');
      return status('normal','Good · App band','50–79 BPM is your selected app display band, not an individualized clinical assessment.');
    case 'spo2_percent':
      if(value<1||value>100)return status('neutral','Check reading','Confirm sensor fit and repeat the measurement.');
      if(value<=92)return status('critical','Critical · Recheck now','A low wearable estimate needs prompt confirmation. Seek urgent medical advice if confirmed, or emergency help for severe symptoms.');
      if(value<rules.oxygenLow)return status('attention','Low · Attention required','Below 95%. Recheck while still and seek professional advice if the low result persists.');
      return status('normal','Normal range','This recorded estimate is at least 95%; symptoms and your clinician’s target still matter.');
    case 'sleep_hours':
      if(value<0||value>24)return status('neutral','Check record','Sleep duration is outside the supported range.');
      if(value<5)return status('attention','Short · Attention required','Under the app’s 5-hour review threshold. Discuss persistent short sleep or daytime problems with a healthcare professional.');
      if(value<7)return status('attention','Fair · Short duration','Below the general 7–9 hour adult sleep guide. Duration alone does not establish sleep quality.');
      if(value<=9)return status('normal','Good duration','Within the general 7–9 hour adult sleep guide. This is not a sleep-quality score.');
      return status('neutral','Longer duration','Above 9 hours; review changes from usual sleep and daytime symptoms. Longer sleep alone is not an emergency.');
    case 'steps_count':
      return value<0?status('neutral','Check record','Invalid step count.'):status('neutral',value===0?'No steps recorded':'Activity recorded','Recorded steps during monitoring today; unmonitored activity may be missing. This is not a medical activity target. Follow the patient’s agreed mobility plan.');
    case 'hrv_rmssd_ms': {
      const score=reading?.stress_score;
      if(typeof score!=='number'||!Number.isFinite(score))return status('neutral','Learning baseline','HRV is available; more personal reference periods are needed for the experimental stress estimate.');
      return score>=70?status('attention','Elevated estimate','Experimental HRV-based score, not medical grade or a diagnosis of stress. Compare during similar quiet periods.'):
        score>=40?status('neutral','Moderate estimate','Experimental personal HRV comparison; activity, sleep and sensor contact affect the result.'):
        status('normal','Low estimate','Experimental personal HRV comparison, not proof of good health or absence of stress.');
    }
    case 'skin_temp_celsius': {
      const at=Date.parse(reading?.measurement_times?.skin_temp_celsius??reading?.recorded_at??'');
      const references=history.filter(row=>row.skin_temp_celsius!=null&&Number.isFinite(row.skin_temp_celsius)&&Date.parse(row.measurement_times?.skin_temp_celsius??row.recorded_at)<at&&Date.parse(row.measurement_times?.skin_temp_celsius??row.recorded_at)>=at-24*3600_000).sort((a,b)=>Date.parse(b.recorded_at)-Date.parse(a.recorded_at)).slice(0,rules.skinTemperatureReferenceSamples).map(row=>row.skin_temp_celsius!);
      if(references.length<rules.skinTemperatureMinimumReferences)return status('neutral','Learning baseline','Wrist skin temperature needs at least five prior readings within 24 hours. It is not core temperature or a fever test.');
      const mean=references.reduce((sum,x)=>sum+x,0)/references.length;
      const sd=Math.sqrt(references.reduce((sum,x)=>sum+(x-mean)**2,0)/references.length);
      const change=Math.abs(value-mean);
      return sd>0&&change>=rules.skinTemperatureChangeC&&change>=rules.skinTemperatureStandardDeviations*sd?
        status('attention','Changed · Attention required','Wrist temperature differs from its recent reference. Check fit and environment; use a clinical thermometer if unwell.'):
        status('normal','Near recent baseline','No configured baseline-change rule crossed. Wrist temperature cannot establish whether the patient has a fever.');
    }
  }
}

export function vitalWellnessSuggestion(metric:VitalMetric){
  return ({heart_rate_bpm:'Confirm watch fit and repeat during a quiet rest. Consider the patient’s activity and care plan.',spo2_percent:'Sit still, keep the wrist warm and check watch fit before repeating. Do not change oxygen or medication without professional instructions.',sleep_hours:'Keep a regular sleep routine and note daytime tiredness or breathing concerns to discuss with the clinician.',steps_count:'Compare days with similar watch wear and monitoring time. Follow the patient’s mobility plan and use assistance when needed.',skin_temp_celsius:'Check skin contact and room conditions. Use a clinical thermometer when body temperature matters.',hrv_rmssd_ms:'Compare quiet measurements at similar times. A calm break and regular rest can support wellbeing; this estimate cannot diagnose stress.'})[metric];
}
