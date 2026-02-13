import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fromTaskToolSnapshot,
  sortBackgroundTasksByStartTime,
  type BackgroundTask,
  type TaskToolSnapshot,
} from '@/domain/background-task.js';
import {
  backgroundTaskEvents,
  cancelBackgroundTask,
  getAllBackgroundTasks,
} from '@/tools/agent/task.tool.js';

const TASK_EVENTS = ['task:started', 'task:progress', 'task:completed', 'task:failed'] as const;

function toTasks(snapshots: TaskToolSnapshot[]): BackgroundTask[] {
  return sortBackgroundTasksByStartTime(snapshots.map(fromTaskToolSnapshot));
}

function upsertTask(tasks: BackgroundTask[], nextTask: BackgroundTask): BackgroundTask[] {
  const withoutTask = tasks.filter((task) => task.id !== nextTask.id);
  return sortBackgroundTasksByStartTime([...withoutTask, nextTask]);
}

export function useBackgroundTasks(): {
  tasks: BackgroundTask[];
  cancelTask: (id: string) => boolean;
  getTaskOutput: (id: string) => string | undefined;
} {
  const [tasks, setTasks] = useState<BackgroundTask[]>(() => toTasks(getAllBackgroundTasks()));

  useEffect(() => {
    setTasks(toTasks(getAllBackgroundTasks()));

    const onTaskEvent = (snapshot: TaskToolSnapshot) => {
      setTasks((prev) => upsertTask(prev, fromTaskToolSnapshot(snapshot)));
    };

    for (const eventName of TASK_EVENTS) {
      backgroundTaskEvents.on(eventName, onTaskEvent);
    }

    return () => {
      for (const eventName of TASK_EVENTS) {
        backgroundTaskEvents.off(eventName, onTaskEvent);
      }
    };
  }, []);

  const outputById = useMemo(() => new Map(tasks.map((task) => [task.id, task.output])), [tasks]);

  const cancelTask = useCallback((id: string) => cancelBackgroundTask(id), []);
  const getTaskOutput = useCallback((id: string) => outputById.get(id), [outputById]);

  return { tasks, cancelTask, getTaskOutput };
}
