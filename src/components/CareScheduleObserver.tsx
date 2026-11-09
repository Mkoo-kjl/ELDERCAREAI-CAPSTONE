import {useEffect} from 'react';
import {AppState} from 'react-native';
import {useAuth} from '@/src/providers/AuthProvider';
import {useHealthData} from '@/src/providers/HealthDataProvider';
import {supabase} from '@/src/lib/supabase';
import {cancelAllCareNotifications,cancelCareNotifications,hasNotificationPermission,scheduleAppointmentNotification,scheduleMedicationNotifications} from '@/src/lib/notifications';
import {isCarePushRegistered} from '@/src/lib/watch-push';
import {medicationSelect,type MedicationRecord} from '@/src/lib/medication';
export function CareScheduleObserver(){
  const {session}=useAuth();const {elderly}=useHealthData();const user=session?.user.id,patient=elderly?.elderly_id,name=elderly?.full_name;
  useEffect(()=>{
    let active=true,loading=false;
    const restore=async()=>{
      if(!active||loading||!user||!patient||!name)return;loading=true;
      try{
        if(!await hasNotificationPermission())return;
        if(await isCarePushRegistered()){await cancelAllCareNotifications();return;}
        const [meds,visits]=await Promise.all([supabase.from('medication_schedules').select(medicationSelect).eq('caregiver_id',user).eq('elderly_id',patient),supabase.from('appointments').select('id,title,appointment_at,doctor_name,location,notes,status').eq('caregiver_id',user).eq('elderly_id',patient)]);
        if(!active||meds.error||visits.error)return;
        for(const med of (meds.data??[]) as MedicationRecord[]){if(!active)return;if(!med.is_active||med.reminder_enabled===false)await cancelCareNotifications('medication',med.id);else await scheduleMedicationNotifications({caregiverId:user,elderlyId:patient,id:med.id,medicationName:med.medication_name,dosage:med.dosage,frequency:med.frequency,timesOfDay:med.times_of_day??[],elderlyName:name,startDate:med.start_date,timezone:med.timezone,endDate:med.end_date,reminderEnabled:med.reminder_enabled},false);}
        for(const visit of visits.data??[]){if(!active)return;if(['completed','cancelled','canceled'].includes(visit.status??'')||Date.parse(visit.appointment_at)<=Date.now())await cancelCareNotifications('appointment',visit.id);else await scheduleAppointmentNotification({caregiverId:user,elderlyId:patient,id:visit.id,title:visit.title,appointmentAt:visit.appointment_at,elderlyName:name,doctorName:visit.doctor_name,location:visit.location,purpose:visit.notes},false);}
      }catch{/* Saved reminders remain visible in Care plan; retry on resume. */}finally{loading=false;}
    };
    void restore();const resume=AppState.addEventListener('change',state=>{if(state==='active')void restore();});
    const channel=user?supabase.channel(`care-schedules:${user}:${Date.now()}`).on('postgres_changes',{event:'*',schema:'public',table:'medication_schedules',filter:`caregiver_id=eq.${user}`},()=>void restore()).on('postgres_changes',{event:'*',schema:'public',table:'appointments',filter:`caregiver_id=eq.${user}`},()=>void restore()).subscribe():null;
    const timer=setInterval(()=>{if(AppState.currentState==='active')void restore();},6*3600_000);
    return()=>{active=false;clearInterval(timer);resume.remove();if(channel)void supabase.removeChannel(channel);};
  },[user,patient,name]);return null;
}
