import { describe, test, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { AgentBadge } from '../AgentBadge.js';
import { colors } from '../../theme.js';

describe('AgentBadge', () => {
  test('renders bracketed agent name', () => {
    const { lastFrame } = render(<AgentBadge agentName="delegate-agent" />);
    expect(lastFrame()).toContain('[delegate-agent]');
  });

  test('uses primary theme color and bold text', () => {
    const element = AgentBadge({ agentName: 'delegate-agent' });
    expect(element.props.color).toBe(colors.primary);
    expect(element.props.bold).toBe(true);
  });
});
