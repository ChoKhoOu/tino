import { AsyncLocalStorage } from 'node:async_hooks';
import { discoverAgentConfigs } from '@/agents/registry.js';
import { toAgentDefinition } from '@/agents/types.js';
import type { AgentDefinition } from '@/domain/agent-def.js';
import type { ModelBroker } from '@/runtime/model-broker.js';
import type { PermissionEngine } from '@/runtime/permission-engine.js';
import type { HookRunner } from '@/runtime/hook-runner.js';
import { SessionRuntime } from '@/runtime/session-runtime.js';
import { ToolRegistry } from '@/runtime/tool-registry.js';

const MAX_DELEGATION_DEPTH = 3;
const delegationDepthStorage = new AsyncLocalStorage<number>();

export interface SessionRuntimeConfig {
  broker: ModelBroker;
  registry: ToolRegistry;
  permissions: PermissionEngine;
  hooks: HookRunner;
  systemPrompt: string;
  maxIterations?: number;
}

export type ChildTaskResult = {
  answer: string;
  agent?: string;
  iterations: number;
  total_time_ms: number;
  summary: string;
};

export type RunChildTaskOptions = {
  runtimeFactory: () => SessionRuntimeConfig;
  prompt: string;
  signal: AbortSignal;
  onProgress?: (eventType: string) => void;
  delegatedAgent?: AgentDefinition;
  childMaxIterations: number;
};

function createChildRegistry(parent: ToolRegistry, delegatedAgent?: AgentDefinition): ToolRegistry {
  const child = new ToolRegistry();
  const allowed = delegatedAgent?.tools ? new Set(delegatedAgent.tools) : null;
  const currentDepth = delegationDepthStorage.getStore() ?? 0;
  const allowTask = Boolean(delegatedAgent && currentDepth < MAX_DELEGATION_DEPTH);
  const childPlugins = parent.getAll().filter((plugin) => {
    if (plugin.id === 'todo_write') return false;
    if (plugin.id === 'task' && !allowTask) return false;
    return allowed ? allowed.has(plugin.id) : true;
  });
  child.registerAll(childPlugins);
  return child;
}

function createBrokerWithDelegatedModel(broker: ModelBroker, delegatedModel?: string): ModelBroker {
  if (!delegatedModel) return broker;
  const clone = Object.assign(Object.create(Object.getPrototypeOf(broker)), broker) as ModelBroker & { setModel?: (model: string) => void };
  clone.setModel?.(delegatedModel);
  return clone as ModelBroker;
}

function createChildRuntime(
  config: SessionRuntimeConfig,
  delegatedAgent: AgentDefinition | undefined,
  childMaxIterations: number,
): SessionRuntime {
  return new SessionRuntime({
    broker: createBrokerWithDelegatedModel(config.broker, delegatedAgent?.model),
    registry: createChildRegistry(config.registry, delegatedAgent),
    permissions: config.permissions,
    hooks: config.hooks,
    systemPrompt: delegatedAgent?.systemPrompt ?? config.systemPrompt,
    maxIterations: Math.min(config.maxIterations ?? childMaxIterations, childMaxIterations),
  });
}

export function resolveDelegatedAgent(agentId?: string): AgentDefinition | undefined {
  if (!agentId) return undefined;
  const config = discoverAgentConfigs().find((item) => item.name === agentId);
  if (!config) throw new Error(`Agent not found: ${agentId}`);
  return toAgentDefinition(config);
}

export async function runChildTask(options: RunChildTaskOptions): Promise<ChildTaskResult> {
  const currentDepth = delegationDepthStorage.getStore() ?? 0;
  if (options.delegatedAgent && currentDepth >= MAX_DELEGATION_DEPTH) {
    throw new Error(`Max delegation depth ${MAX_DELEGATION_DEPTH} exceeded`);
  }

  const childRuntime = createChildRuntime(
    options.runtimeFactory(),
    options.delegatedAgent,
    options.childMaxIterations,
  );
  const done = await delegationDepthStorage.run(currentDepth + 1, async () => {
    let completed: { answer: string; iterations: number; totalTime: number; toolCalls: unknown[] } | null = null;
    for await (const event of childRuntime.startRun(options.prompt, options.signal)) {
      if (event.type === 'done') completed = event;
      else options.onProgress?.(event.type);
    }
    return completed;
  });

  if (!done) throw new Error('Child run completed without a done event');
  const taskLabel = options.delegatedAgent?.name ? `Child task (${options.delegatedAgent.name})` : 'Child task';
  return {
    answer: done.answer,
    agent: options.delegatedAgent?.name,
    iterations: done.iterations,
    total_time_ms: done.totalTime,
    summary: `${taskLabel} completed in ${done.iterations} iterations with ${done.toolCalls.length} tool calls.`,
  };
}
