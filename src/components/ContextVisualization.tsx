import React from 'react';
import { Box, Text } from 'ink';
import { getContextColor } from '../theme.js';
import { renderContextBar, getContextPercentage } from './context-bar.js';

export interface ContextVisualizationProps {
  usedTokens: number;
  maxTokens: number;
}

export function ContextVisualization({ usedTokens, maxTokens }: ContextVisualizationProps) {
  const percent = getContextPercentage(usedTokens, maxTokens);
  const color = getContextColor(percent);
  const bar = renderContextBar(usedTokens, maxTokens);

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>Context </Text>
        <Text color={color}>{bar}</Text>
      </Box>
    </Box>
  );
}
