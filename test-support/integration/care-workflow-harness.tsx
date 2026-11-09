import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import CareScreen from '@/app/(tabs)/care';
import { supabase } from '@/src/lib/supabase';
import {isCarePushRegistered} from '@/src/lib/watch-push';

type Row = Record<string, any>;
const mockSession = { user: { id: 'caregiver-1' } };
const mockElderly = { elderly_id: 'patient-1', full_name: 'Maria' };
const mockStore = new Map<string, string>();
let mockRows: Record<string, Row[]> = {};
let mockWriteFailure: Error|null=null;
const mockWrites: { table: string; operation: string; payload: Row }[] = [];

jest.mock('expo-router', () => {
  const React = require('react');
  return { useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]), useLocalSearchParams: () => ({}) };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock('@/src/providers/HealthDataProvider', () => ({ useHealthData: () => ({ elderly: mockElderly }) }));
jest.mock('@/src/components/PickerModal', () => ({ PickerModal: ({visible,onChange,onClose}:any) => {const React=require('react');const {Pressable,Text}=require('react-native');return visible?React.createElement(Pressable,{onPress:()=>{const date=new Date();date.setHours(20,0,0,0);onChange(date);onClose();}},React.createElement(Text,null,'Choose 8:00 PM')):null;} }));
jest.mock('@/src/hooks/useCareRefresh',()=>({useCareRefresh:jest.fn()}));
jest.mock('@/src/lib/watch-push',()=>({isCarePushRegistered:jest.fn(async()=>false)}));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn(),rpc:jest.fn() } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStore.delete(key); }),
} }));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4, MAX: 5 },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', WEEKLY: 'weekly' },
  setNotificationHandler: jest.fn(), setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-1'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
}));

export const medication = {
  id: 'med-1', elderly_id: 'patient-1', caregiver_id: 'caregiver-1', medication_name: 'Losartan', dosage: '50 mg', frequency: 'Daily',
  instructions: null, color_tag: null, is_active: true, times_of_day: ['08:00'],
  reminder_enabled: true, start_date: '2026-10-01',
};

export function prepareCareWorkflow(rows: Partial<Record<'medication_schedules' | 'medication_logs' | 'appointments' | 'caregiver_notes', Row[]>> = {}) {
  (isCarePushRegistered as jest.Mock).mockReset().mockResolvedValue(false);
  mockRows = { medication_schedules: [], medication_logs: [], appointments: [], caregiver_notes: [], ...rows };
  mockStore.clear();
  mockWriteFailure=null;
  mockWrites.length = 0;
  (supabase.rpc as jest.Mock).mockImplementation(async(name:string,args:Row)=>{
    if(name!=='mark_medication_taken')return {data:null,error:Error('Unexpected RPC')};
    if(!mockRows.medication_logs.some(row=>row.schedule_id===args.p_schedule&&row.scheduled_time===args.p_scheduled)){
      const payload={schedule_id:args.p_schedule,elderly_id:mockElderly.elderly_id,scheduled_time:args.p_scheduled,taken_at:new Date().toISOString(),status:'taken'};
      mockRows.medication_logs.push(payload);mockWrites.push({table:'medication_logs',operation:'insert',payload});
    }
    return {data:{accepted:true},error:null};
  });
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    let operation = 'read';
    let payload: Row = {};
    const filters: [string, unknown][] = [];
    let committed = false;
    const result = () => {
      if (operation === 'read') {
        let data = mockRows[table] ?? [];
        for (const [key, value] of filters) data = data.filter((row) => row[key] === value);
        return { data, error: null };
      }
      if (!committed) {
        if(mockWriteFailure){const error=mockWriteFailure;mockWriteFailure=null;return {data:null,error};}
        mockWrites.push({ table, operation, payload });
        if (operation === 'insert') {
          const id = table === 'medication_schedules' ? 'med-new' : table === 'appointments' ? 'appt-new' : 'log-new';
          mockRows[table].push({ id, ...payload });
        } else if (operation === 'update') {
          mockRows[table] = mockRows[table].map((row) => filters.every(([key, value]) => row[key] === value) ? { ...row, ...payload } : row);
        } else if (operation === 'delete') {
          mockRows[table] = mockRows[table].filter((row) => !filters.every(([key, value]) => row[key] === value));
        }
        committed = true;
      }
      return { data: table === 'medication_schedules' ? { id: operation === 'insert' ? 'med-new' : 'med-1', start_date: '2026-10-01' } : { id: 'appt-new' }, error: null };
    };
    const query: {
      select: jest.Mock;
      eq: jest.Mock;
      gte: jest.Mock;
      order: jest.Mock;
      insert: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      single: jest.Mock;
      then: (resolve: (value: ReturnType<typeof result>) => void, reject?: (reason: unknown) => void) => Promise<void>;
    } = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
      gte: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
      insert: jest.fn((next: Row) => { operation = 'insert'; payload = next; return query; }),
      update: jest.fn((next: Row) => { operation = 'update'; payload = next; return query; }),
      delete: jest.fn(() => { operation = 'delete'; return query; }),
      single: jest.fn(async () => result()),
      then: (resolve: (value: ReturnType<typeof result>) => void, reject?: (reason: unknown) => void) => Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  return { writes: mockWrites, store: mockStore, from: supabase.from as jest.Mock,failNextWrite:(error:Error)=>{mockWriteFailure=error;} };
}

export async function showCare() {
  await render(<CareScreen />);
  await waitFor(() => expect((supabase.from as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(4));
  return screen;
}

export async function pressText(value: string) {
  await act(async () => { await fireEvent.press(screen.getByText(value)); });
}

export async function pressLabel(value: string) {
  await act(async () => { await fireEvent.press(screen.getByLabelText(value)); });
}

export async function change(label: string, value: string) {
  await act(async () => { await fireEvent.changeText(screen.getByLabelText(label), value); });
}

export { act,screen, waitFor, Alert, Notifications, AsyncStorage };
