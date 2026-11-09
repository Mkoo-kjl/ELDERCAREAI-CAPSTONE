import {NoticeQueue} from '@/src/lib/notice-queue';
import {localCareNotice} from '@/src/lib/local-care-notice';
import {vitalForRule} from '@/src/lib/medication';
import {useCallback,useEffect,useRef} from 'react';
import {Alert,AppState,Vibration} from 'react-native';
import {router,type Href} from 'expo-router';
import {setAudioModeAsync,useAudioPlayer} from 'expo-audio';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '@/src/lib/supabase';
import {useAuth} from '@/src/providers/AuthProvider';
import {useHealthData} from '@/src/providers/HealthDataProvider';
import {refreshCarePushRegistration,isCarePushRegistered} from '@/src/lib/watch-push';
import {careNotificationRoute} from '@/src/lib/notification-route';

type CareNotice={id:string;title:string;body:string;elderly_id?:string;data?:{watch_sos_id?:string;care_kind?:string;url?:string;rule?:string};sent_at:string};
export function WatchCareObserver(){
  const {session}=useAuth();const {elderly}=useHealthData();
  const userId=session?.user.id,patient=elderly?.elderly_id;
  const sosPlayer=useAudioPlayer(require('@/assets/sounds/sos_alert.wav'));
  const medicationPlayer=useAudioPlayer(require('@/assets/sounds/medication_reminder.wav'));
  const appointmentPlayer=useAudioPlayer(require('@/assets/sounds/appointment_reminder.wav'));
  const vitalPlayer=useAudioPlayer(require('@/assets/sounds/health_warning.wav'));
  const activeUser=useRef(userId);activeUser.current=userId;
  useEffect(()=>{void setAudioModeAsync({interruptionMode:'duckOthers',shouldRouteThroughEarpiece:false,shouldPlayInBackground:false}).catch(()=>undefined);},[]);
  const queue=useRef<NoticeQueue<{id:string;notice:CareNotice;isSos:boolean;linked:boolean}>|null>(null);
  const display=useCallback((notice:CareNotice,isSos:boolean,linked=false,done=()=>{})=>{
    const player=isSos?sosPlayer:notice.data?.care_kind==='medication'?medicationPlayer:notice.data?.care_kind==='appointment'?appointmentPlayer:vitalPlayer;
    Vibration.vibrate(isSos?[0,500,180,500]:[0,250,180,250]);
    void player.seekTo(0).catch(()=>undefined).then(()=>player.play()).catch(()=>undefined);
    Alert.alert(notice.title,isSos?`${notice.body}\nThis request does not place an emergency-service call.`:notice.body,[
      {text:'Dismiss',style:'cancel',onPress:done},
      ...(linked?[{text:'View linked medications',onPress:()=>{done();router.push({pathname:'/care',params:{tab:'Medications',metric:vitalForRule(notice.data?.rule)!}});}}]:[]),
      {text:isSos?'View SOS':notice.data?.care_kind==='medication'?'View medication':notice.data?.care_kind==='appointment'?'View appointment':'View alert',onPress:()=>{done();router.push((careNotificationRoute(notice.data)??(isSos?'/alerts?tab=Emergency':'/alerts?tab=Alerts')) as Href);}},
    ],{cancelable:true,onDismiss:done});
  },[sosPlayer,vitalPlayer,medicationPlayer,appointmentPlayer]);
  useEffect(()=>{
    let active=true;
    const next=new NoticeQueue<{id:string;notice:CareNotice;isSos:boolean;linked:boolean}>((item,done)=>{
      const key=`${item.isSos?'watch-sos':'care-vital'}-shown:${userId}:${item.id}`;
      void AsyncStorage.setItem(key,'1').catch(()=>undefined).then(()=>{if(active&&activeUser.current===userId)display(item.notice,item.isSos,item.linked,done);else done();});
    });
    queue.current=next;return()=>{active=false;next.stop();queue.current=null;};
  },[display,userId,patient]);
  useEffect(()=>{if(userId)void refreshCarePushRegistration(userId);},[userId]);
  useEffect(()=>{
    if(!userId||!patient)return;
    let active=true,loading=false;const seen=new Set<string>();
    const show=async(notice:CareNotice,local=false)=>{
      const isSos=Boolean(notice.data?.watch_sos_id)||notice.data?.care_kind==='sos',isVital=notice.data?.care_kind==='vital',isReminder=['medication','appointment'].includes(notice.data?.care_kind??'');
      if(!active||activeUser.current!==userId||(!isSos&&!isVital&&!isReminder)||!notice.id||seen.has(notice.id))return;
      if(notice.elderly_id&&notice.elderly_id!==patient)return;
      if(isVital&&(!Number.isFinite(Date.parse(notice.sent_at))||Date.now()-Date.parse(notice.sent_at)>120000))return;
      if(isReminder&&(!Number.isFinite(Date.parse(notice.sent_at))||Date.now()-Date.parse(notice.sent_at)>900000))return;
      if(isReminder&&!local&&!await isCarePushRegistered())return;
      seen.add(notice.id);
      const key=`${isSos?'watch-sos':'care-vital'}-shown:${userId}:${notice.id}`;
      try{
        if(await AsyncStorage.getItem(key))return;
        if(!active||activeUser.current!==userId)return;
        if(AppState.currentState!=='active'){seen.delete(notice.id);return;}
        let linked=false;const metric=vitalForRule(notice.data?.rule);
        if(isVital&&metric){const result=await supabase.from('medication_schedules').select('id').eq('caregiver_id',userId).eq('elderly_id',patient).eq('is_active',true).contains('related_vitals',[metric]).limit(1);linked=!result.error&&Boolean(result.data?.length);}
        if(active&&activeUser.current===userId)queue.current?.push({id:notice.id,notice,isSos,linked});
      }catch{seen.delete(notice.id);}
    };
    const load=async()=>{
      if(loading)return;loading=true;
      try{
        const query=(kind:string,age:number,limit:number)=>supabase.from('caregiver_notifications')
          .select('id,title,body,data,elderly_id,sent_at').eq('caregiver_id',userId).eq('elderly_id',patient)
          .eq('notification_type',kind).eq('is_read',false).gte('sent_at',new Date(Date.now()-age).toISOString())
          .order('sent_at',{ascending:false}).limit(limit);
        const results=await Promise.all([query('emergency',86400000,5),query('health_alert',120000,10),query('medication',900000,30),query('appointment',900000,30)]);
        if(active)for(const result of results)if(!result.error)for(const row of result.data??[])await show(row as CareNotice);
      }catch{ /* Saved alerts are retried on reconnect and resume. */ }finally{loading=false;}
    };
    const channel=supabase.channel(`care-alerts:${userId}:${Date.now()}`).on('postgres_changes',
      {event:'INSERT',schema:'public',table:'caregiver_notifications',filter:`caregiver_id=eq.${userId}`},payload=>{void show(payload.new as CareNotice);})
      .subscribe(status=>{if(status==='SUBSCRIBED')void load();});
    // Read the authenticated user's saved notices before acting on a push.
    const push=Notifications.addNotificationReceivedListener(notification=>{
      const local=localCareNotice(notification,userId,patient);
      if(local)void show(local,true);
      else if(['vital','sos','medication','appointment'].includes(String(notification.request.content.data?.care_kind)))void load();
    });
    void load();const timer=setInterval(()=>{if(AppState.currentState==='active')void load();},5000);
    const resume=AppState.addEventListener('change',state=>{if(state==='active')void load();});
    return()=>{active=false;clearInterval(timer);resume.remove();push.remove();void supabase.removeChannel(channel);};
  },[userId,patient,display]);
  return null;
}
