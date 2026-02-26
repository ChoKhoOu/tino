import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamCompletion } from '../core/streaming-client.js';

/**
 * Helper to create a mock SSE Response.
 * Each event string should be a full "data: ..." line.
 */
function createSSEResponse(events: string[]): Response {
  const text = events.join('\n') + '\n';
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('streamCompletion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should yield text_delta chunks', async () => {
    const events = [
      'data: {"type":"message_start","message":{"id":"msg_1","role":"assistant","content":[],"model":"claude-sonnet-4-20250514","usage":{"input_tokens":10,"output_tokens":0}}}',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}',
      'data: {"type":"content_block_stop","index":0}',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}',
      'data: {"type":"message_stop"}',
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createSSEResponse(events));

    const chunks: any[] = [];
    for await (const chunk of streamCompletion({
      apiKey: 'test-key',
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === 'text_delta');
    expect(textChunks).toHaveLength(2);
    expect(textChunks[0].text).toBe('Hello');
    expect(textChunks[1].text).toBe(' world');
  });

  it('should yield usage chunks from message_start', async () => {
    const events = [
      'data: {"type":"message_start","message":{"id":"msg_1","role":"assistant","content":[],"model":"claude-sonnet-4-20250514","usage":{"input_tokens":42,"output_tokens":0}}}',
      'data: {"type":"message_stop"}',
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createSSEResponse(events));

    const chunks: any[] = [];
    for await (const chunk of streamCompletion({
      apiKey: 'test-key',
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      chunks.push(chunk);
    }

    const usageChunks = chunks.filter((c) => c.type === 'usage');
    expect(usageChunks.length).toBeGreaterThanOrEqual(1);
    expect(usageChunks[0].inputTokens).toBe(42);
  });

  it('should yield message_stop at end', async () => {
    const events = [
      'data: {"type":"message_start","message":{"id":"msg_1","role":"assistant","content":[],"model":"claude-sonnet-4-20250514","usage":{"input_tokens":10,"output_tokens":0}}}',
      'data: {"type":"message_stop"}',
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createSSEResponse(events));

    const chunks: any[] = [];
    for await (const chunk of streamCompletion({
      apiKey: 'test-key',
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks[chunks.length - 1].type).toBe('message_stop');
  });

  it('should handle tool_use events', async () => {
    const events = [
      'data: {"type":"message_start","message":{"id":"msg_1","role":"assistant","content":[],"model":"claude-sonnet-4-20250514","usage":{"input_tokens":10,"output_tokens":0}}}',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tu_1","name":"get_weather","input":{}}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"city\\":"}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"\\"SF\\"}"}}',
      'data: {"type":"content_block_stop","index":0}',
      'data: {"type":"message_stop"}',
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createSSEResponse(events));

    const chunks: any[] = [];
    for await (const chunk of streamCompletion({
      apiKey: 'test-key',
      systemPrompt: 'test',
      messages: [{ role: 'user', content: 'weather' }],
    })) {
      chunks.push(chunk);
    }

    const toolStart = chunks.find((c) => c.type === 'tool_use_start');
    expect(toolStart).toBeDefined();
    expect(toolStart!.toolName).toBe('get_weather');

    const toolComplete = chunks.find((c) => c.type === 'tool_use_complete');
    expect(toolComplete).toBeDefined();
    expect(toolComplete!.toolName).toBe('get_weather');
    expect(toolComplete!.toolInput).toBe('{"city":"SF"}');
  });

  it('should handle abort signal', async () => {
    const controller = new AbortController();

    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      controller.abort();
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });

    const chunks: any[] = [];
    try {
      for await (const chunk of streamCompletion({
        apiKey: 'test-key',
        systemPrompt: 'test',
        messages: [{ role: 'user', content: 'hi' }],
        signal: controller.signal,
      })) {
        chunks.push(chunk);
      }
      // Should not reach here
      expect.unreachable('Should have thrown');
    } catch (e: any) {
      expect(e.name).toBe('AbortError');
    }
  });

  it('should handle API errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":"invalid_api_key"}', { status: 401 }),
    );

    await expect(async () => {
      for await (const _chunk of streamCompletion({
        apiKey: 'bad-key',
        systemPrompt: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        // should throw before yielding
      }
    }).rejects.toThrow('Anthropic API error (401)');
  });

  it('should handle null response body', async () => {
    const resp = new Response(null, { status: 200 });
    Object.defineProperty(resp, 'body', { value: null });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(resp);

    await expect(async () => {
      for await (const _chunk of streamCompletion({
        apiKey: 'test-key',
        systemPrompt: 'test',
        messages: [{ role: 'user', content: 'hi' }],
      })) {
        // should throw
      }
    }).rejects.toThrow('Response body is null');
  });

  it('should send correct request headers and body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createSSEResponse(['data: {"type":"message_stop"}']),
    );

    const chunks: any[] = [];
    for await (const chunk of streamCompletion({
      apiKey: 'my-key',
      systemPrompt: 'Be helpful',
      messages: [{ role: 'user', content: 'hi' }],
      model: 'claude-sonnet-4-20250514',
      maxTokens: 1024,
    })) {
      chunks.push(chunk);
    }

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init as any).method).toBe('POST');
    expect((init as any).headers['x-api-key']).toBe('my-key');
    expect((init as any).headers['anthropic-version']).toBe('2023-06-01');

    const body = JSON.parse((init as any).body);
    expect(body.model).toBe('claude-sonnet-4-20250514');
    expect(body.max_tokens).toBe(1024);
    expect(body.system).toBe('Be helpful');
    expect(body.stream).toBe(true);
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });
});
