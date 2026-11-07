import {carePushPayload,type CarePushJob} from '../supabase/functions/_shared/care-push.ts';
const job:CarePushJob={id:'job',notification_id:'notice',lease_id:'lease',token:'ExpoPushToken[unit-test]',title:'Title',body:'Body',data:{url:'/alerts'},kind:'vital',attempts:1};
test.each(['vital','medication','appointment','sos'])('%s pushes keep legacy channels until a new APK registers v2',kind=>{
  const legacy=carePushPayload({...job,kind}),updated=carePushPayload({...job,kind,channel_version:2});
  expect(legacy.channelId).toMatch(/-v1$/);expect(updated.channelId).toBe(legacy.channelId.replace(/-v1$/,'-v2'));
  expect(updated.priority).toBe('high');expect(updated.data.care_notification_id).toBe('notice');
});
