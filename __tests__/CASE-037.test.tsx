import {fireEvent,render,screen} from '@testing-library/react-native';

import {StyleSheet} from 'react-native';

import {MonitoringChart} from '@/src/components/MonitoringChart';

import {chartCoordinates,chartReadings,chartScale,chartTimeTicks,chartZoomOffset} from '@/src/lib/monitoring-chart';

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

test('zoom changes the scrollable plot width, preserves selection and fits the complete range',async()=>{
  await render(<MonitoringChart records={readings} unit="BPM"/>);
  const plotWidth=()=>StyleSheet.flatten(screen.getByTestId('monitoring-chart-plot').props.style).width;
  const scroll=screen.getByTestId('monitoring-chart-scroll');
  await fireEvent(scroll,'layout',{nativeEvent:{layout:{width:220,height:284}}});
  expect(scroll.props.horizontal).toBe(true);
  expect(plotWidth()).toBe(880);
  await fireEvent.press(screen.getByLabelText('Previous chart reading'));
  expect(screen.getByLabelText(/Selected 88 BPM/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Zoom in chart'));
  expect(plotWidth()).toBe(1760);
  expect(screen.getByLabelText('Chart zoom 8 times')).toBeTruthy();
  expect(screen.getByLabelText(/Selected 88 BPM/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Fit entire chart'));
  expect(plotWidth()).toBe(220);
  expect(screen.getByLabelText('Zoom out chart').props.accessibilityState.disabled).toBe(true);
  await fireEvent.press(screen.getByLabelText('Show latest chart reading'));
  expect(screen.getByLabelText(/Selected 89 BPM/)).toBeTruthy();
  expect(screen.getByLabelText('Next chart reading').props.accessibilityState.disabled).toBe(true);
});

test('reading inspection reaches unsampled measurements and spacing does not change saved values',async()=>{
  await render(<MonitoringChart records={readings} unit="BPM"/>);
  await fireEvent.press(screen.getByLabelText('Fit entire chart'));
  // The nearest raw point remains inspectable even if it was reduced out of the line.
  const x=12+92/199*(240-24);
  await fireEvent.press(screen.getByTestId('monitoring-chart-plot'),{nativeEvent:{locationX:x}});
  expect(screen.getByLabelText(/Selected -10 BPM/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Space chart by elapsed time'));
  expect(screen.getByLabelText('Space chart by elapsed time').props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText(/Selected -10 BPM/)).toBeTruthy();
});

test('dense bursts can be spread out without losing their actual timestamps',()=>{
  const burst=[{id:'a',value:55,at:'2026-11-18T00:00:00Z'},{id:'b',value:97,at:'2026-11-22T00:00:00Z'},{id:'c',value:79,at:'2026-11-22T00:00:01Z'}];
  const elapsed=chartCoordinates(burst,1000,224,false,'time');
  const spread=chartCoordinates(burst,1000,224,false,'readings');
  expect(elapsed.points[2].x-elapsed.points[1].x).toBeLessThan(1);
  expect(spread.points[2].x-spread.points[1].x).toBeGreaterThan(400);
  expect(spread.points.map(point=>point.at)).toEqual(burst.map(point=>point.at));
  expect(chartTimeTicks(burst,400,'readings').map(tick=>tick.at)).toEqual(burst.map(point=>point.at));
});

test('scales include extrema, pad constant lines, and keep bars anchored to zero',()=>{
  const sampled=chartReadings(readings,40);
  expect(sampled).toEqual(expect.arrayContaining([readings[0],readings[91],readings[92],readings[199]]));
  const scale=chartScale(readings);
  expect(scale.low).toBeLessThanOrEqual(-10);
  expect(scale.high).toBeGreaterThanOrEqual(999);
  expect(chartScale(readings.slice(0,80),true).low).toBe(0);
  const constant=chartCoordinates([{id:'one',value:79,at:readings[0].at}],220,224);
  expect(constant.high).toBeGreaterThan(constant.low);
  expect(constant.points[0].x).toBe(110);
  expect(Number.isFinite(constant.points[0].y)).toBe(true);
  expect(chartCoordinates([],220,224).points).toEqual([]);
});

test('zoom keeps the selected reading visible and clamps the scrolled range',()=>{
  const next=chartZoomOffset(880,220,660,1760,868);
  expect(next).toBe(1540);
  expect(chartZoomOffset(880,220,660,220,868)).toBe(0);
  const offset=chartZoomOffset(880,220,200,1760,300);
  const nextPoint=12+(300-12)/(880-24)*(1760-24);
  expect(nextPoint-offset).toBeCloseTo(300-200);
});
