import { streamText } from 'ai';
import type { RunEvent, RunResult, TokenUsage, ToolCallRecord, ToolContext, GrpcClients } from '@/domain/index.js';
import { pruneContext } from './context-pruner.js';
import type { Session } from '@/session/session.js';
import { ModelBroker } from './model-broker.js';
import { ToolRegistry } from './tool-registry.js';
import { executeToolCall } from './tool-executor.js';
import { PermissionEngine } from './permission-engine.js';
import { HookRunner } from './hook-runner.js';
import { zeroUsage, normalizeUsage, mergeUsage } from './token-usage-helpers.js';
import type { RiskEngine, PreTradeResult } from '@/risk/risk-engine.js';

const DEFAULT_MAX_ITERATIONS = 10;

export type PreToolCheck = (toolId: string, args: Record<string, unknown>) => PreTradeResult;

interface SessionRuntimeConfig {
  broker: ModelBroker;
  registry: ToolRegistry;
  permissions: PermissionEngine;
  hooks: HookRunner;
  systemPrompt: string;
  maxIterations?: number;
  grpc?: GrpcClients;
  preToolCheck?: PreToolCheck;
}

type RuntimeMessages = NonNullable<Parameters<typeof streamText>[0]['messages']>;
type IterationToolCall = { toolCallId: string; toolName: string; args: Record<string, unknown> };

function toToolMessage(call: IterationToolCall, output: string): RuntimeMessages[number] {
  const wrappedOutput = output.startsWith('Error:')
    ? { type: 'error-text' as const, value: output }
    : { type: 'text' as const, value: output };
  return {
    role: 'tool',
    content: [{ type: 'tool-result', toolCallId: call.toolCallId, toolName: call.toolName, input: call.args, output: wrappedOutput }],
  } as unknown as RuntimeMessages[number];
}

export class SessionRuntime {
  private readonly config: SessionRuntimeConfig;
  private messages: RuntimeMessages = [];
  private initialized = false;
  private permissionResolver: ((response: { allowed: boolean; alwaysAllow?: boolean }) => void) | null = null;
  private alwaysAllowCache = new Map<string, boolean>();

  constructor(config: SessionRuntimeConfig) { this.config = config; }

  clearHistory(): void {
    this.messages = [];
    this.initialized = false;
    this.alwaysAllowCache.clear();
  }

  loadFromSession(session: Session): { messageCount: number } {
    this.messages = [];
    this.initialized = false;
    this.alwaysAllowCache.clear();

    for (const msg of session.messages) {
      this.messages.push({ role: msg.role, content: msg.content } as RuntimeMessages[number]);
    }

    if (this.messages.length > 0) {
      this.initialized = true;
    }

    return { messageCount: this.messages.length };
  }

  respondToPermission(toolId: string, allowed: boolean, alwaysAllow?: boolean): void {
    if (alwaysAllow && allowed) {
      this.alwaysAllowCache.set(toolId, true);
    }
    this.permissionResolver?.({ allowed, alwaysAllow });
    this.permissionResolver = null;
  }

  async *startRun(input: string, signal?: AbortSignal): AsyncGenerator<RunEvent, RunResult> {
    const startTime = Date.now();
    const maxIterations = this.config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const runtimeSignal = signal ?? new AbortController().signal;
    const toolCalls: ToolCallRecord[] = [];
    let tokenUsage = zeroUsage();
    let answer = '';
    let iterations = 0;

    await this.config.hooks.run('SessionStart', { event: 'SessionStart' });
    const toolCtx: ToolContext = { signal: runtimeSignal, onProgress: () => {}, config: {}, grpc: this.config.grpc };
    if (!this.initialized) {
      this.messages.push({ role: 'system', content: this.config.systemPrompt });
      this.initialized = true;
    }
    this.messages.push({ role: 'user', content: input });

    for (let i = 0; i < maxIterations; i++) {
      iterations = i + 1;
      const result = streamText({
        model: this.config.broker.getModel('reason'),
        messages: this.messages,
        tools: this.config.registry.getForModel(toolCtx),
        abortSignal: runtimeSignal,
      });

      const toolBatch: IterationToolCall[] = [];
      let visibleText = '';
      const textDeltas: string[] = [];
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          visibleText += part.text;
          textDeltas.push(part.text);
        }
        if (part.type === 'tool-call') toolBatch.push({ toolCallId: part.toolCallId, toolName: part.toolName, args: (part.input ?? {}) as Record<string, unknown> });
      }

      tokenUsage = mergeUsage(tokenUsage, normalizeUsage(await result.usage));
      if (visibleText.trim() && toolBatch.length > 0) yield { type: 'thinking', message: visibleText.trim() };

      if (toolBatch.length === 0) {
        answer = visibleText;
        if (answer.trim()) {
          this.messages.push({ role: 'assistant', content: answer });
        }
        yield { type: 'answer_start' };
        for (const delta of textDeltas) {
          yield { type: 'answer_delta', delta };
        }
        break;
      }

      this.messages.push({
        role: 'assistant',
        content: toolBatch.map((call) => ({ type: 'tool-call' as const, toolCallId: call.toolCallId, toolName: call.toolName, input: call.args })),
      } as RuntimeMessages[number]);

      for (const call of toolBatch) {
        const decision = this.config.permissions.check(call.toolName);
        if (decision === 'deny') {
          const denied = 'Error: Permission denied';
          yield { type: 'tool_error', toolId: call.toolName, error: denied };
          this.messages.push(toToolMessage(call, denied));
          continue;
        }

        if (decision === 'ask') {
          if (!this.alwaysAllowCache.get(call.toolName)) {
            yield { type: 'permission_request', toolId: call.toolName, resource: '', rule: { tool: call.toolName, action: 'ask' }, args: call.args };
            const response = await new Promise<{ allowed: boolean; alwaysAllow?: boolean }>((resolve) => {
              this.permissionResolver = resolve;
            });
            if (!response.allowed) {
              const denied = 'Error: Permission denied by user';
              yield { type: 'tool_error', toolId: call.toolName, error: denied };
              this.messages.push(toToolMessage(call, denied));
              continue;
            }
          }
        }

        const pre = await this.config.hooks.run('PreToolUse', { event: 'PreToolUse', toolId: call.toolName, args: call.args });
        if (pre.allow === false) {
          const blocked = pre.message ? `Error: ${pre.message}` : 'Error: Blocked by hook';
          yield { type: 'tool_error', toolId: call.toolName, error: blocked };
          this.messages.push(toToolMessage(call, blocked));
          continue;
        }

        if (this.config.preToolCheck) {
          const riskResult = this.config.preToolCheck(call.toolName, call.args);
          if (!riskResult.allowed) {
            const refused = `Error: Risk check failed — ${riskResult.reason}`;
            yield { type: 'tool_error', toolId: call.toolName, error: refused };
            this.messages.push(toToolMessage(call, refused));
            continue;
          }
        }

        yield { type: 'tool_start', toolId: call.toolName, args: call.args };
        const { result: toolResult, duration } = await executeToolCall(this.config.registry, call.toolName, call.args, toolCtx);
        if (toolResult.startsWith('Error:')) yield { type: 'tool_error', toolId: call.toolName, error: toolResult };
        else yield { type: 'tool_end', toolId: call.toolName, result: toolResult, duration };

        toolCalls.push({ toolId: call.toolName, args: call.args, result: toolResult });
        await this.config.hooks.run('PostToolUse', { event: 'PostToolUse', toolId: call.toolName, result: toolResult });
        this.messages.push(toToolMessage(call, toolResult));
      }

      const pruned = await pruneContext(this.messages, this.config.broker);
      if (pruned) yield { type: 'context_cleared', ...pruned };
    }

    await this.config.hooks.run('Stop', { event: 'Stop' });
    const totalTime = Date.now() - startTime;
    yield { type: 'done', answer, toolCalls, iterations, totalTime, tokenUsage };
    return { answer, toolCalls, iterations, totalTime, tokenUsage };
  }
}
