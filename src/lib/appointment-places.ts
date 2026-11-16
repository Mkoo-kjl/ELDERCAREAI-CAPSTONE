import {supabase} from './supabase';
import {isAppointmentCoordinate,type AppointmentCoordinate} from './appointment-location';
export type AppointmentPlace=AppointmentCoordinate&{label:string};
export function appointmentPlaces(value:unknown):AppointmentPlace[]{
  if(!Array.isArray(value))throw Error('Place search could not be read. Try again or choose a point on the map.');
  return value.filter((row):row is AppointmentPlace=>isAppointmentCoordinate(row)&&typeof (row as AppointmentPlace).label==='string').slice(0,6);
}
export async function searchAppointmentPlaces(query:string,center:AppointmentCoordinate|null){
  const result=await supabase.functions.invoke('appointment-places',{body:{query,center}});
  if(result.error)throw Error('Place search is unavailable. Try again, tap the map, or type the address manually.');
  return appointmentPlaces(result.data?.places);
}
