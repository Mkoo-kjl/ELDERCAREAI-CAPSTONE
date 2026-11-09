import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import HealthRecordsScreen from '@/app/health-records';
import { supabase } from '@/src/lib/supabase';

const mockPush = jest.fn();
const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockSession = { user: { id: 'caregiver-1' } };
const mockElderly = { elderly_id: 'patient-1', full_name: 'Maria Santos' };
const mockUpdate = jest.fn();
const mockInsert = jest.fn();
let mockSaveError = false;
let mockCheckups: Record<string, unknown>[] = [];
type MockQuery = {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  maybeSingle: jest.Mock;
  single: jest.Mock;
  update: jest.Mock;
  insert: jest.Mock;
  then: (resolve: (value: unknown) => void, reject?: (reason: unknown) => void) => Promise<void>;
};

jest.mock('expo-router', () => {
  const React = require('react');
  return { useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]), useRouter: () => ({ back: jest.fn(), push: mockPush }) };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: () => ({ session: mockSession }) }));
jest.mock('@/src/providers/HealthDataProvider', () => ({ useHealthData: () => ({ elderly: mockElderly, refresh: mockRefresh }) }));
jest.mock('@/src/components/PickerModal', () => ({ PickerModal: () => null }));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

beforeEach(() => {
  mockSaveError = false;
  mockCheckups = [{ id: 'visit-1', title: 'Annual checkup', appointment_at: '2026-09-01T04:00:00.000Z', doctor_name: 'Dr. Kevin', location: null, notes: 'Routine examination' }];
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    let operation = 'read';
    let payload: Record<string, unknown> = {};
    const result = () => {
      if (operation !== 'read') return { data: table === 'elderly_profiles' ? { medical_conditions: payload.medical_conditions } : { id: 'visit-2' }, error: mockSaveError ? { message: 'Network error' } : null };
      if (table === 'elderly_profiles') return { data: { medical_conditions: 'Hypertension' }, error: null };
      if (table === 'appointments') return { data: mockCheckups, error: null };
      return { data: [{ id: 'med-1', medication_name: 'Losartan', dosage: '50 mg', frequency: 'Daily' }], error: null };
    };
    const builder: MockQuery = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(() => Promise.resolve(result())), single: jest.fn(() => Promise.resolve(result())),
      update: jest.fn((next: Record<string, unknown>) => { operation = 'update'; payload = next; mockUpdate(table, next); return builder; }),
      insert: jest.fn((next: Record<string, unknown>) => { operation = 'insert'; payload = next; mockInsert(table, next); return builder; }),
      then: (resolve: (value: unknown) => void, reject?: (reason: unknown) => void) => Promise.resolve(result()).then(resolve, reject),
    };
    return builder;
  });
});

async function press(label: string) {
  await act(async () => { fireEvent.press(screen.getByLabelText(label)); });
}

async function pressText(text: string) {
  await act(async () => { fireEvent.press(screen.getByText(text)); });
}

async function change(label: string, value: string) {
  await act(async () => { fireEvent.changeText(screen.getByLabelText(label), value); });
}

it('shows saved history, completed checkups, and medication schedules from existing tables', async () => {
  await render(<HealthRecordsScreen />);
  await waitFor(() => expect(screen.getByText('Hypertension')).toBeTruthy(), { timeout: 10000 });
  expect(screen.getByText('Annual checkup')).toBeTruthy();
  expect(screen.getByText('Losartan')).toBeTruthy();
  await press('Manage medications');
  expect(mockPush).toHaveBeenCalledWith('/care?tab=Medications');
});

it('cancels history edits without writing and saves a later edit to the older adult profile', async () => {
  await render(<HealthRecordsScreen />);
  await waitFor(() => expect(screen.getByText('Hypertension')).toBeTruthy(), { timeout: 10000 });
  await press('Edit medical history');
  await change('Medical history and conditions', 'Hypertension and arthritis');
  await pressText('Cancel');
  await waitFor(() => expect(screen.getByLabelText('Edit medical history')).toBeTruthy());
  expect(mockUpdate).not.toHaveBeenCalled();
  await press('Edit medical history');
  await change('Medical history and conditions', 'Hypertension and arthritis');
  await pressText('Save Entry');
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('elderly_profiles', { medical_conditions: 'Hypertension and arthritis' }));
  await waitFor(() => expect(screen.getByText('Hypertension and arthritis')).toBeTruthy());
  expect(mockRefresh).toHaveBeenCalledWith(false);
});

it('validates checkups, preserves the draft after a failed save, then inserts a completed visit', async () => {
  await render(<HealthRecordsScreen />);
  await waitFor(() => expect(screen.getByText('Annual checkup')).toBeTruthy(), { timeout: 10000 });
  await press('Add checkup');
  await pressText('Save Entry');
  expect(screen.getByText('Enter a checkup title.')).toBeTruthy();
  await change('Checkup title', 'Follow-up visit');
  await change('Findings or treatment', 'Reviewed current care plan');
  mockSaveError = true;
  await pressText('Save Entry');
  await waitFor(() => expect(screen.getByText('Could not save the checkup. Please try again.')).toBeTruthy());
  expect(screen.getByDisplayValue('Reviewed current care plan')).toBeTruthy();
  mockSaveError = false;
  await pressText('Save Entry');
  await waitFor(() => expect(mockInsert).toHaveBeenCalledWith('appointments', expect.objectContaining({ title: 'Follow-up visit', notes: 'Reviewed current care plan', status: 'completed', elderly_id: 'patient-1' })));
});

it('cancels a checkup edit without a write, then updates the existing visit', async () => {
  await render(<HealthRecordsScreen />);
  await waitFor(() => expect(screen.getByText('Annual checkup')).toBeTruthy(), { timeout: 10000 });
  await press('Edit Annual checkup');
  await change('Findings or treatment', 'Updated clinical notes');
  await press('Cancel checkup');
  expect(mockUpdate).not.toHaveBeenCalled();
  await press('Edit Annual checkup');
  await change('Findings or treatment', 'Updated clinical notes');
  await pressText('Save Entry');
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('appointments', expect.objectContaining({ title: 'Annual checkup', notes: 'Updated clinical notes', status: 'completed' })));
});
