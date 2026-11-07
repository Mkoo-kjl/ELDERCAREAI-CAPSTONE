export type CareAlert={id:string;elderly_id:string;title:string;message:string;severity:string;alert_type:string;is_read:boolean;is_resolved:boolean;triggered_at:string;
  acknowledged_at:string|null;acknowledged_by:string|null;resolved_at:string|null;resolved_by:string|null;resolution_note:string|null};
export type AlertResponseEvent={id:string;alert_id:string;actor_id:string|null;action:'acknowledged'|'resolved';note:string|null;occurred_at:string};
export function alertResponseStatus(alert:Pick<CareAlert,'is_resolved'|'acknowledged_at'>){return alert.is_resolved?'Resolved':alert.acknowledged_at?'Acknowledged':'New';}
export function validRecordId(value:unknown):value is string{return typeof value==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value);}
export function responseNoteError(note:string){const length=note.trim().length;return length<3?'Add a short note about the action taken.':length>2000?'Keep the note to 2,000 characters or fewer.':null;}
export function responseTimeLabel(start:string,end:string|null){
  if(!end)return 'Awaiting acknowledgment';const seconds=Math.floor((Date.parse(end)-Date.parse(start))/1000);
  if(!Number.isFinite(seconds)||seconds<0)return 'Time unavailable';
  return seconds<60?`${seconds}s to acknowledge`:seconds<3600?`${Math.floor(seconds/60)}m to acknowledge`:`${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m to acknowledge`;
}
