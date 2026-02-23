import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ModelBroker } from '@/runtime/model-broker.js';
import { compactMessages } from './compaction.js';

const mockGenerateText = mock(async () => ({ text: 'Conversation summary: key decisions and outcomes.' }));
mock.module('ai', () => ({ generateText: mockGenerateText }));

function makeBroker(): { broker: ModelBroker; getModel: ReturnType<typeof mock> } {
  const getModel = mock(() => 'mock-fast-model' as unknown);
  return {
    broker: { getModel } as unknown as ModelBroker,
    getModel,
  };
}

function makeMessages(): Parameters<typeof compactMessages>[0] {
  const system = { role: 'system' as const, content: 'You are Tino.' };
  const turns = Array.from({ length: 14 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
    content: `message-${i + 1}`,
  }));
  return [system, ...turns] as Parameters<typeof compactMessages>[0];
}

describe('compactMessages', () => {
  beforeEach(() => {
    mockGenerateText.mockClear();
  });

  test('compacts old messages into one summary while preserving system and recent messages', async () => {
    const { broker, getModel } = makeBroker();
    const messages = makeMessages();
    const expectedRecent = messages.slice(-10).map((m) => m.content);

    const result = await compactMessages(messages, broker);

    expect(result.summary).toBe('Conversation summary: key decisions and outcomes.');
    expect(result.removedCount).toBe(4);

    expect(messages[0]).toEqual({ role: 'system', content: 'You are Tino.' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Conversation summary: key decisions and outcomes.' });
    expect(messages.slice(2).map((m) => m.content)).toEqual(expectedRecent);

    expect(getModel).toHaveBeenCalledWith('summarize');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  test('includes focus in compaction prompt when provided', async () => {
    const { broker } = makeBroker();
    const messages = makeMessages();

    await compactMessages(messages, broker, 'risk controls and execution constraints');

    const call = mockGenerateText.mock.calls[0] as unknown as [{ messages: Array<{ role: string; content: string }> }];
    const prompt = call[0].messages.find((m) => m.role === 'user')?.content ?? '';
    expect(prompt).toContain('risk controls and execution constraints');
  });
});
