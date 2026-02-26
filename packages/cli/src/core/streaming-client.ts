/**
 * Anthropic streaming API wrapper.
 * Yields typed chunks from the Messages SSE stream.
 */

declare const process: { env: Record<string, string | undefined> };

export interface StreamChunk {
  type: 'text_delta' | 'tool_use_start' | 'tool_input_delta' | 'tool_use_complete' | 'message_stop' | 'usage';
  text?: string;
  toolName?: string;
  toolInput?: string;
  inputTokens?: number;
  outputTokens?: number;
  usage?: { input: number; output: number };
}

export interface StreamOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  tools?: Array<{ name: string; description: string; input_schema: object }>;
  toolChoice?: { type: string; name?: string };
  maxTokens?: number;
  signal?: AbortSignal;
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_MAX_TOKENS = 8192;

export async function* streamCompletion(options: StreamOptions): AsyncGenerator<StreamChunk> {
  const {
    apiKey,
    model = DEFAULT_MODEL,
    baseUrl = DEFAULT_BASE_URL,
    systemPrompt,
    messages,
    tools,
    toolChoice,
    maxTokens = DEFAULT_MAX_TOKENS,
    signal,
  } = options;

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
    stream: true,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
  }
  if (toolChoice) {
    body.tool_choice = toolChoice;
  }

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null — streaming not supported');
  }

  // Track state for tool_use blocks
  let currentToolName: string | null = null;
  let accumulatedToolInput = '';

  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .getReader();

  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += value;
      const lines = buffer.split('\n');
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '' || jsonStr === '[DONE]') continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(jsonStr) as Record<string, unknown>;
        } catch {
          continue;
        }

        yield* handleSSEEvent(event, {
          getCurrentToolName: () => currentToolName,
          setCurrentToolName: (name: string | null) => { currentToolName = name; },
          getAccumulatedToolInput: () => accumulatedToolInput,
          appendToolInput: (chunk: string) => { accumulatedToolInput += chunk; },
          resetToolInput: () => { accumulatedToolInput = ''; },
        });
      }
    }

    // Process any remaining data in the buffer
    if (buffer.trim().startsWith('data: ')) {
      const jsonStr = buffer.trim().slice(6).trim();
      if (jsonStr !== '' && jsonStr !== '[DONE]') {
        try {
          const event = JSON.parse(jsonStr) as Record<string, unknown>;
          yield* handleSSEEvent(event, {
            getCurrentToolName: () => currentToolName,
            setCurrentToolName: (name: string | null) => { currentToolName = name; },
            getAccumulatedToolInput: () => accumulatedToolInput,
            appendToolInput: (chunk: string) => { accumulatedToolInput += chunk; },
            resetToolInput: () => { accumulatedToolInput = ''; },
          });
        } catch {
          // Ignore malformed trailing data
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

interface ToolState {
  getCurrentToolName: () => string | null;
  setCurrentToolName: (name: string | null) => void;
  getAccumulatedToolInput: () => string;
  appendToolInput: (chunk: string) => void;
  resetToolInput: () => void;
}

function* handleSSEEvent(
  event: Record<string, unknown>,
  toolState: ToolState,
): Generator<StreamChunk> {
  const eventType = event.type as string;

  switch (eventType) {
    case 'message_start': {
      const message = event.message as Record<string, unknown> | undefined;
      const usageData = message?.usage as Record<string, number> | undefined;
      if (usageData) {
        yield {
          type: 'usage',
          inputTokens: usageData.input_tokens,
          outputTokens: usageData.output_tokens,
          usage: { input: usageData.input_tokens ?? 0, output: usageData.output_tokens ?? 0 },
        };
      }
      break;
    }

    case 'content_block_start': {
      const contentBlock = event.content_block as Record<string, unknown> | undefined;
      if (contentBlock?.type === 'tool_use') {
        const toolName = contentBlock.name as string;
        toolState.setCurrentToolName(toolName);
        toolState.resetToolInput();
        yield { type: 'tool_use_start', toolName };
      }
      break;
    }

    case 'content_block_delta': {
      const delta = event.delta as Record<string, unknown> | undefined;
      if (!delta) break;

      if (delta.type === 'text_delta') {
        yield { type: 'text_delta', text: delta.text as string };
      } else if (delta.type === 'input_json_delta') {
        const partial = delta.partial_json as string;
        toolState.appendToolInput(partial);
        yield { type: 'tool_input_delta', toolInput: partial };
      }
      break;
    }

    case 'content_block_stop': {
      if (toolState.getCurrentToolName() !== null) {
        yield {
          type: 'tool_use_complete',
          toolName: toolState.getCurrentToolName() ?? undefined,
          toolInput: toolState.getAccumulatedToolInput(),
        };
        toolState.setCurrentToolName(null);
        toolState.resetToolInput();
      }
      break;
    }

    case 'message_delta': {
      const usageData = event.usage as Record<string, number> | undefined;
      if (usageData) {
        yield {
          type: 'usage',
          inputTokens: usageData.input_tokens,
          outputTokens: usageData.output_tokens,
          usage: { input: usageData.input_tokens ?? 0, output: usageData.output_tokens ?? 0 },
        };
      }
      break;
    }

    case 'message_stop': {
      yield { type: 'message_stop' };
      break;
    }

    default:
      // ping, error, and other events are ignored
      break;
  }
}
