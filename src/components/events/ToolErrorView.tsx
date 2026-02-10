import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme.js';
import { formatToolName, truncateResult } from './utils.js';

interface ToolErrorViewProps {
  toolId: string;
  error: string;
}

export function ToolErrorView({ toolId, error }: ToolErrorViewProps) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text>⏺ </Text>
        <Text>{formatToolName(toolId)}</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.muted}>⎿  </Text>
        <Text color={colors.error}>Error: {truncateResult(error, 80)}</Text>
      </Box>
    </Box>
  );
}
