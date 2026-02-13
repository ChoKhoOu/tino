import { useEffect } from 'react';
import taskTool from '@/tools/agent/task.tool.js';
import type { KeyboardDispatcher } from '@/keyboard/dispatcher.js';
import type { RunEvent } from '@/domain/events.js';
import type { RunStatus } from '@/hooks/useSessionRunner.js';

export const NO_ACTIVE_TASK_MESSAGE = 'No active task to background';

const BACKGROUND_ERROR_PREFIX = 'Failed to background task:';

interface BackgroundableRunState {
  status: RunStatus;
  events: RunEvent[];
}

interface BackgroundTaskControlOptions {
  runState: BackgroundableRunState;
  currentQuery: string | null;
  cancelForegroundRun: () => void;
  setNotice: (message: string) => void;
}

function isToolFinished(event: RunEvent): event is Extract<RunEvent, { type: 'tool_end' | 'tool_error' }> {
  return event.type === 'tool_end' || event.type === 'tool_error';
}

export function findRunningToolId(events: RunEvent[]): string | null {
  let activeToolId: string | null = null;

  for (const event of events) {
    if (event.type === 'tool_start') {
      activeToolId = event.toolId;
      continue;
    }

    if (isToolFinished(event) && activeToolId === event.toolId) {
      activeToolId = null;
    }
  }

  return activeToolId;
}

export function isBackgroundableRun(runState: BackgroundableRunState): boolean {
  return runState.status === 'running' && findRunningToolId(runState.events) !== null;
}

function parseBackgroundTaskId(rawResult: string): string | null {
  try {
    const parsed = JSON.parse(rawResult) as { task_id?: unknown; error?: unknown };
    if (typeof parsed.error === 'string' && parsed.error.length > 0) return null;
    return typeof parsed.task_id === 'string' ? parsed.task_id : null;
  } catch {
    return null;
  }
}

async function launchBackgroundTask(query: string, runningToolId: string | null): Promise<{ taskId: string | null; error: string | null }> {
  try {
    const description = runningToolId
      ? `Continue in background: ${runningToolId}`
      : 'Continue current operation in background';
    const result = await taskTool.execute(
      {
        description,
        prompt: query,
        run_in_background: true,
      },
      {
        signal: new AbortController().signal,
        onProgress: () => undefined,
        config: {},
      },
    );
    return { taskId: parseBackgroundTaskId(result), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { taskId: null, error: message };
  }
}

export function registerBackgroundTaskControl(
  dispatcher: KeyboardDispatcher,
  options: BackgroundTaskControlOptions,
): () => void {
  return dispatcher.register('normal', 'ctrl+b', () => {
    const query = options.currentQuery?.trim() ?? '';
    if (!query || !isBackgroundableRun(options.runState)) {
      options.setNotice(NO_ACTIVE_TASK_MESSAGE);
      return true;
    }

    const runningToolId = findRunningToolId(options.runState.events);
    void launchBackgroundTask(query, runningToolId).then(({ taskId, error }) => {
      if (error) {
        options.setNotice(`${BACKGROUND_ERROR_PREFIX} ${error}`);
        return;
      }
      options.cancelForegroundRun();
      options.setNotice(taskId ? `Backgrounded task ${taskId}` : 'Backgrounded current operation');
    });

    return true;
  });
}

export function useBackgroundTaskControl(
  dispatcher: KeyboardDispatcher,
  options: BackgroundTaskControlOptions,
): void {
  useEffect(() => registerBackgroundTaskControl(dispatcher, options), [dispatcher, options]);
}
