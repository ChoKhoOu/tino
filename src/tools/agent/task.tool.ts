import { z } from 'zod';
import { EventEmitter } from 'node:events';
import { definePlugin } from '@/domain/index.js';
import type { TaskToolSnapshot } from '@/domain/background-task.js';
import { resolveDelegatedAgent, runChildTask } from './task-delegation.js';
import type { SessionRuntimeConfig } from './task-delegation.js';

const CHILD_MAX_ITERATIONS = 5;
const schema = z.object({
  description: z.string(),
  prompt: z.string(),
  agent: z.string().optional(),
  category: z.string().optional(),
  subagent_type: z.string().optional(),
  load_skills: z.array(z.string()).optional(),
  run_in_background: z.boolean().optional(),
  session_id: z.string().optional(),
});

type TaskArgs = z.infer<typeof schema>;

type BackgroundTaskRecord = TaskToolSnapshot & {
  agent?: string;
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

export default definePlugin({
  id: 'task',
  domain: 'agent',
  riskLevel: 'moderate',
  description: 'Spawn an isolated child agent session for delegated work. Supports blocking and background modes.',
  schema,
  execute: async (raw, ctx) => {
    const args = schema.parse(raw) as TaskArgs;
    if (!runtimeFactory) return 'Error: Task tool is not configured';

    let delegatedAgent: ReturnType<typeof resolveDelegatedAgent>;
    try {
      delegatedAgent = resolveDelegatedAgent(args.agent);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ status: 'failed', error: message, agent: args.agent, summary: `Child task failed: ${message}` });
    }

    if (args.run_in_background) {
      const taskId = createTaskId();
      const record: BackgroundTaskRecord = {
        task_id: taskId,
        description: args.description,
        agent: delegatedAgent?.name,
        status: 'running',
        start_time: Date.now(),
      };

      backgroundTasks.set(taskId, record);
      backgroundTaskEvents.emit('task:started', record);

      const controller = new AbortController();
      taskAbortControllers.set(taskId, controller);
      ctx.signal.addEventListener('abort', () => controller.abort(), { once: true });

      void runChildTask({
        runtimeFactory,
        prompt: args.prompt,
        signal: controller.signal,
        delegatedAgent,
        childMaxIterations: CHILD_MAX_ITERATIONS,
        onProgress: (eventType) => {
          const currentTask = backgroundTasks.get(taskId);
          if (currentTask) backgroundTaskEvents.emit('task:progress', currentTask, eventType);
        },
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
      const result = await runChildTask({
        runtimeFactory,
        prompt: args.prompt,
        signal: ctx.signal,
        delegatedAgent,
        childMaxIterations: CHILD_MAX_ITERATIONS,
      });
      return JSON.stringify({ status: 'completed', ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ status: 'failed', error: message, agent: delegatedAgent?.name, summary: `Child task failed: ${message}` });
    }
  },
});
