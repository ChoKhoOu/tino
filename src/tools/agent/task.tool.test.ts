import { beforeEach, describe, expect, test, mock } from 'bun:test';
import { z } from 'zod';
import type { ToolContext, ToolPlugin } from '@/domain/index.js';
import { ToolRegistry } from '@/runtime/tool-registry.js';

type MockRunConfig = {
  answer: string;
  iterations: number;
  totalTime: number;
  delayMs?: number;
  error?: string;
};

const createdRuntimeConfigs: Array<Record<string, unknown>> = [];
let runConfig: MockRunConfig;

class MockSessionRuntime {
  constructor(config: Record<string, unknown>) {
    createdRuntimeConfigs.push(config);
  }

  async *startRun(): AsyncGenerator<Record<string, unknown>, Record<string, unknown>> {
    if (runConfig.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, runConfig.delayMs));
    }
    if (runConfig.error) {
      throw new Error(runConfig.error);
    }

    const doneEvent = {
      type: 'done',
      answer: runConfig.answer,
      iterations: runConfig.iterations,
      totalTime: runConfig.totalTime,
      toolCalls: [],
    };
    yield doneEvent;
    return doneEvent;
  }
}

mock.module('@/runtime/session-runtime.js', () => ({ SessionRuntime: MockSessionRuntime }));

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

function createFactory(toolIds: string[]) {
  return () => {
    const registry = new ToolRegistry();
    registry.registerAll(toolIds.map(createPlugin));
    return {
      broker: {} as never,
      registry,
      permissions: {} as never,
      hooks: {} as never,
      systemPrompt: 'child-system-prompt',
    };
  };
}

async function loadTaskTool() {
  return import(`./task.tool.js?test=${Math.random().toString(36).slice(2)}`);
}

beforeEach(() => {
  createdRuntimeConfigs.length = 0;
  runConfig = { answer: 'child answer', iterations: 2, totalTime: 24 };
});

describe('task tool', () => {
  test('sync mode waits for completion and returns a summary', async () => {
    const mod = await loadTaskTool();
    mod.configureTaskTool(createFactory(['task', 'todo_write', 'web_search']));

    const raw = await mod.default.execute({
      description: 'Run a child agent',
      prompt: 'Find market-moving news',
    }, ctx);

    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('completed');
    expect(parsed.answer).toBe('child answer');
    expect(parsed.iterations).toBe(2);
    expect(parsed.total_time_ms).toBe(24);
    expect(parsed.summary).toContain('2 iterations');
  });

  test('background mode returns task_id immediately and stores completion result', async () => {
    runConfig.delayMs = 40;
    const mod = await loadTaskTool();
    mod.configureTaskTool(createFactory(['web_search']));

    const raw = await mod.default.execute({
      description: 'Run in background',
      prompt: 'Summarize macro updates',
      run_in_background: true,
    }, ctx);

    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('running');
    expect(typeof parsed.task_id).toBe('string');

    const runningTask = mod.getBackgroundTask(parsed.task_id);
    expect(runningTask?.status).toBe('running');

    await new Promise((resolve) => setTimeout(resolve, 60));
    const finishedTask = mod.getBackgroundTask(parsed.task_id);
    expect(finishedTask?.status).toBe('completed');
    expect(finishedTask?.answer).toBe('child answer');
  });

  test('child registry removes task tool to enforce max depth 1', async () => {
    const mod = await loadTaskTool();
    mod.configureTaskTool(createFactory(['task', 'web_search']));

    await mod.default.execute({ description: 'Depth test', prompt: 'Do work' }, ctx);

    const childRegistry = createdRuntimeConfigs[0]?.registry as ToolRegistry;
    const childIds = childRegistry.getAll().map((tool) => tool.id);
    expect(childIds).not.toContain('task');
    expect(childIds).toContain('web_search');
  });

  test('child registry removes todo_write tool', async () => {
    const mod = await loadTaskTool();
    mod.configureTaskTool(createFactory(['todo_write', 'web_search']));

    await mod.default.execute({ description: 'Todo restriction', prompt: 'Do work' }, ctx);

    const childRegistry = createdRuntimeConfigs[0]?.registry as ToolRegistry;
    const childIds = childRegistry.getAll().map((tool) => tool.id);
    expect(childIds).not.toContain('todo_write');
    expect(childIds).toContain('web_search');
  });

  test('schema validation enforces required and optional fields', async () => {
    const mod = await loadTaskTool();

    expect(() => mod.default.schema.parse({
      description: 'Delegate a coding task',
      prompt: 'Refactor data cache',
      category: 'quick',
      subagent_type: 'explore',
      load_skills: ['git-master'],
      run_in_background: true,
      session_id: 'ses_123',
    })).not.toThrow();

    expect(() => mod.default.schema.parse({ prompt: 'missing description' })).toThrow();
    expect(() => mod.default.schema.parse({ description: 'x', prompt: 'y', load_skills: [123] })).toThrow();
  });
});
