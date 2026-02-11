import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

interface StreamingTickerProps {
  instrument: string;
  price: number;
  change: number;
  timestamp: string;
}

export function StreamingTicker({ instrument, price, change, timestamp }: StreamingTickerProps) {
  const isPositive = change >= 0;
  const changeColor = isPositive ? colors.success : colors.error;
  const arrow = isPositive ? '▲' : '▼';
  const changeStr = `${arrow} ${Math.abs(change).toFixed(2)}%`;

  return (
    <Box gap={2}>
      <Text bold color={colors.primary}>{instrument}</Text>
      <Text color={colors.white}>${price.toFixed(2)}</Text>
      <Text color={changeColor}>{changeStr}</Text>
      <Text color={colors.muted}>{timestamp}</Text>
    </Box>
  );
}
