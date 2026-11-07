import {useEffect} from 'react';
import * as Notifications from 'expo-notifications';
import {router,type Href} from 'expo-router';
import {useAuth} from '@/src/providers/AuthProvider';
import {initializeNotifications} from '@/src/lib/notifications';
import {careNotificationRoute} from '@/src/lib/notification-route';

export function CareNotificationObserver(){
  const {session,isLoading}=useAuth();const userId=session?.user.id;
  useEffect(()=>{void initializeNotifications();},[]);
  useEffect(()=>{
    // Preserve a cold-start tap until session restoration has completed.
    if(isLoading||!userId)return;
    const open=(notification:Notifications.Notification)=>{const destination=careNotificationRoute(notification.request.content.data);if(destination)router.push(destination as Href);};
    const previous=Notifications.getLastNotificationResponse();
    if(previous?.notification){open(previous.notification);Notifications.clearLastNotificationResponse();}
    const subscription=Notifications.addNotificationResponseReceivedListener(response=>open(response.notification));
    return()=>subscription.remove();
  },[isLoading,userId]);
  return null;
}
