import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { KeyboardDispatcher } from '@/keyboard/dispatcher.js';

const executeTask = mock(async () => JSON.stringify({ task_id: 'task_123', status: 'running' }));

mock.module('@/tools/agent/task.tool.js', () => ({
  default: {
    execute: executeTask,
  },
}));

const {
  NO_ACTIVE_TASK_MESSAGE,
  findRunningToolId,
  isBackgroundableRun,
  registerBackgroundTaskControl,
} = await import('../useBackgroundTaskControl.js');

function flushEffects(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useBackgroundTaskControl', () => {
  beforeEach(() => {
    executeTask.mockReset();
    executeTask.mockResolvedValue(JSON.stringify({ task_id: 'task_123', status: 'running' }));
  });

  test('findRunningToolId returns latest running tool', () => {
    const toolId = findRunningToolId([
      { type: 'thinking', message: 'a' },
      { type: 'tool_start', toolId: 'market_data', args: {} },
      { type: 'tool_end', toolId: 'market_data', result: '{}', duration: 20 },
      { type: 'tool_start', toolId: 'fundamentals', args: {} },
    ]);

    expect(toolId).toBe('fundamentals');
  });

  test('isBackgroundableRun is false when status is idle', () => {
    expect(isBackgroundableRun({ status: 'idle', events: [] })).toBe(false);
  });

  test('ctrl+b shows no-active-task message when no tool is running', () => {
    const dispatcher = new KeyboardDispatcher();
    const cancelForegroundRun = mock(() => undefined);
    const setNotice = mock(() => undefined);

    const unregister = registerBackgroundTaskControl(dispatcher, {
      runState: { status: 'running', events: [{ type: 'thinking', message: 'working' }] },
      currentQuery: 'analyze AAPL',
      cancelForegroundRun,
      setNotice,
    });

    dispatcher.dispatch({
      input: 'b',
      key: {
        ctrl: true,
        meta: false,
        shift: false,
        escape: false,
        return: false,
        tab: false,
        backspace: false,
        delete: false,
        upArrow: false,
        downArrow: false,
        leftArrow: false,
        rightArrow: false,
      },
    });

    expect(setNotice).toHaveBeenCalledWith(NO_ACTIVE_TASK_MESSAGE);
    expect(executeTask).not.toHaveBeenCalled();
    expect(cancelForegroundRun).not.toHaveBeenCalled();
    unregister();
  });

  test('ctrl+b starts background task and cancels foreground run', async () => {
    const dispatcher = new KeyboardDispatcher();
    const cancelForegroundRun = mock(() => undefined);
    const setNotice = mock(() => undefined);

    const unregister = registerBackgroundTaskControl(dispatcher, {
      runState: {
        status: 'running',
        events: [{ type: 'tool_start', toolId: 'market_data', args: { symbol: 'AAPL' } }],
      },
      currentQuery: 'fetch AAPL latest news',
      cancelForegroundRun,
      setNotice,
    });

    dispatcher.dispatch({
      input: 'b',
      key: {
        ctrl: true,
        meta: false,
        shift: false,
        escape: false,
        return: false,
        tab: false,
        backspace: false,
        delete: false,
        upArrow: false,
        downArrow: false,
        leftArrow: false,
        rightArrow: false,
      },
    });

    await flushEffects();

    expect(executeTask).toHaveBeenCalled();
    expect(cancelForegroundRun).toHaveBeenCalled();
    expect(setNotice).toHaveBeenCalledWith('Backgrounded task task_123');
    unregister();
  });
});
