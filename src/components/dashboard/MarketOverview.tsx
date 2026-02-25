import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../../theme.js';
import type { MarketItem } from '../../hooks/useDashboardData.js';

function formatPrice(price: number): string {
  if (price >= 1) {
    const parts = price.toFixed(2).split('.');
    const intPart = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `$${intPart}.${parts[1]}`;
  }
  return `$${price.toFixed(4)}`;
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(1)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
}

export interface MarketOverviewProps {
  width: number;
  height: number;
  items: MarketItem[];
}

export const MarketOverview = React.memo(function MarketOverview({ width, height, items }: MarketOverviewProps) {
  const visibleItems = items.slice(0, Math.max(1, height - 3));

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
      {items.length === 0 ? (
        <Text color={colors.muted}>Loading market data...</Text>
      ) : (
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
              <Box width={14}><Text color={colors.white}>{formatPrice(item.price)}</Text></Box>
              <Box width={9}>
                <Text color={item.change >= 0 ? colors.success : colors.error}>
                  {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                </Text>
              </Box>
              <Box><Text color={colors.muted}>{formatVolume(item.volume)}</Text></Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
});
