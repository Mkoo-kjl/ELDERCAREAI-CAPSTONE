import {fireEvent,render,screen} from '@testing-library/react-native';

import {StyleSheet} from 'react-native';

import {MonitoringChart} from '@/src/components/MonitoringChart';

import {chartCoordinates,chartReadings} from '@/src/lib/monitoring-chart';

import {metricRecords} from '@/src/lib/monitoring-records';

import {localCareNotice} from '@/src/lib/local-care-notice';

import type {VitalLog} from '@/src/providers/HealthDataProvider';

const readings=Array.from({length:200},(_,index)=>({id:String(index),value:index===91?999:index===92?-10:70+index%30,at:new Date(Date.UTC(2026,10,8,0,index)).toISOString()}));

test('chart downsampling retains real endpoints and extrema without inventing measurements',()=>{
  const sampled=chartReadings(readings);
  expect(sampled.length).toBeLessThanOrEqual(160);expect(sampled[0]).toEqual(readings[0]);expect(sampled.at(-1)).toEqual(readings.at(-1));
  expect(sampled).toContainEqual(readings[91]);expect(sampled).toContainEqual(readings[92]);
  expect(sampled.every(point=>readings.includes(point))).toBe(true);
  const coords=chartCoordinates(sampled,300,176);
  expect(coords.points.every(point=>Number.isFinite(point.x)&&point.x>=7&&point.x<=293&&point.y>=12&&point.y<=168)).toBe(true);
  expect(chartCoordinates([{id:'zero',value:0,at:readings[0].at}],300,176,true).points[0]).toEqual(expect.objectContaining({x:150,y:168}));
});
