import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ChatbotScreen from '@/app/(tabs)/chatbot';
import { supabase } from '@/src/lib/supabase';

const mockSessionInsert = jest.fn();
const mockSessionUpdate = jest.fn();
const mockMessageInsert = jest.fn();
const mockInvoke = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/src/providers/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'caregiver-1' } } }) }));
jest.mock('@/src/providers/HealthDataProvider', () => ({ useHealthData: () => ({ elderly: { elderly_id: 'patient-1', full_name: 'Maria' }, vital: null }) }));
jest.mock('@/src/lib/supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));

export function prepareChatWorkflow(reply: { data: Record<string, unknown> | null; error: Error | null }) {
  (supabase.from as jest.Mock).mockImplementation((table: string) => table === 'ai_chatbot_sessions'
    ? { insert: mockSessionInsert, update: mockSessionUpdate }
    : { insert: mockMessageInsert });
  (supabase.functions.invoke as jest.Mock).mockImplementation(mockInvoke);
  mockSessionInsert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: 'session-1' }, error: null }) }) });
  mockSessionUpdate.mockReturnValue({ eq: async () => ({ error: null }) });
  mockMessageInsert.mockResolvedValue({ error: null });
  mockInvoke.mockResolvedValue(reply);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  return { sessionInsert: mockSessionInsert, sessionUpdate: mockSessionUpdate, messageInsert: mockMessageInsert, invoke: mockInvoke, push: mockPush };
}

export async function sendChatQuestion(question: string) {
  await render(<ChatbotScreen />);
  await fireEvent.changeText(screen.getByPlaceholderText('Ask about health or care…'), question);
  await fireEvent.press(screen.getByLabelText('Send message'));
  return screen;
}

export { waitFor };
