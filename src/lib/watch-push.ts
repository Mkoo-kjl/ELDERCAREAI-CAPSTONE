import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {supabase} from '@/src/lib/supabase';
import {cancelAllCareNotifications,ensureNotificationPermission,hasNotificationPermission,initializeNotifications} from '@/src/lib/notifications';
const tokenKey='eldercare:watch-push-token';
const enabledKey='eldercare:care-push-enabled';
export async function registerCarePush(userId:string,requestPermission=true){
  if(Platform.OS==='web'||!(requestPermission?await ensureNotificationPermission():await hasNotificationPermission()))
    throw Error('Allow notifications to receive background care alerts.');
  await initializeNotifications();
  const projectId=Constants.expoConfig?.extra?.eas?.projectId;
  if(typeof projectId!=='string')throw Error('Background care notifications are not configured in this build.');
  if(Constants.expoConfig?.extra?.firebaseConfigured!==true)
    throw Error('Firebase push is not included in this APK. Build a new Android APK with the Google services file configured in EAS.');
  let token:string;
  try{token=(await Notifications.getExpoPushTokenAsync({projectId})).data;}
  catch{throw Error('Background notifications need Firebase Android push setup in a new APK. In-app alerts still save in ElderCareAI.');}
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Manila';
  const {error}=await supabase.rpc('register_care_push_v2',{p_token:token,p_timezone:timezone});
  if(error)throw Error('Could not register background notifications. Update the backend and try again while signed in.');
  await AsyncStorage.setItem(tokenKey,token);
  await AsyncStorage.setItem(enabledKey,'1');
  await cancelAllCareNotifications();
  return true;
}
export async function refreshCarePushRegistration(userId:string){
  if(!(await AsyncStorage.getItem(tokenKey))||!(await hasNotificationPermission()))return false;
  return registerCarePush(userId,false).catch(()=>false);
}
export async function isCarePushRegistered(){
  return (await AsyncStorage.getItem(enabledKey))==='1'&&Boolean(await AsyncStorage.getItem(tokenKey))&&await hasNotificationPermission();
}
export async function unregisterCarePush(){
  const token=await AsyncStorage.getItem(tokenKey);
  if(token){const {error}=await supabase.from('caregiver_push_tokens').delete().eq('token',token);if(error)throw Error('Could not unregister care notifications. Check internet and retry sign out.');}
  await AsyncStorage.removeItem(tokenKey);
  await AsyncStorage.removeItem(enabledKey);
  await cancelAllCareNotifications();
}
