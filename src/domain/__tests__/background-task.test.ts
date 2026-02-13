import { describe, expect, test } from 'bun:test';
import {
  fromTaskToolSnapshot,
  sortBackgroundTasksByStartTime,
  type TaskToolSnapshot,
} from '../background-task.js';

describe('fromTaskToolSnapshot', () => {
  test('maps task tool snapshot to UI background task shape', () => {
    const snapshot: TaskToolSnapshot = {
      task_id: 'task_1',
      description: 'Analyze earnings impact',
      status: 'completed',
      start_time: 1700000000000,
      answer: 'Earnings beat by 8%',
    };

    expect(fromTaskToolSnapshot(snapshot)).toEqual({
      id: 'task_1',
      description: 'Analyze earnings impact',
      status: 'completed',
      startTime: 1700000000000,
      output: 'Earnings beat by 8%',
    });
  });

  test('preserves failure error message', () => {
    const snapshot: TaskToolSnapshot = {
      task_id: 'task_2',
      description: 'Fetch macro data',
      status: 'failed',
      start_time: 1700000000100,
      error: 'timeout',
    };

    expect(fromTaskToolSnapshot(snapshot).error).toBe('timeout');
  });
});

describe('sortBackgroundTasksByStartTime', () => {
  test('sorts tasks by newest first', () => {
    const sorted = sortBackgroundTasksByStartTime([
      { id: 'old', description: 'old', status: 'running', startTime: 1 },
      { id: 'new', description: 'new', status: 'running', startTime: 3 },
      { id: 'mid', description: 'mid', status: 'running', startTime: 2 },
    ]);

    expect(sorted.map((task) => task.id)).toEqual(['new', 'mid', 'old']);
  });
});
