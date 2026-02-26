/**
 * Pub/sub message store for conversation messages.
 * Zustand-like API without the dependency.
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface MessageStore {
  messages: ChatMessage[];
  streamingMessageId: string | null;
  addMessage(role: MessageRole, content: string): string;
  addMessage(msg: { role: MessageRole; content: string }): string;
  startStreaming(): string;
  appendToStreaming(chunk: string): void;
  appendChunk(chunk: { type: string; text?: string }): void;
  completeStreaming(cancelled?: boolean): void;
  getCompleted(): ChatMessage[];
  getMessages(): Array<{ role: 'user' | 'assistant'; content: string }>;
  getStreamingMessage(): ChatMessage | null;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

export function createMessageStore(): MessageStore {
  let nextId = 1;
  function generateId(): string {
    return `msg-${nextId++}`;
  }

  let version = 0;

  let cachedCompleted: ChatMessage[] = [];
  let cachedCompletedVersion = -1;

  let cachedStreaming: ChatMessage | null = null;
  let cachedStreamingVersion = -1;

  const listeners = new Set<() => void>();
  let notifyTimer: ReturnType<typeof setTimeout> | null = null;
  const FRAME_INTERVAL = 33; // ~30fps

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function throttledNotify(): void {
    if (notifyTimer !== null) return; // already scheduled
    notifyTimer = setTimeout(() => {
      notifyTimer = null;
      notify();
    }, FRAME_INTERVAL);
  }

  function flushNotify(): void {
    if (notifyTimer !== null) {
      clearTimeout(notifyTimer);
      notifyTimer = null;
    }
    notify();
  }

  const store: MessageStore = {
    messages: [],
    streamingMessageId: null,

    addMessage(roleOrMsg: MessageRole | { role: MessageRole; content: string }, content?: string): string {
      let role: MessageRole;
      let text: string;
      if (typeof roleOrMsg === 'object') {
        role = roleOrMsg.role;
        text = roleOrMsg.content;
      } else {
        role = roleOrMsg;
        text = content ?? '';
      }
      const id = generateId();
      const message: ChatMessage = {
        id,
        role,
        content: text,
        timestamp: new Date(),
      };
      store.messages = [...store.messages, message];
      version++;
      notify();
      return id;
    },

    startStreaming(): string {
      const id = generateId();
      const message: ChatMessage = {
        id,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      store.messages = [...store.messages, message];
      store.streamingMessageId = id;
      version++;
      notify();
      return id;
    },

    appendToStreaming(chunk: string): void {
      if (store.streamingMessageId === null) return;
      const targetId = store.streamingMessageId;
      store.messages = store.messages.map((msg) =>
        msg.id === targetId
          ? { ...msg, content: msg.content + chunk }
          : msg,
      );
      version++;
      throttledNotify();
    },

    appendChunk(chunk: { type: string; text?: string }): void {
      if (chunk.type === 'text_delta' && chunk.text) {
        if (store.streamingMessageId === null) {
          store.startStreaming();
        }
        store.appendToStreaming(chunk.text);
      }
    },

    completeStreaming(cancelled?: boolean): void {
      if (store.streamingMessageId === null) return;
      const targetId = store.streamingMessageId;
      store.messages = store.messages.map((msg) =>
        msg.id === targetId
          ? {
              ...msg,
              isStreaming: false,
              content: cancelled ? msg.content + ' [cancelled]' : msg.content,
            }
          : msg,
      );
      store.streamingMessageId = null;
      version++;
      flushNotify();
    },

    getCompleted(): ChatMessage[] {
      if (cachedCompletedVersion !== version) {
        cachedCompleted = store.messages.filter((msg) => msg.isStreaming !== true);
        cachedCompletedVersion = version;
      }
      return cachedCompleted;
    },

    getMessages(): Array<{ role: 'user' | 'assistant'; content: string }> {
      return store.messages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .filter((msg) => msg.isStreaming !== true)
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));
    },

    getStreamingMessage(): ChatMessage | null {
      if (cachedStreamingVersion !== version) {
        cachedStreaming = store.messages.find((msg) => msg.id === store.streamingMessageId) ?? null;
        cachedStreamingVersion = version;
      }
      return cachedStreaming;
    },

    reset(): void {
      store.messages = [];
      store.streamingMessageId = null;
      version++;
      flushNotify();
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return store;
}
