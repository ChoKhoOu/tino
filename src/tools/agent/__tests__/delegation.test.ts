import { beforeEach, describe, expect, test, mock } from 'bun:test';
import { z } from 'zod';
import type { ToolContext, ToolPlugin } from '@/domain/index.js';
import type { DiscoveredAgentConfig } from '@/agents/types.js';
import { ToolRegistry } from '@/runtime/tool-registry.js';

type MockRunConfig = {
  answer: string;
  iterations: number;
  totalTime: number;
  nestedDelegations?: number;
};

const createdRuntimeConfigs: Array<Record<string, unknown>> = [];
let runConfig: MockRunConfig;
let discoveredAgents: DiscoveredAgentConfig[] = [];
let nestedExecute: ((args: Record<string, unknown>) => Promise<string>) | null = null;

class MockSessionRuntime {
  constructor(config: Record<string, unknown>) {
    createdRuntimeConfigs.push(config);
  }

  async *startRun(): AsyncGenerator<Record<string, unknown>, Record<string, unknown>> {
    if (runConfig.nestedDelegations && runConfig.nestedDelegations > 0 && nestedExecute) {
      runConfig.nestedDelegations -= 1;
      const nestedRaw = await nestedExecute({
        description: 'nested',
        prompt: 'nested',
        agent: 'delegate-agent',
      });
      const nested = JSON.parse(nestedRaw);
      if (nested.status === 'failed') {
        throw new Error(nested.error ?? 'nested failed');
      }
    }

    yield { type: 'tool_start', toolId: 'web_search', args: {} };
    const doneEvent = {
      type: 'done',
      answer: runConfig.answer,
      iterations: runConfig.iterations,
      totalTime: runConfig.totalTime,
      toolCalls: [{ toolId: 'web_search' }],
    };
    yield doneEvent;
    return doneEvent;
  }
}

mock.module('@/runtime/session-runtime.js', () => ({ SessionRuntime: MockSessionRuntime }));
mock.module('@/agents/registry.js', () => ({ discoverAgentConfigs: () => discoveredAgents }));

const ctx: ToolContext = {
  signal: new AbortController().signal,
  onProgress: () => {},
  config: {},
};

function createPlugin(id: string): ToolPlugin {
  return {
    id,
    domain: 'test',
    riskLevel: 'safe',
    description: `tool ${id}`,
    schema: z.object({}),
    execute: async () => 'ok',
  };
}

function createFactory(toolIds: string[], modelTag = 'parent-model') {
  return () => {
    const registry = new ToolRegistry();
    registry.registerAll(toolIds.map(createPlugin));
    const broker = {
      currentModel: modelTag,
      setModel(model: string) {
        this.currentModel = model;
      },
      getModel(purpose: string) {
        return `${this.currentModel}:${purpose}`;
      },
    };
    return {
      broker: broker as never,
      registry,
      permissions: {} as never,
      hooks: {} as never,
      systemPrompt: 'parent-system-prompt',
    };
  };
}

async function loadTaskTool() {
  return import(`../task.tool.js?test=${Math.random().toString(36).slice(2)}`);
}

beforeEach(() => {
  createdRuntimeConfigs.length = 0;
  discoveredAgents = [];
  nestedExecute = null;
  runConfig = { answer: 'child answer', iterations: 2, totalTime: 24 };
});

describe('task delegation routing', () => {
  test('delegated agent sets child systemPrompt, model, allowedTools, and result identity', async () => {
    discoveredAgents = [{
      name: 'delegate-agent',
      description: 'delegation specialist',
      systemPrompt: 'delegate-system-prompt',
      allowedTools: ['web_search', 'task'],
      model: 'delegate-model',
      path: '/tmp/delegate-agent.md',
      source: 'project',
    }];

    const mod = await loadTaskTool();
    mod.configureTaskTool(createFactory(['task', 'web_search', 'market_data']));

    const raw = await mod.default.execute({
      description: 'delegate work',
      prompt: 'do delegated work',
      agent: 'delegate-agent',
    }, ctx);

    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('completed');
    expect(parsed.agent).toBe('delegate-agent');

    const childConfig = createdRuntimeConfigs[0] as { systemPrompt: string; broker: { getModel: (purpose: string) => string }; registry: ToolRegistry };
    expect(childConfig.systemPrompt).toBe('delegate-system-prompt');
    expect(childConfig.broker.getModel('reason')).toBe('delegate-model:reason');
    expect(childConfig.registry.getAll().map((tool) => tool.id).sort()).toEqual(['task', 'web_search']);
  });

  test('returns failed status when delegated agent is not found', async () => {
    const mod = await loadTaskTool();
    mod.configureTaskTool(createFactory(['task', 'web_search']));

    const raw = await mod.default.execute({
      description: 'delegate work',
      prompt: 'do delegated work',
      agent: 'missing-agent',
    }, ctx);

    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('failed');
    expect(parsed.error).toContain('Agent not found');
  });

  test('fails gracefully when delegated recursion exceeds depth 3', async () => {
    discoveredAgents = [{
      name: 'delegate-agent',
      description: 'delegation specialist',
      systemPrompt: 'delegate-system-prompt',
      allowedTools: ['task', 'web_search'],
      model: 'delegate-model',
      path: '/tmp/delegate-agent.md',
      source: 'project',
    }];

    runConfig.nestedDelegations = 4;
    const mod = await loadTaskTool();
    mod.configureTaskTool(createFactory(['task', 'web_search']));
    nestedExecute = (args) => mod.default.execute(args, ctx);

    const raw = await mod.default.execute({
      description: 'delegate work',
      prompt: 'do delegated work',
      agent: 'delegate-agent',
    }, ctx);

    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('failed');
    expect(parsed.error).toContain('Max delegation depth');
  });
});
