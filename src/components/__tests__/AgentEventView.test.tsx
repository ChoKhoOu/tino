import { describe, test, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { AgentEventView, EventListView, ThinkingView, ToolStartView, ToolEndView, ToolErrorView, ContextClearedView } from '../AgentEventView.js';
import type { DisplayEvent } from '../AgentEventView.js';

describe('AgentEventView exports', () => {
  test('exports all expected components', () => {
    expect(AgentEventView).toBeDefined();
    expect(EventListView).toBeDefined();
    expect(ThinkingView).toBeDefined();
    expect(ToolStartView).toBeDefined();
    expect(ToolEndView).toBeDefined();
    expect(ToolErrorView).toBeDefined();
    expect(ContextClearedView).toBeDefined();
  });
});

describe('AgentEventView rendering', () => {
  test('renders thinking event', () => {
    const { lastFrame } = render(
      <AgentEventView event={{ type: 'thinking', message: 'analyzing data' }} />
    );
    expect(lastFrame()).toContain('analyzing data');
  });

  test('renders tool_start event', () => {
    const { lastFrame } = render(
      <AgentEventView event={{ type: 'tool_start', toolId: 'market_data', args: { symbol: 'AAPL' } }} />
    );
    expect(lastFrame()).toContain('Market Data');
    expect(lastFrame()).toContain('symbol=AAPL');
  });

  test('renders tool_start event with agent attribution', () => {
    const { lastFrame } = render(
      <AgentEventView
        event={{ type: 'tool_start', toolId: 'market_data', args: { symbol: 'AAPL' }, agent: 'delegate-agent' }}
      />
    );
    expect(lastFrame()).toContain('[delegate-agent]');
    expect(lastFrame()).toContain('Market Data');
  });

  test('renders tool_end event', () => {
    const { lastFrame } = render(
      <AgentEventView event={{ type: 'tool_end', toolId: 'market_data', result: '{}', duration: 1500 }} />
    );
    expect(lastFrame()).toContain('Market Data');
    expect(lastFrame()).toContain('1.5s');
  });

  test('renders tool_error event', () => {
    const { lastFrame } = render(
      <AgentEventView event={{ type: 'tool_error', toolId: 'web_search', error: 'timeout' }} />
    );
    expect(lastFrame()).toContain('Web Search');
    expect(lastFrame()).toContain('timeout');
  });

  test('renders context_cleared event', () => {
    const { lastFrame } = render(
      <AgentEventView event={{ type: 'context_cleared', clearedCount: 5, keptCount: 3 }} />
    );
    expect(lastFrame()).toContain('cleared 5');
    expect(lastFrame()).toContain('kept 3');
  });

  test('returns null for answer_start', () => {
    const { lastFrame } = render(
      <AgentEventView event={{ type: 'answer_start' }} />
    );
    expect(lastFrame()).toBe('');
  });

  test('returns null for done', () => {
    const { lastFrame } = render(
      <AgentEventView event={{ type: 'done', answer: 'hello', toolCalls: [], iterations: 1, totalTime: 100 }} />
    );
    expect(lastFrame()).toBe('');
  });
});

describe('EventListView rendering', () => {
  test('renders list of completed tool events', () => {
    const events: DisplayEvent[] = [
      {
        id: 'tool-market_data-0',
        event: { type: 'tool_start', toolId: 'market_data', args: { symbol: 'AAPL' } },
        completed: true,
        endEvent: { type: 'tool_end', toolId: 'market_data', result: '{"data":{"price":150}}', duration: 500 },
      },
      {
        id: 'thinking-1',
        event: { type: 'thinking', message: 'processing results' },
        completed: true,
      },
    ];

    const { lastFrame } = render(<EventListView events={events} />);
    const frame = lastFrame();
    expect(frame).toContain('Market Data');
    expect(frame).toContain('processing results');
  });

  test('renders tool error in event list', () => {
    const events: DisplayEvent[] = [
      {
        id: 'tool-web_search-0',
        event: { type: 'tool_start', toolId: 'web_search', args: { query: 'test' } },
        completed: true,
        endEvent: { type: 'tool_error', toolId: 'web_search', error: 'network error' },
      },
    ];

    const { lastFrame } = render(<EventListView events={events} />);
    expect(lastFrame()).toContain('network error');
  });
});
