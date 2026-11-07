/** App review rules; these are not individualized clinical limits. */
export const VITAL_REVIEW_RULES={
  heartRateLow:50,
  heartRateHigh:110,
  oxygenLow:95,
  sleepHoursLow:5,
  skinTemperatureChangeC:0.8,
  skinTemperatureStandardDeviations:2,
  skinTemperatureMinimumReferences:5,
  skinTemperatureReferenceSamples:7,
  skinTemperatureReferenceHours:24,
  activeRuleReminderMinutes:60,
} as const;
export type VitalReviewInput={heart_rate_bpm?:number|null;spo2_percent?:number|null};
export function vitalReviewWarnings(vital:VitalReviewInput){
  const warnings:{metric:'heart_rate_bpm'|'spo2_percent';message:string}[]=[];
  const heart=vital.heart_rate_bpm,oxygen=vital.spo2_percent;
  if(typeof heart==='number'&&Number.isFinite(heart)&&heart>=1&&heart<=350&&
    (heart<VITAL_REVIEW_RULES.heartRateLow||heart>VITAL_REVIEW_RULES.heartRateHigh))
    warnings.push({metric:'heart_rate_bpm',message:`heart rate ${heart} bpm`});
  if(typeof oxygen==='number'&&Number.isFinite(oxygen)&&oxygen>=1&&oxygen<=100&&oxygen<VITAL_REVIEW_RULES.oxygenLow)
    warnings.push({metric:'spo2_percent',message:`SpO₂ ${oxygen.toFixed(1)}%`});
  return warnings;
}
