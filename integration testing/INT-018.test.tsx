import { prepareChatWorkflow, sendChatQuestion, waitFor } from '../test-support/integration/chat-workflow-harness';

test('INT-020 assistant failure is presented safely without persisting a false reply', async () => {
  const { messageInsert } = prepareChatWorkflow({ data: null, error: new Error('Bad Request') });
  const screen = await sendChatQuestion('How was the sleep?');
  await waitFor(() => expect(screen.getByText(/couldn't reach the care assistant right now/)).toBeTruthy());
  expect(screen.queryByText('Bad Request')).toBeNull();
  expect(messageInsert).not.toHaveBeenCalled();
});
