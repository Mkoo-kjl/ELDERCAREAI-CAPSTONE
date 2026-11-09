export type PrescriptionDraft={medication_name:string;dosage:string;frequency:string;times_of_day:string[];instructions:string;start_date:string;end_date:string;prescribed_by:string;original_text:string;uncertainties:string[]};
export function prescriptionDrafts(value:unknown):PrescriptionDraft[]{
  if(!value||typeof value!=='object'||!Array.isArray((value as {medications?:unknown}).medications))throw Error('No readable medication draft was returned. You can enter the prescription manually.');
  const text=(value:unknown,max=1000)=>typeof value==='string'?value.slice(0,max):'';
  return (value as {medications:unknown[]}).medications.slice(0,10).filter((row):row is Record<string,unknown>=>!!row&&typeof row==='object').map(row=>({
    medication_name:text(row.medication_name,200),dosage:text(row.dosage,200),frequency:text(row.frequency,100),times_of_day:Array.isArray(row.times_of_day)?row.times_of_day.filter((x):x is string=>typeof x==='string').slice(0,12):[],
    instructions:text(row.instructions),start_date:text(row.start_date,10),end_date:text(row.end_date,10),prescribed_by:text(row.prescribed_by,200),original_text:text(row.original_text,2000),uncertainties:Array.isArray(row.uncertainties)?row.uncertainties.map(x=>text(x,300)).slice(0,10):[],
  }));
}
