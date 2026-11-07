import {medicationDoseStatus} from '@/src/lib/care-status';
import {stressIndexValue,stressIndexCaption} from '@/src/lib/stress-index';
test('one taken dose does not hide the next dose of a twice-daily medication',()=>{
  const morning=new Date(2026,10,2,8,0);const now=new Date(2026,10,2,19,45);
  const medication={id:'m',medication_name:'Test',dosage:null,frequency:'Twice daily',times_of_day:['08:00','20:00']};
  const logs=[{schedule_id:'m',status:'taken',scheduled_time:morning.toISOString(),taken_at:morning.toISOString()}];
  expect(medicationDoseStatus(medication,logs,now).tone).toBe('due');
  const evening=new Date(2026,10,2,20,0);
  expect(medicationDoseStatus(medication,[...logs,{...logs[0],scheduled_time:evening.toISOString(),taken_at:evening.toISOString()}],now).tone).toBe('taken');
});
test('stress card keeps baseline learning and experimental labels explicit',()=>{
  expect(stressIndexValue({hrv_rmssd_ms:40,stress_reference_count:4})).toBe('--');
  expect(stressIndexCaption({stress_reference_count:4})).toContain('4/12');
  expect(stressIndexValue({stress_score:66,hrv_rmssd_ms:20})).toBe('66');
  expect(stressIndexCaption({stress_score:66,hrv_rmssd_ms:20})).toBe('HRV 20 ms · Experimental · not medical grade');
  expect(stressIndexValue({stress_score:Infinity})).toBe('--');
});
