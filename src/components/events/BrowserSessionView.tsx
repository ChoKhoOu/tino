import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../../theme.js';
import { formatBrowserStep } from './utils.js';
import type { DisplayEvent } from '../AgentEventView.js';

interface BrowserSessionViewProps {
  events: DisplayEvent[];
  activeStepId?: string;
}

/**
 * Find the current displayable browser step from a list of browser events.
 * Skips 'act' actions and returns the most recent displayable step.
 */
function findCurrentBrowserStep(events: DisplayEvent[], activeStepId?: string): string | null {
  // If there's an active step, try to show it
  if (activeStepId) {
    const activeEvent = events.find(e => e.id === activeStepId);
    if (activeEvent?.event.type === 'tool_start') {
      const step = formatBrowserStep(activeEvent.event.args);
      if (step) return step;
    }
  }
  
  // Otherwise, find the most recent displayable step (working backwards)
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.event.type === 'tool_start') {
      const step = formatBrowserStep(event.event.args);
      if (step) return step;
    }
  }
  
  return null;
}

/**
 * Renders a consolidated browser session showing the current step.
 */
export function BrowserSessionView({ events, activeStepId }: BrowserSessionViewProps) {
  // Find current displayable step (skip 'act' actions)
  const currentStep = findCurrentBrowserStep(events, activeStepId);

  return (
    <Box flexDirection="column">
      <Box>
        <Text>⏺ </Text>
        <Text>Browser</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.muted}>⎿  </Text>
        {activeStepId && (
          <Text color={colors.muted}><Spinner type="dots" /></Text>
        )}
        {currentStep && <Text>{activeStepId ? ' ' : ''}{currentStep}</Text>}
      </Box>
    </Box>
  );
}
