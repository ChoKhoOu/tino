import { describe, it, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { RewindMenu } from '../RewindMenu.js';
import type { HistoryItem } from '../HistoryItemView.js';

function makeHistory(count: number): HistoryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `turn-${i}`,
    query: `User prompt ${i} with very long text that should be truncated in menu rendering`,
    events: [],
    answer: '',
    status: 'complete' as const,
    startTime: 1700000000000 + i * 60_000,
  }));
}

describe('RewindMenu', () => {
  it('renders nothing when closed', () => {
    const { lastFrame } = render(
      <RewindMenu
        isOpen={false}
        selectedIndex={0}
        turns={makeHistory(3)}
        subMenuOpen={false}
        subMenuIndex={0}
      />,
    );
    expect(lastFrame()).toBe('');
  });

  it('shows only 5 visible turns and scroll indicator', () => {
    const turns = makeHistory(8);
    const { lastFrame } = render(
      <RewindMenu
        isOpen={true}
        selectedIndex={7}
        turns={turns}
        subMenuOpen={false}
        subMenuIndex={0}
      />,
    );

    const output = lastFrame()!;
    expect(output).toContain('Rewind Session');
    expect(output).toContain('▲');
    expect(output).toContain('turn-7');
    expect(output).not.toContain('turn-0');
  });

  it('shows submenu options when turn is selected', () => {
    const { lastFrame } = render(
      <RewindMenu
        isOpen={true}
        selectedIndex={0}
        turns={makeHistory(2)}
        subMenuOpen={true}
        subMenuIndex={2}
      />,
    );

    const output = lastFrame()!;
    expect(output).toContain('Restore code and conversation');
    expect(output).toContain('Restore conversation only');
    expect(output).toContain('Restore code only');
    expect(output).toContain('Summarize from here');
    expect(output).toContain('Cancel');
  });
});
