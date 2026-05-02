import { describe, expect, it } from 'vitest';

import { buildTextUpdate, runBotScenario, TEST_CHAT_ID } from './helpers';

describe('/ping', () => {
  it('handles /ping update end-to-end and sends pong', async () => {
    const { sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate('/ping'),
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: 'pong',
    });
  });
});
