import React from 'react';
import { Box, Text } from 'ink';

interface StateChangeNotificationProps {
  sessionId: string;
  previousState: string;
  currentState: string;
  timestamp?: string;
}

type InkColor = 'green' | 'yellow' | 'red' | 'cyan' | 'gray' | 'white';

const stateColors: Record<string, InkColor> = {
  RUNNING: 'green',
  PAUSED: 'yellow',
  STOPPED: 'red',
  STARTING: 'cyan',
  STOPPING: 'yellow',
};

export function StateChangeNotification({ sessionId, previousState, currentState, timestamp }: StateChangeNotificationProps) {
  const prevColor: InkColor = stateColors[previousState] || 'gray';
  const currColor: InkColor = stateColors[currentState] || 'gray';

  const time = timestamp ? new Date(timestamp).toLocaleTimeString('en-US', { hour12: false }) : '';

  return (
    <Box gap={1}>
      {time && <Text dimColor>[{time}]</Text>}
      <Text>Session {sessionId.slice(0, 8)}:</Text>
      <Text color={prevColor}>{previousState}</Text>
      <Text dimColor>{'\u2192'}</Text>
      <Text color={currColor} bold>{currentState}</Text>
    </Box>
  );
}
