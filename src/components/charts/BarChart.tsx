import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme.js';

interface BarChartItem {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarChartItem[];
  maxWidth?: number;
}

/**
 * Scale bar lengths relative to the maximum absolute value.
 * Returns an array of { width, isPositive } for each item.
 * Exported for testing.
 */
export function scaleBarWidths(
  values: number[],
  maxWidth: number,
): { width: number; isPositive: boolean }[] {
  if (values.length === 0) return [];

  const maxAbs = Math.max(...values.map(Math.abs));
  if (maxAbs === 0) {
    return values.map(() => ({ width: 0, isPositive: true }));
  }

  return values.map((v) => ({
    width: Math.max(1, Math.round((Math.abs(v) / maxAbs) * maxWidth)),
    isPositive: v >= 0,
  }));
}

/**
 * Format a number compactly (e.g. 1.2M, 3.5K).
 * Exported for testing.
 */
export function formatCompactNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(1)}`;
}

export function BarChart({ data, maxWidth = 40 }: BarChartProps) {
  if (data.length === 0) {
    return (
      <Box>
        <Text color={colors.muted}>No data to display</Text>
      </Box>
    );
  }

  const maxLabelLen = Math.max(...data.map((d) => d.label.length));
  const bars = scaleBarWidths(
    data.map((d) => d.value),
    maxWidth,
  );

  return (
    <Box flexDirection="column">
      {data.map((item, i) => {
        const bar = bars[i];
        const barColor = bar.isPositive ? colors.success : colors.error;
        const barStr = '█'.repeat(bar.width);
        const valueStr = formatCompactNumber(item.value);

        return (
          <Box key={item.label}>
            <Text color={colors.muted}>
              {item.label.padEnd(maxLabelLen)}
            </Text>
            <Text> </Text>
            <Text color={barColor}>{barStr}</Text>
            <Text> </Text>
            <Text color={barColor} dimColor>
              {valueStr}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
