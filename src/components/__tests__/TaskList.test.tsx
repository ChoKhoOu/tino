import { describe, expect, test } from 'bun:test';
import { render } from 'ink-testing-library';
import { TaskList } from '../TaskList.js';
import type { BackgroundTask } from '@/domain/background-task.js';

describe('TaskList', () => {
  test('shows empty message when no tasks', () => {
    const { lastFrame } = render(<TaskList tasks={[]} />);
    expect(lastFrame()).toContain('No background tasks');
  });

  test('renders status indicators for each task state', () => {
    const tasks: BackgroundTask[] = [
      { id: '1', description: 'Queued task', status: 'pending', startTime: 1 },
      { id: '2', description: 'Running task', status: 'running', startTime: 2 },
      { id: '3', description: 'Done task', status: 'completed', startTime: 3 },
      { id: '4', description: 'Failed task', status: 'failed', startTime: 4, error: 'boom' },
    ];

    const { lastFrame } = render(<TaskList tasks={tasks} />);
    const frame = lastFrame();

    expect(frame).toContain('◯');
    expect(frame).toContain('◉');
    expect(frame).toContain('✓');
    expect(frame).toContain('✗');
    expect(frame).toContain('Running task');
    expect(frame).toContain('failed');
  });

  test('renders at most 10 tasks', () => {
    const tasks: BackgroundTask[] = Array.from({ length: 12 }, (_, index) => ({
      id: `task_${index}`,
      description: `Task ${index}`,
      status: 'completed',
      startTime: index,
    }));

    const { lastFrame } = render(<TaskList tasks={tasks} />);
    const frame = lastFrame();

    expect(frame).toContain('Task 0');
    expect(frame).toContain('Task 9');
    expect(frame).not.toContain('Task 10');
    expect(frame).not.toContain('Task 11');
  });
});
