import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../../theme.js';
import { formatToolName, formatArgs } from './utils.js';

interface ToolStartViewProps {
  toolId: string;
  args: Record<string, unknown>;
  isActive?: boolean;
  progressMessage?: string;
}

export function ToolStartView({ toolId, args, isActive = false, progressMessage }: ToolStartViewProps) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text>⏺ </Text>
        <Text>{formatToolName(toolId)}</Text>
        <Text color={colors.muted}>({formatArgs(args)})</Text>
      </Box>
      {isActive && (
        <Box marginLeft={2}>
          <Text color={colors.muted}>⎿  </Text>
          <Text color={colors.muted}>
            <Spinner type="dots" />
          </Text>
          <Text> {progressMessage || 'Searching...'}</Text>
        </Box>
      )}
    </Box>
  );
}
