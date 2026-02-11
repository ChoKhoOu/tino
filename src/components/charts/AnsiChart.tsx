import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme.js';

interface AnsiChartProps {
  chart: string;
  title?: string;
}

export function AnsiChart({ chart, title }: AnsiChartProps) {
  if (!chart) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {title && (
        <Text bold color={colors.primary}>
          {title}
        </Text>
      )}
      <Text>{chart}</Text>
    </Box>
  );
}
