import { prepareChatWorkflow, sendChatQuestion, waitFor } from '../test-support/integration/chat-workflow-harness';
import { fireEvent } from '@testing-library/react-native';

test('INT-024 Elle medication advice links into the Care medication tab', async () => {
  const { push } = prepareChatWorkflow({ data: { reply: 'Check Maria’s medication schedule before the next dose.', emotion: 'happy' }, error: null });
  const screen = await sendChatQuestion('What medication is due?');
  await waitFor(() => expect(screen.getByText('Open Meds')).toBeTruthy());
  await fireEvent.press(screen.getByText('Open Meds'));
  expect(push).toHaveBeenCalledWith('/care?tab=Medications');
});
