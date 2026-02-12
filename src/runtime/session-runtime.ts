import { streamText } from 'ai';
import type { RunEvent, RunResult, TokenUsage, ToolCallRecord, ToolContext } from '@/domain/index.js';
import { ModelBroker } from './model-broker.js';
import { ToolRegistry } from './tool-registry.js';
import { executeToolCall } from './tool-executor.js';
import { PermissionEngine } from './permission-engine.js';
import { HookRunner } from './hook-runner.js';

const CONTEXT_THRESHOLD = 100_000;
const KEEP_TOOL_USES = 5;
const DEFAULT_MAX_ITERATIONS = 10;

interface SessionRuntimeConfig {
  broker: ModelBroker;
  registry: ToolRegistry;
  permissions: PermissionEngine;
  hooks: HookRunner;
  systemPrompt: string;
  maxIterations?: number;
}

type RuntimeMessages = NonNullable<Parameters<typeof streamText>[0]['messages']>;
type IterationToolCall = { toolCallId: string; toolName: string; args: Record<string, unknown> };

const zeroUsage = (): TokenUsage => ({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

function normalizeUsage(usage: unknown): TokenUsage {
  if (!usage || typeof usage !== 'object') return zeroUsage();
  const u = usage as Record<string, unknown>;
  const input = typeof u.inputTokens === 'number' ? u.inputTokens : (typeof u.promptTokens === 'number' ? u.promptTokens : 0);
  const output = typeof u.outputTokens === 'number' ? u.outputTokens : (typeof u.completionTokens === 'number' ? u.completionTokens : 0);
  const total = typeof u.totalTokens === 'number' ? u.totalTokens : input + output;
  return { inputTokens: input, outputTokens: output, totalTokens: total };
}

function mergeUsage(total: TokenUsage, delta: TokenUsage): TokenUsage {
  return {
    inputTokens: total.inputTokens + delta.inputTokens,
    outputTokens: total.outputTokens + delta.outputTokens,
    totalTokens: total.totalTokens + delta.totalTokens,
  };
}

function toToolMessage(call: IterationToolCall, output: string): RuntimeMessages[number] {
  const wrappedOutput = output.startsWith('Error:')
    ? { type: 'error-text' as const, value: output }
    : { type: 'text' as const, value: output };
  return {
    role: 'tool',
    content: [{ type: 'tool-result', toolCallId: call.toolCallId, toolName: call.toolName, input: call.args, output: wrappedOutput }],
  } as unknown as RuntimeMessages[number];
}

function pruneContext(messages: RuntimeMessages): { clearedCount: number; keptCount: number } | null {
  const payload = messages.map((m) => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('');
  if (estimateTokens(payload) <= CONTEXT_THRESHOLD) return null;
  const keepFromEnd = KEEP_TOOL_USES * 2;
  if (messages.length <= 2 + keepFromEnd) return null;
  const before = messages.length;
  const head = messages.slice(0, 2);
  const tail = messages.slice(-keepFromEnd);
  messages.length = 0;
  messages.push(...head, ...tail);
  return { clearedCount: before - messages.length, keptCount: messages.length };
}

export class SessionRuntime {
  private readonly config: SessionRuntimeConfig;
  constructor(config: SessionRuntimeConfig) { this.config = config; }

  async *startRun(input: string, signal?: AbortSignal): AsyncGenerator<RunEvent, RunResult> {
    const startTime = Date.now();
    const maxIterations = this.config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const runtimeSignal = signal ?? new AbortController().signal;
    const toolCalls: ToolCallRecord[] = [];
    let tokenUsage = zeroUsage();
    let answer = '';
    let iterations = 0;

    await this.config.hooks.run('SessionStart', { event: 'SessionStart' });
    const toolCtx: ToolContext = { signal: runtimeSignal, onProgress: () => {}, config: {} };
    const messages: RuntimeMessages = [
      { role: 'system', content: this.config.systemPrompt },
      { role: 'user', content: input },
    ];

    for (let i = 0; i < maxIterations; i++) {
      iterations = i + 1;
      const result = streamText({
        model: this.config.broker.getModel('reason'),
        messages,
        tools: this.config.registry.getForModel(toolCtx),
        abortSignal: runtimeSignal,
      });

      const toolBatch: IterationToolCall[] = [];
      let visibleText = '';
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') visibleText += part.text;
        if (part.type === 'tool-call') toolBatch.push({ toolCallId: part.toolCallId, toolName: part.toolName, args: (part.input ?? {}) as Record<string, unknown> });
      }

      tokenUsage = mergeUsage(tokenUsage, normalizeUsage(await result.usage));
      if (visibleText.trim() && toolBatch.length > 0) yield { type: 'thinking', message: visibleText.trim() };

      if (toolBatch.length === 0) {
        answer = visibleText;
        yield { type: 'answer_start' };
        if (answer) yield { type: 'answer_chunk', content: answer };
        break;
      }

      messages.push({
        role: 'assistant',
        content: toolBatch.map((call) => ({ type: 'tool-call' as const, toolCallId: call.toolCallId, toolName: call.toolName, input: call.args })),
      } as RuntimeMessages[number]);

      for (const call of toolBatch) {
        const decision = this.config.permissions.check(call.toolName);
        if (decision === 'deny') {
          const denied = 'Error: Permission denied';
          yield { type: 'tool_error', toolId: call.toolName, error: denied };
          messages.push(toToolMessage(call, denied));
          continue;
        }

        if (decision === 'ask') {
          yield { type: 'permission_request', toolId: call.toolName, resource: '', rule: { tool: call.toolName, action: 'ask' } };
          yield { type: 'permission_response', toolId: call.toolName, allowed: true };
        }

        const pre = await this.config.hooks.run('PreToolUse', { event: 'PreToolUse', toolId: call.toolName, args: call.args });
        if (pre.allow === false) {
          const blocked = pre.message ? `Error: ${pre.message}` : 'Error: Blocked by hook';
          yield { type: 'tool_error', toolId: call.toolName, error: blocked };
          messages.push(toToolMessage(call, blocked));
          continue;
        }

        yield { type: 'tool_start', toolId: call.toolName, args: call.args };
        const { result: toolResult, duration } = await executeToolCall(this.config.registry, call.toolName, call.args, toolCtx);
        if (toolResult.startsWith('Error:')) yield { type: 'tool_error', toolId: call.toolName, error: toolResult };
        else yield { type: 'tool_end', toolId: call.toolName, result: toolResult, duration };

        toolCalls.push({ toolId: call.toolName, args: call.args, result: toolResult });
        await this.config.hooks.run('PostToolUse', { event: 'PostToolUse', toolId: call.toolName, result: toolResult });
        messages.push(toToolMessage(call, toolResult));
      }

      const pruned = pruneContext(messages);
      if (pruned) yield { type: 'context_cleared', ...pruned };
    }

    await this.config.hooks.run('Stop', { event: 'Stop' });
    const totalTime = Date.now() - startTime;
    yield { type: 'done', answer, toolCalls, iterations, totalTime, tokenUsage };
    return { answer, toolCalls, iterations, totalTime, tokenUsage };
  }
}
