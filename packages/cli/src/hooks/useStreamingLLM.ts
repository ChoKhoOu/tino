import { useState, useCallback, useRef } from 'react';
import { streamCompletion, type StreamChunk, type StreamOptions } from '../core/streaming-client.js';
import type { MessageStore } from '../core/message-store.js';

export interface UseStreamingLLMOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  messageStore: MessageStore;
}

export interface UseStreamingLLMReturn {
  isStreaming: boolean;
  sendMessage: (content: string, systemPrompt: string, tools?: StreamOptions['tools'], toolChoice?: StreamOptions['toolChoice']) => Promise<void>;
  cancel: () => void;
  tokenUsage: { input: number; output: number };
}

export function useStreamingLLM(options: UseStreamingLLMOptions): UseStreamingLLMReturn {
  const { apiKey, model, baseUrl, messageStore } = options;
  const [isStreaming, setIsStreaming] = useState(false);
  const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    messageStore.completeStreaming(true);
    setIsStreaming(false);
  }, [messageStore]);

  const sendMessage = useCallback(async (
    content: string,
    systemPrompt: string,
    tools?: StreamOptions['tools'],
    toolChoice?: StreamOptions['toolChoice'],
  ): Promise<void> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    messageStore.addMessage({ role: 'user', content });
    setIsStreaming(true);

    try {
      const stream = streamCompletion({
        apiKey,
        model,
        baseUrl,
        messages: messageStore.getMessages(),
        systemPrompt,
        tools,
        toolChoice,
        signal: controller.signal,
      });

      for await (const chunk of stream) {
        if (controller.signal.aborted) {
          break;
        }
        messageStore.appendChunk(chunk);

        if (chunk.usage) {
          setTokenUsage((prev) => ({
            input: prev.input + (chunk.usage!.input ?? 0),
            output: prev.output + (chunk.usage!.output ?? 0),
          }));
        }
      }

      messageStore.completeStreaming(false);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        messageStore.completeStreaming(true);
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        messageStore.addMessage({
          role: 'system',
          content: `Error: ${errorMessage}`,
        });
        messageStore.completeStreaming(false);
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, [apiKey, model, baseUrl, messageStore]);

  return { isStreaming, sendMessage, cancel, tokenUsage };
}
