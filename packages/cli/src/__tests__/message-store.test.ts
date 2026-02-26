import { describe, it, expect, vi } from 'vitest';
import { createMessageStore } from '../core/message-store.js';

describe('MessageStore', () => {
  it('should add messages with unique ids', () => {
    const store = createMessageStore();
    const id1 = store.addMessage('user', 'hello');
    const id2 = store.addMessage('assistant', 'hi');
    expect(id1).not.toBe(id2);
    expect(store.messages).toHaveLength(2);
    expect(store.messages[0].role).toBe('user');
    expect(store.messages[0].content).toBe('hello');
  });

  it('should add messages via object overload', () => {
    const store = createMessageStore();
    const id = store.addMessage({ role: 'system', content: 'You are helpful' });
    expect(id).toBeTruthy();
    expect(store.messages).toHaveLength(1);
    expect(store.messages[0].role).toBe('system');
    expect(store.messages[0].content).toBe('You are helpful');
  });

  it('should handle streaming lifecycle', () => {
    const store = createMessageStore();
    const id = store.startStreaming();
    expect(store.streamingMessageId).toBe(id);
    expect(store.getStreamingMessage()?.isStreaming).toBe(true);

    store.appendToStreaming('Hello ');
    store.appendToStreaming('world');
    expect(store.getStreamingMessage()?.content).toBe('Hello world');

    store.completeStreaming();
    expect(store.streamingMessageId).toBeNull();
    expect(store.getStreamingMessage()).toBeNull();
    // Completed message should be in the completed list
    const completed = store.getCompleted();
    expect(completed.some((m) => m.content === 'Hello world')).toBe(true);
  });

  it('should handle streaming cancellation', () => {
    const store = createMessageStore();
    store.startStreaming();
    store.appendToStreaming('partial');
    store.completeStreaming(true); // cancelled
    const completed = store.getCompleted();
    const last = completed[completed.length - 1];
    expect(last.content).toContain('partial');
    expect(last.content).toContain('[cancelled]');
    expect(last.isStreaming).toBe(false);
  });

  it('should handle appendChunk for text_delta', () => {
    const store = createMessageStore();
    // appendChunk auto-starts streaming if needed
    store.appendChunk({ type: 'text_delta', text: 'Hello' });
    expect(store.streamingMessageId).not.toBeNull();
    expect(store.getStreamingMessage()?.content).toBe('Hello');

    store.appendChunk({ type: 'text_delta', text: ' world' });
    expect(store.getStreamingMessage()?.content).toBe('Hello world');
  });

  it('should ignore appendChunk for non-text_delta types', () => {
    const store = createMessageStore();
    store.appendChunk({ type: 'tool_use_start' });
    expect(store.streamingMessageId).toBeNull();
    expect(store.messages).toHaveLength(0);
  });

  it('should notify subscribers on state changes', () => {
    const store = createMessageStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    store.addMessage('user', 'test');
    expect(listener).toHaveBeenCalled();

    unsub();
    listener.mockClear();
    store.addMessage('user', 'test2');
    expect(listener).not.toHaveBeenCalled();
  });

  it('should notify on streaming operations with throttled appends', () => {
    vi.useFakeTimers();
    const store = createMessageStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.startStreaming();
    expect(listener).toHaveBeenCalledTimes(1); // immediate

    store.appendToStreaming('chunk');
    // appendToStreaming uses throttledNotify — not fired synchronously
    expect(listener).toHaveBeenCalledTimes(1);

    // Advance past the 33ms frame interval to flush the throttled notification
    vi.advanceTimersByTime(34);
    expect(listener).toHaveBeenCalledTimes(2);

    // completeStreaming uses flushNotify — fires immediately
    store.completeStreaming();
    expect(listener).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('should batch multiple appends into a single throttled notification', () => {
    vi.useFakeTimers();
    const store = createMessageStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.startStreaming();
    expect(listener).toHaveBeenCalledTimes(1);

    // Rapid-fire appends within one frame interval
    store.appendToStreaming('a');
    store.appendToStreaming('b');
    store.appendToStreaming('c');
    // Only one throttled notification should be scheduled
    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(34);
    // All three appends batched into a single notification
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getStreamingMessage()?.content).toBe('abc');

    vi.useRealTimers();
  });

  it('should flush pending throttled notification on completeStreaming', () => {
    vi.useFakeTimers();
    const store = createMessageStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.startStreaming();
    listener.mockClear();

    store.appendToStreaming('data');
    // Throttled — not yet fired
    expect(listener).toHaveBeenCalledTimes(0);

    // completeStreaming flushes immediately without waiting for timer
    store.completeStreaming(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getCompleted().pop()?.content).toContain('[cancelled]');

    vi.useRealTimers();
  });

  it('should reset all state', () => {
    const store = createMessageStore();
    store.addMessage('user', 'hello');
    store.addMessage('assistant', 'hi');
    store.reset();
    expect(store.messages).toHaveLength(0);
    expect(store.streamingMessageId).toBeNull();
  });

  it('should return only completed messages from getCompleted', () => {
    const store = createMessageStore();
    store.addMessage('user', 'hello');
    store.startStreaming();
    store.appendToStreaming('partial');
    // One completed user message, one streaming assistant message
    const completed = store.getCompleted();
    expect(completed).toHaveLength(1);
    expect(completed[0].content).toBe('hello');
  });

  it('should return only user/assistant completed messages from getMessages', () => {
    const store = createMessageStore();
    store.addMessage('system', 'system prompt');
    store.addMessage('user', 'hello');
    store.addMessage('assistant', 'hi');
    store.startStreaming(); // streaming assistant - should be excluded
    store.appendToStreaming('partial');

    const msgs = store.getMessages();
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toEqual({ role: 'user', content: 'hello' });
    expect(msgs[1]).toEqual({ role: 'assistant', content: 'hi' });
  });

  it('should be a no-op when appending to streaming with no active stream', () => {
    const store = createMessageStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.appendToStreaming('orphan');
    expect(listener).not.toHaveBeenCalled();
    expect(store.messages).toHaveLength(0);
  });

  it('should be a no-op when completing streaming with no active stream', () => {
    const store = createMessageStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.completeStreaming();
    expect(listener).not.toHaveBeenCalled();
  });
});
