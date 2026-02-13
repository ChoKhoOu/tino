import { beforeEach, describe, expect, mock, test } from 'bun:test';
import React from 'react';
import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { EventEmitter } from 'node:events';
import type { TaskToolSnapshot } from '@/domain/background-task.js';

const events = new EventEmitter();
const getAllBackgroundTasks = mock((): TaskToolSnapshot[] => []);
const cancelBackgroundTask = mock(() => true);

mock.module('@/tools/agent/task.tool.js', () => ({
  backgroundTaskEvents: events,
  getAllBackgroundTasks,
  cancelBackgroundTask,
}));

const { useBackgroundTasks } = await import('../useBackgroundTasks.js');

function flushEffects(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useBackgroundTasks', () => {
  beforeEach(() => {
    events.removeAllListeners();
    getAllBackgroundTasks.mockReset();
    cancelBackgroundTask.mockReset();
    getAllBackgroundTasks.mockReturnValue([]);
    cancelBackgroundTask.mockReturnValue(true);
  });

  test('initializes from current background tasks', () => {
    getAllBackgroundTasks.mockReturnValue([
      {
        task_id: 'task_seed',
        description: 'Seed task',
        status: 'running',
        start_time: 100,
      },
    ]);

    const TestComponent = () => {
      const { tasks } = useBackgroundTasks();
      return React.createElement(Text, {}, `count:${tasks.length}|id:${tasks[0]?.id ?? 'none'}`);
    };

    const { lastFrame } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('count:1|id:task_seed');
  });

  test('updates tasks when started and completed events are emitted', async () => {
    const TestComponent = () => {
      const { tasks, getTaskOutput } = useBackgroundTasks();
      const first = tasks[0];
      const output = first ? getTaskOutput(first.id) ?? '' : '';
      return React.createElement(
        Text,
        {},
        `count:${tasks.length}|status:${first?.status ?? 'none'}|output:${output}`,
      );
    };

    const { lastFrame } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('count:0|status:none|output:');
    await flushEffects();

    events.emit('task:started', {
      task_id: 'task_1',
      description: 'Run child task',
      status: 'running',
      start_time: 123,
    });
    await flushEffects();

    expect(lastFrame()).toContain('count:1|status:running|output:');

    events.emit('task:completed', {
      task_id: 'task_1',
      description: 'Run child task',
      status: 'completed',
      start_time: 123,
      answer: 'done',
    });
    await flushEffects();

    expect(lastFrame()).toContain('count:1|status:completed|output:done');
  });

  test('forwards cancelTask calls to task bridge', () => {
    let cancelResult = false;

    const TestComponent = () => {
      const { cancelTask } = useBackgroundTasks();
      cancelResult = cancelTask('task_42');
      return React.createElement(Text, {}, `cancelled:${String(cancelResult)}`);
    };

    const { lastFrame } = render(React.createElement(TestComponent));
    expect(lastFrame()).toContain('cancelled:true');
    expect(cancelBackgroundTask).toHaveBeenCalledWith('task_42');
  });
});
