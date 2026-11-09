export type CarePushJob={id:string;notification_id:string;lease_id:string;token:string;title:string;body:string;data:Record<string,unknown>|null;kind:string;attempts:number;channel_version?:number};
export const carePushChannels={
  sos:{channelId:'watch-sos-v1'},
  vital:{channelId:'health-warnings-v1'},
  medication:{channelId:'medication-reminders-v1'},
  appointment:{channelId:'appointment-reminders-v1'},
  system:{channelId:'care-reminders'},
};
export function carePushPayload(job:CarePushJob){
  const channel=carePushChannels[job.kind as keyof typeof carePushChannels]??carePushChannels.system;
  const channelId=job.channel_version===2?channel.channelId.replace(/-v1$/,'-v2'):channel.channelId;
  const sounds:Record<string,string>={sos:'sos_alert.wav',vital:'health_warning.wav',medication:'medication_reminder.wav',appointment:'appointment_reminder.wav'};
  // Retries share an event identity; unrelated events at the same time do not.
  return {to:job.token,title:job.title,body:job.body,channelId,tag:job.notification_id,collapseId:job.notification_id,sound:job.channel_version===2?(sounds[job.kind]??'default'):'default',
    priority:'high',ttl:job.kind==='sos'?86400:job.kind==='vital'?7200:900,
    data:{...job.data,care_notification_id:job.notification_id,care_kind:job.kind}};
}
export function carePushRetry(attempts:number,now=Date.now()){
  return new Date(now+Math.min(3600,30*2**Math.min(attempts,7))*1000).toISOString();
}
export function carePushError(value:unknown){
  if(!value||typeof value!=='object')return 'PushServiceError';
  const data=value as {details?:{error?:unknown};message?:unknown};
  const code=data.details?.error;
  return typeof code==='string'?code.slice(0,100):'PushServiceError';
}
