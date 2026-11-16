import {parseCareTime,validDateKey} from './care-time';
export type PrescriptionDraft={medication_name:string;dosage:string;frequency:string;times_of_day:string[];instructions:string;start_date:string;end_date:string;prescribed_by:string;original_text:string;uncertainties:string[];prescription_date?:string;duration_days?:number|null;name_correction?:string};
export function prescriptionDrafts(value:unknown):PrescriptionDraft[]{
  if(!value||typeof value!=='object'||!Array.isArray((value as {medications?:unknown}).medications))throw Error('No readable medication draft was returned. You can enter the prescription manually.');
  const text=(value:unknown,max=1000)=>typeof value==='string'?value.slice(0,max):'';
  return (value as {medications:unknown[]}).medications.slice(0,20).filter((row):row is Record<string,unknown>=>!!row&&typeof row==='object').map(row=>({
    medication_name:text(row.medication_name,200),dosage:text(row.dosage,200),frequency:text(row.frequency,100),times_of_day:Array.isArray(row.times_of_day)?row.times_of_day.filter((x):x is string=>typeof x==='string').slice(0,12):[],
    instructions:text(row.instructions),start_date:text(row.start_date,10),end_date:text(row.end_date,10),prescribed_by:text(row.prescribed_by,200),original_text:text(row.original_text,2000),uncertainties:[...new Set([...(Array.isArray((value as Record<string,unknown>).warnings)?(value as {warnings:unknown[]}).warnings:[]),...(Array.isArray(row.warnings)?row.warnings:[]),...(Array.isArray(row.uncertainties)?row.uncertainties:[])].map(x=>text(x,300)).filter(Boolean))].slice(0,15),
    prescription_date:text(row.prescription_date??(value as Record<string,unknown>).prescription_date,10),duration_days:typeof row.duration_days==='number'&&Number.isInteger(row.duration_days)&&row.duration_days>0&&row.duration_days<=365?row.duration_days:null,name_correction:text(row.name_correction,300),
  }));
}
export function normalizedPrescriptionFrequency(raw:string){
  const frequency=raw.toLowerCase().trim();
  if(/as needed|\bprn\b/.test(frequency))return 'As needed';
  if(/week/.test(frequency))return /twice|two|2|three|3|other/.test(frequency)?'Custom':'Weekly';
  if(/twice.*(?:day|daily)|\bbid\b|\bb\.i\.d\b|2\s*(x|times).*(?:day|daily)|every\s*12\s*h/.test(frequency))return 'Twice daily';
  if(/three.*(?:day|daily)|\btid\b|\bt\.i\.d\b|3\s*(x|times).*(?:day|daily)|every\s*8\s*h/.test(frequency))return 'Custom';
  if(/daily|once.*day|\bod\b|\bqd\b|every\s*24\s*h|1\s*x.*day/.test(frequency))return 'Daily';
  return 'Custom';
}
export function prescriptionEndDate(start:string,days:number){
  const date=new Date(`${start}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days-1);return date.toISOString().slice(0,10);
}
export function preparePrescriptionDraft(draft:PrescriptionDraft){
  const frequency=draft.frequency.trim()?normalizedPrescriptionFrequency(draft.frequency):'',notes=[...draft.uncertainties];
  const start=validDateKey(draft.start_date)?draft.start_date:'';
  const times=draft.times_of_day.map(value=>parseCareTime(value)?.canonical).filter((value):value is string=>!!value);
  if(!draft.medication_name.trim())notes.push('Medication name was not readable. Confirm it before saving.');
  if(!start)notes.push('Treatment start date was not readable or not written; it is left blank.');
  if(!times.length&&frequency!=='As needed')notes.push('No explicit clock times were readable. Reminder times are left blank.');
  if(!frequency)notes.push('Frequency was not readable; choose it only after confirming the written instructions.');
  if(frequency==='Custom')notes.push('Custom repeats daily at the selected times; confirm that the written schedule supports this.');
  return {...draft,frequency,start_date:start,end_date:validDateKey(draft.end_date)?draft.end_date:'',times_of_day:frequency==='As needed'?[]:[...new Set(times)],uncertainties:[...new Set(notes)]};
}
