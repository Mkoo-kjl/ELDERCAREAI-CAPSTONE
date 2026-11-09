import {fireEvent,render,screen} from '@testing-library/react-native';

import {StyleSheet} from 'react-native';

import {MonitoringChart} from '@/src/components/MonitoringChart';

import {chartCoordinates,chartReadings} from '@/src/lib/monitoring-chart';

import {metricRecords} from '@/src/lib/monitoring-records';

import {localCareNotice} from '@/src/lib/local-care-notice';

import type {VitalLog} from '@/src/providers/HealthDataProvider';

const readings=Array.from({length:200},(_,index)=>({id:String(index),value:index===91?999:index===92?-10:70+index%30,at:new Date(Date.UTC(2026,10,8,0,index)).toISOString()}));

test('repeating local reminders have separate delivery identities, with strict account ownership',()=>{
  const notification={date:Date.now(),request:{identifier:'medication:one:daily:17:00',content:{title:'Reminder',body:'Patient: medication',data:{care_local_version:3,care_kind:'medication',entityId:'one',caregiver_id:'caregiver',elderly_id:'patient'}}}};
  const first=localCareNotice(notification,'caregiver','patient');
  expect(first).not.toBeNull();expect(localCareNotice({...notification,date:notification.date+86400000},'caregiver','patient')?.id).not.toBe(first?.id);
  expect(localCareNotice(notification,'other','patient')).toBeNull();expect(localCareNotice(notification,'caregiver','other')).toBeNull();
  expect(localCareNotice({...notification,date:NaN},'caregiver','patient')).toBeNull();
});
