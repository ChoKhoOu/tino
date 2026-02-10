import React from 'react';
import { Text } from 'ink';

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

interface SparklineProps {
  data: number[];
  color?: string;
}

/**
 * Convert numeric data to a Unicode sparkline string.
 * Exported for testing as a pure function.
 */
export function sparklineData(data: number[]): string {
  if (data.length === 0) return '';

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  return data
    .map((value) => {
      if (range === 0) return BLOCKS[0];
      const normalized = (value - min) / range;
      const index = Math.min(Math.round(normalized * (BLOCKS.length - 1)), BLOCKS.length - 1);
      return BLOCKS[index];
    })
    .join('');
}

export function Sparkline({ data, color = 'green' }: SparklineProps) {
  if (data.length === 0) {
    return <Text color="gray">—</Text>;
  }

  return <Text color={color}>{sparklineData(data)}</Text>;
}
