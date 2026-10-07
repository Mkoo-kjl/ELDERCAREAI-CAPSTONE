import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ChatbotScreen from '@/app/(tabs)/chatbot';
import { supabase } from '@/src/lib/supabase';

const mockPush = jest.fn();
const mockSessionInsert = jest.fn();
const mockSessionUpdate = jest.fn();
const mockMessageInsert = jest.fn();
const mockInvoke = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'caregiver-1' } } }) }));
jest.mock('@/src/providers/HealthDataProvider', () => ({ useHealthData: () => ({ elderly: { elderly_id: 'patient-1', full_name: 'Maria' }, vital: null }) }));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));

beforeEach(() => {
  (supabase.from as jest.Mock).mockImplementation((table: string) => table === 'ai_chatbot_sessions'
    ? { insert: mockSessionInsert, update: mockSessionUpdate }
    : { insert: mockMessageInsert });
  (supabase.functions.invoke as jest.Mock).mockImplementation(mockInvoke);
  mockSessionInsert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: 'session-1' }, error: null }) }) });
  mockSessionUpdate.mockReturnValue({ eq: async () => ({ error: null }) });
  mockMessageInsert.mockResolvedValue({ error: null });
  mockInvoke.mockResolvedValue({ data: { reply: 'Maria slept 7 hours in the latest patient reading.', emotion: 'happy' }, error: null });
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

async function sendQuestion(question: string) {
  await fireEvent.changeText(screen.getByPlaceholderText('Ask about health or care…'), question);
  await fireEvent.press(screen.getByLabelText('Send message'));
}

describe('Elle caregiver assistant', () => {
  test('CASE-038 sends one question and renders the assistant response', async () => {
    await render(<ChatbotScreen />);
    await sendQuestion('How was Maria’s sleep?');
    await waitFor(() => expect(screen.getByText('Maria slept 7 hours in the latest patient reading.')).toBeTruthy());
    expect(mockInvoke).toHaveBeenCalledWith('ai-care-assistant', expect.objectContaining({ body: expect.objectContaining({ message: 'How was Maria’s sleep?', sessionId: 'session-1' }) }));
    expect(mockMessageInsert).toHaveBeenCalledTimes(1);
  });
});
