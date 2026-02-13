import { z } from 'zod';
import { EventEmitter } from 'node:events';
import { definePlugin } from '@/domain/index.js';
import type { TaskToolSnapshot } from '@/domain/background-task.js';
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

type BackgroundTaskRecord = TaskToolSnapshot & {
  summary?: string;
  iterations?: number;
  total_time_ms?: number;
};

let runtimeFactory: (() => SessionRuntimeConfig) | null = null;
const backgroundTasks = new Map<string, BackgroundTaskRecord>();
const taskAbortControllers = new Map<string, AbortController>();
let taskCounter = 0;

export const backgroundTaskEvents = new EventEmitter();

export function configureTaskTool(factory: () => SessionRuntimeConfig): void {
  runtimeFactory = factory;
}

export function getBackgroundTask(id: string): BackgroundTaskRecord | undefined {
  return backgroundTasks.get(id);
}

export function getAllBackgroundTasks(): BackgroundTaskRecord[] {
  return [...backgroundTasks.values()];
}

export function cancelBackgroundTask(id: string): boolean {
  const controller = taskAbortControllers.get(id);
  if (!controller) return false;

  controller.abort();
  taskAbortControllers.delete(id);

  const task = backgroundTasks.get(id);
  if (!task || task.status !== 'running') return true;

  const failedTask: BackgroundTaskRecord = {
    ...task,
    status: 'failed',
    error: 'Task cancelled',
    summary: 'Child task failed: Task cancelled',
  };
  backgroundTasks.set(id, failedTask);
  backgroundTaskEvents.emit('task:failed', failedTask);
  return true;
}

function createTaskId(): string {
  taskCounter += 1;
  return `task_${Date.now()}_${taskCounter}`;
}

function createChildRegistry(parent: ToolRegistry): ToolRegistry {
  const child = new ToolRegistry();
  const childPlugins = parent.getAll().filter((plugin) => plugin.id !== 'task' && plugin.id !== 'todo_write');
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

async function runChildTask(
  prompt: string,
  signal: AbortSignal,
  onProgress?: (eventType: string) => void,
): Promise<Omit<BackgroundTaskRecord, 'task_id' | 'description' | 'status' | 'start_time'>> {
  if (!runtimeFactory) throw new Error('Task tool is not configured');

  const childRuntime = createChildRuntime(runtimeFactory());
  let done: { answer: string; iterations: number; totalTime: number; toolCalls: unknown[] } | null = null;

  for await (const event of childRuntime.startRun(prompt, signal)) {
    if (event.type === 'done') {
      done = { answer: event.answer, iterations: event.iterations, totalTime: event.totalTime, toolCalls: event.toolCalls };
    } else {
      onProgress?.(event.type);
    }
  }

  if (!done) throw new Error('Child run completed without a done event');

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
  description: 'Spawn an isolated child agent session for delegated work. Supports blocking and background modes.',
  schema,
  execute: async (raw, ctx) => {
    const args = schema.parse(raw) as TaskArgs;
    if (!runtimeFactory) return 'Error: Task tool is not configured';

    if (args.run_in_background) {
      const taskId = createTaskId();
      const record: BackgroundTaskRecord = {
        task_id: taskId,
        description: args.description,
        status: 'running',
        start_time: Date.now(),
      };

      backgroundTasks.set(taskId, record);
      backgroundTaskEvents.emit('task:started', record);

      const controller = new AbortController();
      taskAbortControllers.set(taskId, controller);
      ctx.signal.addEventListener('abort', () => controller.abort(), { once: true });

      void runChildTask(args.prompt, controller.signal, (eventType) => {
        const currentTask = backgroundTasks.get(taskId);
        if (currentTask) backgroundTaskEvents.emit('task:progress', currentTask, eventType);
      })
        .then((result) => {
          taskAbortControllers.delete(taskId);
          const completedTask: BackgroundTaskRecord = { ...record, status: 'completed', ...result };
          backgroundTasks.set(taskId, completedTask);
          backgroundTaskEvents.emit('task:completed', completedTask);
        })
        .catch((error) => {
          taskAbortControllers.delete(taskId);
          if (backgroundTasks.get(taskId)?.status === 'failed') return;
          const message = error instanceof Error ? error.message : String(error);
          const failedTask: BackgroundTaskRecord = {
            ...record,
            status: 'failed',
            error: message,
            summary: `Child task failed: ${message}`,
          };
          backgroundTasks.set(taskId, failedTask);
          backgroundTaskEvents.emit('task:failed', failedTask);
        });

      return JSON.stringify({ task_id: taskId, status: 'running' });
    }

    try {
      const result = await runChildTask(args.prompt, ctx.signal);
      return JSON.stringify({ status: 'completed', ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ status: 'failed', error: message, summary: `Child task failed: ${message}` });
    }
  },
});
