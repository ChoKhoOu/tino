import React from 'react';
import { Box, Text } from 'ink';

interface RiskAlertProps {
  level: 'WARNING' | 'CRITICAL' | 'CIRCUIT_BREAKER';
  rule: string;
  message: string;
  actionTaken?: string;
  threshold?: number;
  actual?: number;
  cancelledOrders?: number;
  flattenedPositions?: number;
}

export function RiskAlert({
  level,
  rule,
  message,
  actionTaken,
  threshold,
  actual,
  cancelledOrders,
  flattenedPositions,
}: RiskAlertProps) {
  if (level === 'CIRCUIT_BREAKER') {
    return (
      <Box flexDirection="column" borderStyle="double" borderColor="red" paddingX={1}>
        <Text color="red" bold>
          KILL_SWITCH_TRIGGERED
        </Text>
        <Text color="red">Rule: {rule}</Text>
        <Text color="red">{message}</Text>
        {threshold !== undefined && actual !== undefined && (
          <Text color="red">
            Threshold: {threshold} | Actual: {actual}
          </Text>
        )}
        {cancelledOrders !== undefined && (
          <Text color="red">Cancelled orders: {cancelledOrders}</Text>
        )}
        {flattenedPositions !== undefined && (
          <Text color="red">Flattened positions: {flattenedPositions}</Text>
        )}
        {actionTaken && <Text color="red">Action: {actionTaken}</Text>}
      </Box>
    );
  }

  if (level === 'CRITICAL') {
    return (
      <Box flexDirection="column" borderStyle="double" borderColor="red" paddingX={1}>
        <Text color="red" bold>
          {'\u{1F6A8}'} CRITICAL
        </Text>
        <Text color="red">Rule: {rule}</Text>
        <Text color="red">{message}</Text>
        {actionTaken && <Text color="red">Action: {actionTaken}</Text>}
      </Box>
    );
  }

  // WARNING
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
      <Text color="yellow" bold>
        {'\u26A0'} WARNING
      </Text>
      <Text color="yellow">Rule: {rule}</Text>
      <Text color="yellow">{message}</Text>
      {actionTaken && <Text color="yellow">Action: {actionTaken}</Text>}
    </Box>
  );
}
