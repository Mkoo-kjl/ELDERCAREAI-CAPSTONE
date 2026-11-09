import {fireEvent,render,screen} from '@testing-library/react-native';

import {StyleSheet} from 'react-native';

import {MonitoringChart} from '@/src/components/MonitoringChart';

import {chartCoordinates,chartReadings} from '@/src/lib/monitoring-chart';

import {metricRecords} from '@/src/lib/monitoring-records';

import {localCareNotice} from '@/src/lib/local-care-notice';

import type {VitalLog} from '@/src/providers/HealthDataProvider';

const readings=Array.from({length:200},(_,index)=>({id:String(index),value:index===91?999:index===92?-10:70+index%30,at:new Date(Date.UTC(2026,10,8,0,index)).toISOString()}));

test('daily steps retain one maximum per Manila calendar day, not the sum of cumulative snapshots',()=>{
  const rows=[
    {id:'first',steps_count:100,recorded_at:'2026-11-07T16:00:00Z'},
    {id:'best',steps_count:250,recorded_at:'2026-11-08T10:00:00Z'},
    {id:'reset',steps_count:30,recorded_at:'2026-11-08T11:00:00Z'},
    {id:'yesterday',steps_count:900,recorded_at:'2026-11-07T15:59:00Z'},
    {id:'retired',steps_count:999,recorded_at:'2026-11-08T10:00:00Z',is_superseded:true},
    {id:'invalid',steps_count:NaN,recorded_at:'2026-11-08T10:00:00Z'},
  ] as VitalLog[];
  const result=metricRecords(rows,'steps_count');
  expect(result.map(point=>[point.row.steps_day,point.value])).toEqual([['2026-11-07',900],['2026-11-08',250]]);
  expect(result.at(-1)?.at).toBe('2026-11-08T10:00:00Z');
});
