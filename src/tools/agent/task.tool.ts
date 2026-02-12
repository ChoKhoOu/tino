import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import type { ModelBroker } from '@/runtime/model-broker.js';
import type { PermissionEngine } from '@/runtime/permission-engine.js';
import type { HookRunner } from '@/runtime/hook-runner.js';
import { SessionRuntime } from '@/runtime/session-runtime.js';
import { ToolRegistry } from '@/runtime/tool-registry.js';

const CHILD_MAX_ITERATIONS = 5;

const schema = z.object({
  description: z.string(),
  prompt: z.string(),
  category: z.string().optional(),
  subagent_type: z.string().optional(),
  load_skills: z.array(z.string()).optional(),
  run_in_background: z.boolean().optional(),
  session_id: z.string().optional(),
});

type TaskArgs = z.infer<typeof schema>;

export interface SessionRuntimeConfig {
  broker: ModelBroker;
  registry: ToolRegistry;
  permissions: PermissionEngine;
  hooks: HookRunner;
  systemPrompt: string;
  maxIterations?: number;
}

type TaskStatus = 'running' | 'completed' | 'failed';

interface BackgroundTask {
  task_id: string;
  description: string;
  status: TaskStatus;
  answer?: string;
  summary?: string;
  iterations?: number;
  total_time_ms?: number;
  error?: string;
}

let runtimeFactory: (() => SessionRuntimeConfig) | null = null;
const backgroundTasks = new Map<string, BackgroundTask>();
let taskCounter = 0;

export function configureTaskTool(factory: () => SessionRuntimeConfig): void {
  runtimeFactory = factory;
}

export function getBackgroundTask(id: string): BackgroundTask | undefined {
  return backgroundTasks.get(id);
}

function createTaskId(): string {
  taskCounter += 1;
  return `task_${Date.now()}_${taskCounter}`;
}

function createChildRegistry(parent: ToolRegistry): ToolRegistry {
  const child = new ToolRegistry();
  const childPlugins = parent
    .getAll()
    .filter((plugin) => plugin.id !== 'task' && plugin.id !== 'todo_write');
  child.registerAll(childPlugins);
  return child;
}

function createChildRuntime(config: SessionRuntimeConfig): SessionRuntime {
  return new SessionRuntime({
    broker: config.broker,
    registry: createChildRegistry(config.registry),
    permissions: config.permissions,
    hooks: config.hooks,
    systemPrompt: config.systemPrompt,
    maxIterations: Math.min(config.maxIterations ?? CHILD_MAX_ITERATIONS, CHILD_MAX_ITERATIONS),
  });
}

async function runChildTask(prompt: string, signal: AbortSignal): Promise<Omit<BackgroundTask, 'task_id' | 'description' | 'status'>> {
  if (!runtimeFactory) {
    throw new Error('Task tool is not configured');
  }

  const childRuntime = createChildRuntime(runtimeFactory());
  let done:
    | {
      answer: string;
      iterations: number;
      totalTime: number;
      toolCalls: unknown[];
    }
    | null = null;

  for await (const event of childRuntime.startRun(prompt, signal)) {
    if (event.type === 'done') {
      done = {
        answer: event.answer,
        iterations: event.iterations,
        totalTime: event.totalTime,
        toolCalls: event.toolCalls,
      };
    }
  }

  if (!done) {
    throw new Error('Child run completed without a done event');
  }

  return {
    answer: done.answer,
    iterations: done.iterations,
    total_time_ms: done.totalTime,
    summary: `Child task completed in ${done.iterations} iterations with ${done.toolCalls.length} tool calls.`,
  };
}

export default definePlugin({
  id: 'task',
  domain: 'agent',
  riskLevel: 'moderate',
  description:
    'Spawn an isolated child agent session for delegated work. Supports blocking and background modes.',
  schema,
  execute: async (raw, ctx) => {
    const args = schema.parse(raw) as TaskArgs;

    if (!runtimeFactory) {
      return 'Error: Task tool is not configured';
    }

    if (args.run_in_background) {
      const taskId = createTaskId();
      const record: BackgroundTask = {
        task_id: taskId,
        description: args.description,
        status: 'running',
      };
      backgroundTasks.set(taskId, record);

      void runChildTask(args.prompt, ctx.signal)
        .then((result) => {
          backgroundTasks.set(taskId, {
            ...record,
            status: 'completed',
            ...result,
          });
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          backgroundTasks.set(taskId, {
            ...record,
            status: 'failed',
            error: message,
            summary: `Child task failed: ${message}`,
          });
        });

      return JSON.stringify({ task_id: taskId, status: 'running' });
    }

    try {
      const result = await runChildTask(args.prompt, ctx.signal);
      return JSON.stringify({
        status: 'completed',
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        status: 'failed',
        error: message,
        summary: `Child task failed: ${message}`,
      });
    }
  },
});
