import { beforeEach, describe, expect, test } from 'bun:test';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import type { HistoryItem } from '@/components/HistoryItemView.js';
import type { RunState } from '../useSessionRunner.js';
import { usePromptSuggestion } from '../usePromptSuggestion.js';

interface HarnessProps {
  runState: RunState;
  history?: HistoryItem[];
  input?: string;
  activeSkill?: string;
}

let lastAccept: (() => string | null) | null = null;
let lastDismiss: (() => void) | null = null;

async function flushAsyncEffects(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForFrameText(
  lastFrame: () => string | undefined,
  text: string,
  attempts = 20,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (lastFrame()?.includes(text)) return;
    await flushAsyncEffects();
  }
  throw new Error(`Timed out waiting for frame text: ${text}`);
}

function HookHarness({ runState, history = [], input = '', activeSkill }: HarnessProps) {
  const result = usePromptSuggestion({ runState, history, input, activeSkill });
  lastAccept = result.acceptSuggestion;
  lastDismiss = result.dismissSuggestion;
  return <Text>{result.suggestion ?? 'null'}</Text>;
}

function buildDoneState(toolId: string): RunState {
  return {
    events: [
      { type: 'tool_start', toolId, args: {} },
      { type: 'tool_end', toolId, result: '{}', duration: 10 },
      { type: 'done', answer: 'ok', toolCalls: [], iterations: 1, totalTime: 20 },
    ],
    status: 'done',
    answer: 'ok',
    toolCalls: [],
  };
}

describe('usePromptSuggestion', () => {
  beforeEach(() => {
    lastAccept = null;
    lastDismiss = null;
  });

  test('generates suggestion after run completes', async () => {
    const { lastFrame } = render(<HookHarness runState={buildDoneState('market_data')} />);

    await waitForFrameText(lastFrame, 'Analyze the price trend');
    expect(lastFrame()).toContain('Analyze the price trend');
  });

  test('clears suggestion when user starts typing', async () => {
    const doneState = buildDoneState('trading_sim');
    const { rerender, lastFrame } = render(<HookHarness runState={doneState} input="" />);
    await waitForFrameText(lastFrame, 'Optimize parameters');

    expect(lastFrame()).toContain('Optimize parameters');
    rerender(<HookHarness runState={doneState} input="o" />);
    await waitForFrameText(lastFrame, 'null');
    expect(lastFrame()).toContain('null');
  });

  test('acceptSuggestion returns current suggestion and clears it', async () => {
    const { lastFrame } = render(<HookHarness runState={buildDoneState('fundamentals')} />);
    await waitForFrameText(lastFrame, 'Run a DCF valuation');
    expect(lastFrame()).toContain('Run a DCF valuation');

    const accepted = lastAccept?.() ?? null;
    await waitForFrameText(lastFrame, 'null');
    expect(accepted).toBe('Run a DCF valuation');
    expect(lastFrame()).toContain('null');
  });

  test('dismissSuggestion clears current suggestion', async () => {
    const { lastFrame } = render(<HookHarness runState={buildDoneState('strategy_lab')} />);
    await waitForFrameText(lastFrame, 'Run a backtest');

    expect(lastFrame()).toContain('Run a backtest');
    lastDismiss?.();
    await waitForFrameText(lastFrame, 'null');
    expect(lastFrame()).toContain('null');
  });
});
