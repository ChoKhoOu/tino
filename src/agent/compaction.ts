import { generateText, streamText } from 'ai';
import type { ModelBroker } from '@/runtime/model-broker.js';

const KEEP_RECENT_MESSAGES = 10;

export type RuntimeMessages = NonNullable<Parameters<typeof streamText>[0]['messages']>;

function toText(content: unknown): string {
  if (typeof content === 'string') return content;
  return JSON.stringify(content);
}

function toTranscript(messages: RuntimeMessages): string {
  return messages
    .map((message, index) => `${index + 1}. [${message.role}] ${toText(message.content)}`)
    .join('\n');
}

function buildCompactionPrompt(messages: RuntimeMessages, focus?: string): string {
  const focusLine = focus?.trim()
    ? `Focus topic: ${focus.trim()}\nPrioritize details and decisions related to this topic.`
    : 'No explicit focus provided. Preserve the most important information across all topics.';

  return [
    'Summarize this conversation segment for future turns in a single compact note.',
    'Include key decisions, findings, open questions, constraints, and next steps.',
    'Preserve any tool-call outputs that are still relevant for future reasoning.',
    focusLine,
    'Conversation segment:',
    toTranscript(messages),
  ].join('\n\n');
}

export async function compactMessages(
  messages: RuntimeMessages,
  broker: ModelBroker,
  focus?: string,
): Promise<{ summary: string; removedCount: number }> {
  if (messages.length <= 1 + KEEP_RECENT_MESSAGES) {
    return { summary: '', removedCount: 0 };
  }

  const removable = messages.slice(1, -KEEP_RECENT_MESSAGES);
  if (removable.length === 0) {
    return { summary: '', removedCount: 0 };
  }

  const result = await generateText({
    model: broker.getModel('summarize'),
    messages: [
      {
        role: 'system',
        content: 'You are a context compaction assistant. Produce concise, durable summaries for multi-turn agent memory.',
      },
      {
        role: 'user',
        content: buildCompactionPrompt(removable, focus),
      },
    ],
  });

  const summary = result.text.trim();
  const preserved = [messages[0], ...messages.slice(-KEEP_RECENT_MESSAGES)] as RuntimeMessages;
  messages.length = 0;
  messages.push(...preserved, { role: 'assistant', content: summary } as RuntimeMessages[number]);
  const lastIndex = messages.length - 1;
  const summaryMessage = messages[lastIndex];
  messages.splice(lastIndex, 1);
  messages.splice(1, 0, summaryMessage);

  return { summary, removedCount: removable.length };
}
