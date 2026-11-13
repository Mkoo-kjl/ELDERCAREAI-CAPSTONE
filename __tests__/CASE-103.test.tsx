import {useState} from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react-native';
import {PickerModal} from '@/src/components/PickerModal';
import {timeWheelRowHeight} from '@/src/components/TimeWheel';
import {careDate,formatCareDate,localDateKey} from '@/src/lib/care-time';

jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
function TimePicker({initial=new Date(2026,10,14,8,25)}) {
  const [value,setValue]=useState(initial);
  return <PickerModal visible mode="time" value={value} onChange={setValue} onClose={jest.fn()}/>;
}

test('scrolling minute and period wheels updates every minute, including noon and midnight',async()=>{
  await render(<TimePicker initial={new Date(2026,10,14,0,0)}/>);
  expect(screen.getByText('12:00 AM')).toBeTruthy();
  await fireEvent(screen.getByTestId('minute-wheel'),'momentumScrollEnd',{nativeEvent:{contentOffset:{y:59*timeWheelRowHeight}}});
  expect(screen.getByText('12:59 AM')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('AM/PM PM'));
  expect(screen.getByText('12:59 PM')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Hour 01'));
  expect(screen.getByText('1:59 PM')).toBeTruthy();
  expect(screen.getAllByLabelText(/^Minute \d\d$/)).toHaveLength(60);
});

test('time adjustment preserves the calendar date and supports accessibility actions',async()=>{
  const change=jest.fn();
  await render(<PickerModal visible mode="time" value={new Date(2026,10,14,23,59)} onChange={change} onClose={jest.fn()}/>);
  await fireEvent(screen.getByLabelText('Hour'),'accessibilityAction',{nativeEvent:{actionName:'decrement'}});
  const next=change.mock.calls[0][0] as Date;
  expect(localDateKey(next)).toBe('2026-11-14');
  expect([next.getHours(),next.getMinutes()]).toEqual([22,59]);
});

test('a slow drag without momentum still settles to the nearest minute',async()=>{
  jest.useFakeTimers();
  try {
    await render(<TimePicker/>);
    await fireEvent.scroll(screen.getByTestId('minute-wheel'),{nativeEvent:{contentOffset:{y:26.8*timeWheelRowHeight}}});
    await act(async()=>jest.advanceTimersByTime(180));
    expect(screen.getByText('8:27 AM')).toBeTruthy();
  } finally {jest.useRealTimers();}
});

test('Done saves an in-flight wheel selection before closing',async()=>{
  jest.useFakeTimers();
  try {
    const change=jest.fn(),close=jest.fn();
    await render(<PickerModal visible mode="time" value={new Date(2026,10,14,8,25)} onChange={change} onClose={close}/>);
    await fireEvent.scroll(screen.getByTestId('minute-wheel'),{nativeEvent:{contentOffset:{y:28*timeWheelRowHeight}}});
    await fireEvent.press(screen.getByText('Done'));
    expect(change.mock.calls.at(-1)[0].getMinutes()).toBe(28);
    expect(close).toHaveBeenCalledTimes(1);
  } finally {jest.useRealTimers();}
});

test('invalid calendar input has usable days and repairs the value without NaN',async()=>{
  const change=jest.fn(),today=new Date();
  await render(<PickerModal visible mode="date" value={new Date('Nov. 14T12:00:00')} onChange={change} onClose={jest.fn()}/>);
  expect(screen.queryByText(/NaN/)).toBeNull();
  await fireEvent.press(screen.getByLabelText(`${today.toLocaleString('en-US',{month:'long'})} 15, ${today.getFullYear()}`));
  expect(Number.isFinite(change.mock.calls[0][0].getTime())).toBe(true);
});

test('calendar keys round-trip in local time and reject impossible or ambiguous dates',()=>{
  const date=careDate('2026-11-14')!;
  expect([date.getFullYear(),date.getMonth(),date.getDate(),date.getHours()]).toEqual([2026,10,14,12]);
  expect(localDateKey(date)).toBe('2026-11-14');
  for(const raw of ['2026-02-30','Nov. 14','2026-11-14T00:00:00Z',''])expect(careDate(raw)).toBeNull();
  expect(formatCareDate('Nov. 14')).toBe('Choose date');
});
