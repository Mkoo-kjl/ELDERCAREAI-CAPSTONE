import { prepareChatWorkflow, sendChatQuestion, waitFor } from '../test-support/integration/chat-workflow-harness';

test('INT-019 chat creates a session, invokes Elle, and persists both messages', async () => {
  const { sessionInsert, messageInsert, invoke } = prepareChatWorkflow({ data: { reply: 'Maria slept 7 hours in the latest reading.', emotion: 'happy' }, error: null });
  const screen = await sendChatQuestion('How was Maria’s sleep?');
  await waitFor(() => expect(screen.getByText('Maria slept 7 hours in the latest reading.')).toBeTruthy());
  expect(sessionInsert).toHaveBeenCalledWith(expect.objectContaining({ caregiver_id: 'caregiver-1', elderly_id: 'patient-1' }));
  expect(invoke).toHaveBeenCalledWith('ai-care-assistant', expect.objectContaining({ body: expect.objectContaining({ sessionId: 'session-1', message: 'How was Maria’s sleep?' }) }));
  expect(messageInsert).toHaveBeenCalledWith(expect.arrayContaining([
    expect.objectContaining({ role: 'user', content: 'How was Maria’s sleep?' }),
    expect.objectContaining({ role: 'assistant', content: 'Maria slept 7 hours in the latest reading.' }),
  ]));
});
