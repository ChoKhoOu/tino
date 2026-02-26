import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
  progress: number; // 0-100
  tradeCount: number;
  currentPnl: string;
  currentDate: string;
  width?: number;
}

export function ProgressBar({ progress, tradeCount, currentPnl, currentDate, width = 40 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const isNegative = currentPnl.startsWith('-');
  const pnlColor = isNegative ? 'red' : 'green';
  const barColor = isNegative ? 'red' : 'green';

  const pnlDisplay = isNegative ? `-$${currentPnl.slice(1)}` : `+$${currentPnl}`;

  return (
    <Box>
      <Text color={barColor}>{bar}</Text>
      <Text> {clamped.toFixed(0)}%</Text>
      <Text color="gray"> | </Text>
      <Text>{tradeCount} trades</Text>
      <Text color="gray"> | </Text>
      <Text color={pnlColor}>{pnlDisplay}</Text>
      <Text color="gray"> | </Text>
      <Text>{currentDate}</Text>
    </Box>
  );
}
