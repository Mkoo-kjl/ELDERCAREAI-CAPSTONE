/** Database medication clocks are wall times, not UTC timestamps. */
export function parseCareTime(value: string | null | undefined) {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value?.trim() ?? '');
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? {hour, minute, canonical: `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`} : null;
}
export function formatCareTime(value: string | null | undefined) {
  const parsed = parseCareTime(value);
  return parsed ? `${parsed.hour % 12 || 12}:${String(parsed.minute).padStart(2,'0')} ${parsed.hour >= 12 ? 'PM' : 'AM'}` : 'Time unavailable';
}
export function formatCareDateTime(value: string | Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return `${date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} · ${formatCareTime(`${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}`)}`;
}
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDateKey(date) === value;
}
export function careZoneParts(date:Date,timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Manila'){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const get=(name:string)=>parts.find(part=>part.type===name)?.value??'00';
  return {day:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour')),minute:Number(get('minute')),second:Number(get('second'))};
}
/** Interpret the wall clock in the schedule's timezone; reject a DST gap. */
export function careZonedInstant(day:string,clock:string,timezone:string){
  const time=parseCareTime(clock);if(!validDateKey(day)||!time)return null;
  const target=Date.parse(`${day}T${time.canonical}:00Z`);let instant=target;
  for(let attempt=0;attempt<4;attempt++){
    const actual=careZoneParts(new Date(instant),timezone);
    const represented=Date.parse(`${actual.day}T${String(actual.hour).padStart(2,'0')}:${String(actual.minute).padStart(2,'0')}:${String(actual.second).padStart(2,'0')}Z`);
    if(represented===target)return new Date(instant);instant+=target-represented;
  }
  return null;
}
export type ScheduledMedication = {id:string;frequency:string;times_of_day:string[]|null;start_date?:string|null;end_date?:string|null;is_active?:boolean;timezone?:string};
export function medicationDayDoses(item:ScheduledMedication,day:string){
  if(item.is_active===false||/as needed/i.test(item.frequency)||!validDateKey(day)||(item.start_date&&day<item.start_date)||(item.end_date&&day>item.end_date))return [];
  if(/weekly/i.test(item.frequency)&&item.start_date&&new Date(`${day}T12:00:00Z`).getUTCDay()!==new Date(`${item.start_date}T12:00:00Z`).getUTCDay())return [];
  const timezone=item.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone??'Asia/Manila';
  return [...new Set(item.times_of_day??[])].flatMap(clock=>{const instant=careZonedInstant(day,clock,timezone);return instant?[instant]:[];}).sort((a,b)=>a.getTime()-b.getTime());
}
export function nextMedicationAt(item: ScheduledMedication, now = new Date()) {
  if (item.is_active === false || /as needed/i.test(item.frequency)) return null;
  const today=careZoneParts(now,item.timezone).day;
  const first=item.start_date&&validDateKey(item.start_date)&&item.start_date>today?item.start_date:today;
  for(let day=0;day<8;day++) {
    const date=new Date(`${first}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+day);const key=date.toISOString().slice(0,10);
    if(item.end_date&&key>item.end_date)return null;
    for(const due of medicationDayDoses(item,key))if(due.getTime()>=now.getTime()-60_000)return due;
  }
  return null;
}
export function appointmentPhase(item:{appointment_at:string;duration_min?:number|null;status?:string|null},now=new Date()) {
  if (['completed','cancelled','canceled'].includes(item.status??'')) return item.status==='completed'?'Completed':'Cancelled';
  const at=Date.parse(item.appointment_at);
  if(!Number.isFinite(at)) return 'Date unavailable';
  if(at>now.getTime())return 'Upcoming';
  return at+Math.max(1,item.duration_min??30)*60_000>now.getTime()?'Ongoing':'Past · review';
}
