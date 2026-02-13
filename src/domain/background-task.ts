export type BackgroundTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackgroundTask {
  id: string;
  description: string;
  status: BackgroundTaskStatus;
  startTime: number;
  output?: string;
  error?: string;
}

export interface TaskToolSnapshot {
  task_id: string;
  description: string;
  status: 'running' | 'completed' | 'failed';
  start_time: number;
  answer?: string;
  error?: string;
}

export function fromTaskToolSnapshot(snapshot: TaskToolSnapshot): BackgroundTask {
  return {
    id: snapshot.task_id,
    description: snapshot.description,
    status: snapshot.status,
    startTime: snapshot.start_time,
    output: snapshot.answer,
    error: snapshot.error,
  };
}

export function sortBackgroundTasksByStartTime(tasks: BackgroundTask[]): BackgroundTask[] {
  return [...tasks].sort((a, b) => b.startTime - a.startTime);
}
