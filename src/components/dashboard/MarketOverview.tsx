import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../../theme.js';

interface MarketItem {
  symbol: string;
  price: string;
  change: number;
  volume: string;
}

const MOCK_DATA: MarketItem[] = [
  { symbol: 'BTC/USDT', price: '$42,300.50', change: 2.14, volume: '$28.5B' },
  { symbol: 'ETH/USDT', price: '$2,650.80', change: -0.82, volume: '$12.1B' },
  { symbol: 'SOL/USDT', price: '$102.35', change: 5.31, volume: '$3.2B' },
  { symbol: 'BNB/USDT', price: '$312.60', change: 1.05, volume: '$1.8B' },
  { symbol: 'XRP/USDT', price: '$0.6240', change: -1.23, volume: '$1.5B' },
];

export interface MarketOverviewProps {
  width: number;
  height: number;
}

export const MarketOverview = React.memo(function MarketOverview({ width, height }: MarketOverviewProps) {
  const visibleItems = MOCK_DATA.slice(0, Math.max(1, height - 3));

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="round"
      borderColor={componentTokens.popup.border}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text color={colors.primary} bold>Market Overview</Text>
      </Box>
      <Box flexDirection="column">
        <Box>
          <Box width={12}><Text color={colors.muted}>Pair</Text></Box>
          <Box width={14}><Text color={colors.muted}>Price</Text></Box>
          <Box width={9}><Text color={colors.muted}>24h %</Text></Box>
          <Box><Text color={colors.muted}>Vol</Text></Box>
        </Box>
        {visibleItems.map(item => (
          <Box key={item.symbol}>
            <Box width={12}><Text color={colors.white}>{item.symbol}</Text></Box>
            <Box width={14}><Text color={colors.white}>{item.price}</Text></Box>
            <Box width={9}>
              <Text color={item.change >= 0 ? colors.success : colors.error}>
                {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
              </Text>
            </Box>
            <Box><Text color={colors.muted}>{item.volume}</Text></Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
});
