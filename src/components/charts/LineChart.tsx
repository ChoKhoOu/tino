import React from 'react';
import { Box, Text } from 'ink';
import { plot } from 'asciichart';
import { colors } from '../../theme.js';

interface LineChartProps {
  data: number[];
  height?: number;
  label?: string;
  color?: string;
}

export function LineChart({ data, height = 10, label, color }: LineChartProps) {
  if (data.length === 0) {
    return (
      <Box>
        <Text color={colors.muted}>No data to display</Text>
      </Box>
    );
  }

  const chart = plot(data, { height });

  return (
    <Box flexDirection="column">
      {label && (
        <Text bold color={color ?? colors.primary}>
          {label}
        </Text>
      )}
      <Text color={color ?? colors.primary}>{chart}</Text>
    </Box>
  );
}
