export type SafeZone = {elderly_id:string;caregiver_id:string;name:string;latitude:number;longitude:number;radius_m:number;enabled:boolean;revision:string;updated_at:string};
export type ZoneOverlay = Pick<SafeZone,'name'|'latitude'|'longitude'|'radius_m'> & {enabled?:boolean};
export type SafeZoneState = {elderly_id:string;status:'unknown'|'inside'|'outside';last_fix_at:string|null;confirmed_at:string|null;distance_m:number|null;last_check:string|null;candidate?:string|null;candidate_count?:number};
export type SafeZoneEvent = {id:string;direction:'inside'|'outside';zone_name:string;distance_m:number;measured_at:string;alert_id:string|null};
export const SAFE_ZONE_RADIUS = {min:10,max:5000,default:20,presets:[10,20,50,100,300,500,1000]} as const;
export function safeZoneAccuracyLimit(radius:number){return Math.min(100,Math.max(50,radius));}
export function safeZoneGpsHint(zone:SafeZone|null,fix:{location_source:string;accuracy_m:number|null;measured_at:string}|null,monitoring?:boolean,now=Date.now()){
  if(!zone?.enabled)return null;
  if(monitoring===false)return 'Start monitoring on the watch to check the safe zone.';
  if(!fix)return 'Waiting for GPS, fused or network location uploaded by the watch. Enable Location, monitoring and internet.';
  const age=now-Date.parse(fix.measured_at),limit=safeZoneAccuracyLimit(zone.radius_m);
  if(!Number.isFinite(age)||age>90_000||age< -10_000)return 'The last location is too old or has an incorrect time. Check watch Location, automatic time and internet.';
  if(fix.accuracy_m==null||!Number.isFinite(fix.accuracy_m)||fix.accuracy_m<0||fix.accuracy_m>limit)return `This ${zone.radius_m} m zone needs location accuracy of ${limit} m or better.${fix.accuracy_m!=null?` The latest fix reports ±${Math.round(fix.accuracy_m)} m.`:''} Move to an open area and wait for a clearer fix.`;
  return null;
}
export function zoneInputError(name:string,latitude:number,longitude:number,radius:number){
  if(!name.trim()||name.trim().length>80)return 'Enter a place name of up to 80 characters.';
  if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)return 'Choose a valid center on the map or enter valid coordinates.';
  if(!Number.isInteger(radius)||radius<SAFE_ZONE_RADIUS.min||radius>SAFE_ZONE_RADIUS.max)return 'Choose a whole-number radius from 10 to 5,000 meters.';
  return null;
}
export function safeZoneStatus(zone:SafeZone|null,state:SafeZoneState|null,now=Date.now(),monitoring?:boolean){
  if(!zone)return 'Not set up';
  if(!zone.enabled)return 'Paused';
  if(monitoring===false)return 'Monitoring paused';
  const age=state?.last_fix_at?now-Date.parse(state.last_fix_at):Infinity;
  if(age>120_000||age< -10_000||!Number.isFinite(age))return 'Waiting for location';
  if(state?.last_check?.startsWith('Waiting for fresh'))return 'Waiting for location';
  if(state?.last_check?.startsWith('Near the boundary'))return 'Near boundary · checking';
  if(state?.candidate&&state.candidate!==state.status&&(state.candidate_count??0)>0)return 'Confirming location';
  return state?.status==='inside'?'Inside safe zone':state?.status==='outside'?'Outside safe zone':'Confirming location';
}
