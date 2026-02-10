import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme.js';

interface ContextClearedViewProps {
  clearedCount: number;
  keptCount: number;
}

export function ContextClearedView({ clearedCount, keptCount }: ContextClearedViewProps) {
  return (
    <Box>
      <Text>⏺ </Text>
      <Text color={colors.muted}>Context threshold reached - cleared {clearedCount} old tool result{clearedCount !== 1 ? 's' : ''}, kept {keptCount} most recent</Text>
    </Box>
  );
}
