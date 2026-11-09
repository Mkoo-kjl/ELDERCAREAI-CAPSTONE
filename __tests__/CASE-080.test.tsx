import {fireEvent,render,screen} from '@testing-library/react-native';

import {StyleSheet} from 'react-native';

import {MonitoringChart} from '@/src/components/MonitoringChart';

import {chartCoordinates,chartReadings} from '@/src/lib/monitoring-chart';

import {metricRecords} from '@/src/lib/monitoring-records';

import {localCareNotice} from '@/src/lib/local-care-notice';

import type {VitalLog} from '@/src/providers/HealthDataProvider';

const readings=Array.from({length:200},(_,index)=>({id:String(index),value:index===91?999:index===92?-10:70+index%30,at:new Date(Date.UTC(2026,10,8,0,index)).toISOString()}));

test('analytics toggles line/thin bars and exposes each selected measurement timestamp',async()=>{
  await render(<MonitoringChart records={readings.slice(0,80)} unit="BPM"/>);
  expect(screen.getAllByTestId('monitoring-line-segment')).toHaveLength(79);
  expect(screen.getByLabelText('Line chart').props.accessibilityState.selected).toBe(true);
  await fireEvent.press(screen.getByLabelText('Bar chart'));
  expect(screen.getAllByTestId('monitoring-thin-bar')).toHaveLength(80);
  expect(screen.getAllByTestId('monitoring-thin-bar').every(bar=>StyleSheet.flatten(bar.props.style).width<=6)).toBe(true);
  expect(screen.getByLabelText(/bar chart of 80/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Previous chart reading'));
  expect(screen.getByLabelText(/Selected 88 BPM/)).toBeTruthy();
});
