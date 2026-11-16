import {groupMedications,type MedicationRecord} from '@/src/lib/medication';
import {stabilizedWatchTrack,stabilizedWatchPosition,routeSegments,type MapPosition} from '@/src/lib/location-map';
import {patientThresholds,patientReviewRules,thresholdDraftError,DEFAULT_PATIENT_THRESHOLDS,type ThresholdKey} from '@/src/lib/vital-thresholds';
import {vitalReviewWarnings} from '@/src/lib/vital-review';
import {prescriptionDrafts,preparePrescriptionDraft,normalizedPrescriptionFrequency} from '@/src/lib/prescription';
import {shouldPresentNotice} from '@/src/lib/foreground-notice';
const at=Date.parse('2026-11-15T10:00:00Z');
const fix=(seconds:number,meters:number,accuracy=8):MapPosition=>({latitude:10+meters/111195,longitude:123,accuracy_m:accuracy,measured_at:new Date(at+seconds*1000).toISOString(),location_source:'fused'});
test('stationary indoor jitter does not draw a scribble or move the marker; coherent motion eventually moves it',()=>{
  const jitter=[fix(0,0),fix(4,5),fix(8,-7),fix(12,9),fix(16,-4)];
  expect(new Set(stabilizedWatchTrack(jitter).map(point=>point.latitude)).size).toBe(1);
  expect(routeSegments(jitter)).toEqual([]);
  expect(stabilizedWatchPosition(null,[...jitter,fix(20,300),fix(24,1)],at+24000)?.latitude).toBe(jitter[0].latitude);
  const motion=[...jitter,fix(20,35),fix(24,39),fix(28,42)];
  expect(stabilizedWatchPosition(null,motion,at+28000)?.latitude).toBe(motion.at(-1)?.latitude);
  expect(routeSegments(motion)).toHaveLength(1);
});
test('duplicate timestamps cannot count as separate movement confirmation and better fixes replace a poor initial anchor',()=>{
  const moved=fix(8,40);expect(stabilizedWatchPosition(moved,[fix(0,0),moved,moved],at+8000)?.latitude).toBe(fix(0,0).latitude);
  expect(stabilizedWatchPosition(fix(5,0),[fix(0,100,300)],at+5000)?.latitude).toBe(fix(5,0).latitude);
});
test('patient settings change alert evaluation without mutating defaults or another patient',()=>{
  const patient=patientReviewRules({heartRateHigh:130,oxygenLow:92,hrvLow:20,stressHigh:80,stepsHigh:3000});
  expect(vitalReviewWarnings({heart_rate_bpm:120,spo2_percent:94},patient)).toEqual([]);
  expect(vitalReviewWarnings({heart_rate_bpm:120})).toHaveLength(1);
  expect(patientThresholds(null)).toEqual(DEFAULT_PATIENT_THRESHOLDS);
  expect(patientThresholds({oxygenLow:Infinity,heartRateLow:200,heartRateHigh:120}).heartRateLow).toBe(50);
  const draft=Object.fromEntries(Object.entries(DEFAULT_PATIENT_THRESHOLDS).map(([key,value])=>[key,value==null?'':String(value)])) as Record<ThresholdKey,string>;
  expect(thresholdDraftError(draft)).toBeNull();expect(thresholdDraftError({...draft,heartRateLow:'150'})).toContain('less than');
});
test('one prescription preserves both drugs and separate issue/start dates, normalizes frequency while leaving missing dates and clocks blank',()=>{
  const drafts=prescriptionDrafts({prescription_date:'2026-11-08',medications:[{medication_name:'Drug A',dosage:'250 mg/5 mL; 6 mL per dose',frequency:'2x/day',duration_days:7},{medication_name:'Drug B',frequency:'As needed',start_date:'2026-11-10',times_of_day:['08:00']}]});
  expect(drafts).toHaveLength(2);
  const first=preparePrescriptionDraft(drafts[0]);
  expect(first).toMatchObject({prescription_date:'2026-11-08',start_date:'',end_date:'',frequency:'Twice daily',times_of_day:[]});
  expect(first.uncertainties.join(' ')).toContain('left blank');
  expect(preparePrescriptionDraft(drafts[1]).times_of_day).toEqual([]);
});
test('logging in never makes saved old SOS or vital history a new foreground event',()=>{
  expect(shouldPresentNotice(new Date(at-60000).toISOString(),at,at)).toBe(false);
  expect(shouldPresentNotice(new Date(at+2000).toISOString(),at,at+2000)).toBe(true);
  expect(shouldPresentNotice('invalid',at,at)).toBe(false);
  expect(shouldPresentNotice(new Date(at+60000).toISOString(),at,at)).toBe(false);
});

test('saved medicines from one prescription stay in one entry while manual medicines stay separate',()=>{
  const items=[{id:'a',prescription_import_id:'rx1'},{id:'manual'},{id:'b',prescription_import_id:'rx1'}] as MedicationRecord[];
  const groups=groupMedications(items);expect(groups).toHaveLength(2);expect(groups[0].medications.map(item=>item.id)).toEqual(['a','b']);expect(groups[0].isPrescription).toBe(true);expect(groups[1].isPrescription).toBe(false);
});

test('unsupported weekly/monthly instructions never become automatic daily schedules',()=>{
  expect(normalizedPrescriptionFrequency('twice weekly')).toBe('Custom');expect(normalizedPrescriptionFrequency('once monthly')).toBe('Custom');
  const [draft]=prescriptionDrafts({medications:[{medication_name:'Fixture',frequency:'twice weekly'}]});expect(preparePrescriptionDraft(draft).times_of_day).toEqual([]);
});

test('daily frequency labels preserve the number of doses without inventing clock times',()=>{
  expect(normalizedPrescriptionFrequency('Twice daily')).toBe('Twice daily');
  expect(normalizedPrescriptionFrequency('three times daily')).toBe('Custom');
  expect(normalizedPrescriptionFrequency('once daily')).toBe('Daily');
  const [draft]=prescriptionDrafts({medications:[{medication_name:'Fixture',frequency:'Twice daily'}]});
  expect(preparePrescriptionDraft(draft)).toMatchObject({frequency:'Twice daily',times_of_day:[],start_date:'',end_date:''});
});
