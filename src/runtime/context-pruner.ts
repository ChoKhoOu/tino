import { compactMessages } from '@/agent/compaction.js';
import { estimateTokens } from './token-usage-helpers.js';
import type { ModelBroker } from './model-broker.js';

const CONTEXT_THRESHOLD = 100_000;
const KEEP_TOOL_USES = 5;

type RuntimeMessages = Array<{ role: string; content: unknown }>;

export async function pruneContext(
  messages: RuntimeMessages,
  broker: ModelBroker,
): Promise<{ clearedCount: number; keptCount: number } | null> {
  const payload = messages
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
    .join('');
  if (estimateTokens(payload) <= CONTEXT_THRESHOLD) return null;
  const keepFromEnd = KEEP_TOOL_USES * 2;
  if (messages.length <= 1 + keepFromEnd) return null;

  try {
    const compacted = await compactMessages(messages as never, broker);
    if (compacted.removedCount > 0) {
      return { clearedCount: compacted.removedCount, keptCount: messages.length };
    }
  } catch {}

  const before = messages.length;
  const head = messages.slice(0, 1);
  const tail = messages.slice(-keepFromEnd);
  messages.length = 0;
  messages.push(...head, ...tail);
  return { clearedCount: before - messages.length, keptCount: messages.length };
}
