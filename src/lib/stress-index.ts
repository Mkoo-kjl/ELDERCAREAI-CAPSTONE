type StressReading = {stress_score?:number|null;hrv_rmssd_ms?:number|null;stress_reference_count?:number}|null|undefined;
export function stressIndexValue(reading:StressReading){
  const score=reading?.stress_score;
  return typeof score==='number' && Number.isFinite(score) && score>=0 && score<=100 ? String(Math.round(score)) : '--';
}
export function stressIndexCaption(reading:StressReading){
  const raw=reading?.hrv_rmssd_ms;
  if(stressIndexValue(reading)==='--')return `Learning baseline (${Math.min(reading?.stress_reference_count??0,12)}/12 periods) · not medical grade`;
  return `${typeof raw==='number'?`HRV ${raw.toFixed(0)} ms · `:''}Experimental · not medical grade`;
}
