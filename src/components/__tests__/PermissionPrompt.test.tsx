import { describe, it, expect, jest } from 'bun:test';
import { render } from 'ink-testing-library';
import { KeyboardDispatcher } from '../../keyboard/dispatcher.js';
import { KeyboardProvider } from '../../keyboard/use-keyboard.js';
import type { PermissionRequestEvent } from '../../domain/index.js';
import { PermissionPrompt } from '../PermissionPrompt.js';

const request: PermissionRequestEvent = {
  type: 'permission_request',
  toolId: 'market_data',
  resource: 'quotes',
  rule: { tool: 'market_data', resource: 'quotes', action: 'ask' },
  args: { symbol: 'AAPL', timeframe: '1d' },
};

const tick = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 20));
};

const pressKey = async (dispatcher: KeyboardDispatcher, keyName: 'left' | 'right' | 'return'): Promise<void> => {
  dispatcher.dispatch({
    input: '',
    key: {
      ctrl: false,
      meta: false,
      shift: false,
      escape: false,
      return: keyName === 'return',
      tab: false,
      backspace: false,
      delete: false,
      upArrow: false,
      downArrow: false,
      leftArrow: keyName === 'left',
      rightArrow: keyName === 'right',
    },
  });
  await tick();
};

const renderPrompt = (onResponse = jest.fn()) => {
  const dispatcher = new KeyboardDispatcher();
  const result = render(
    <KeyboardProvider dispatcher={dispatcher}>
      <PermissionPrompt request={request} onResponse={onResponse} />
    </KeyboardProvider>,
  );
  return { ...result, dispatcher, onResponse };
};

describe('PermissionPrompt', () => {
  it('renders request details, args, and all tab labels', () => {
    const { lastFrame } = renderPrompt();
    const output = lastFrame()!;
    expect(output).toContain('Permission Request');
    expect(output).toContain('market_data');
    expect(output).toContain('quotes');
    expect(output).toContain('Allow Once');
    expect(output).toContain('Always Allow');
    expect(output).toContain('Deny');
    expect(output).toContain('symbol');
    expect(output).toContain('AAPL');
  });

  it('pushes permission mode on open and pops on unmount', () => {
    const { dispatcher, unmount } = renderPrompt();
    expect(dispatcher.currentMode).toBe('permission');
    unmount();
    expect(dispatcher.currentMode).toBe('normal');
  });

  it('switches tabs with left/right arrows', async () => {
    const { dispatcher, lastFrame } = renderPrompt();
    expect(lastFrame()!).toContain('(Allow Once)');

    await pressKey(dispatcher, 'right');
    expect(lastFrame()!).toContain('(Always Allow)');

    await pressKey(dispatcher, 'right');
    expect(lastFrame()!).toContain('(Deny)');

    await pressKey(dispatcher, 'left');
    expect(lastFrame()!).toContain('(Always Allow)');
  });

  it('confirms Allow Once on Enter by default', async () => {
    const { dispatcher, onResponse } = renderPrompt();

    await pressKey(dispatcher, 'return');
    expect(onResponse).toHaveBeenCalledWith(true);
  });

  it('confirms Always Allow after moving right once', async () => {
    const { dispatcher, onResponse } = renderPrompt();

    await pressKey(dispatcher, 'right');
    await pressKey(dispatcher, 'return');
    expect(onResponse).toHaveBeenCalledWith(true, true);
  });

  it('confirms Deny after moving right twice', async () => {
    const { dispatcher, onResponse } = renderPrompt();

    await pressKey(dispatcher, 'right');
    await pressKey(dispatcher, 'right');
    await pressKey(dispatcher, 'return');
    expect(onResponse).toHaveBeenCalledWith(false);
  });
});
