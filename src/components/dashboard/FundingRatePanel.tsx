import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../../theme.js';

interface FundingRate {
  rank: number;
  symbol: string;
  rate: number;
}

const MOCK_FUNDING_RATES: FundingRate[] = [
  { rank: 1, symbol: 'DOGE/USDT', rate: 0.0320 },
  { rank: 2, symbol: 'SHIB/USDT', rate: 0.0280 },
  { rank: 3, symbol: 'PEPE/USDT', rate: 0.0250 },
  { rank: 4, symbol: 'WIF/USDT', rate: 0.0180 },
  { rank: 5, symbol: 'BONK/USDT', rate: 0.0150 },
];

export interface FundingRatePanelProps {
  width: number;
  height: number;
}

export const FundingRatePanel = React.memo(function FundingRatePanel({ width, height }: FundingRatePanelProps) {
  const visibleRates = MOCK_FUNDING_RATES.slice(0, Math.max(1, height - 3));

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
        <Text color={colors.primary} bold>Funding Rates Top 5</Text>
      </Box>
      <Box flexDirection="column">
        <Box>
          <Box width={4}><Text color={colors.muted}>#</Text></Box>
          <Box width={14}><Text color={colors.muted}>Symbol</Text></Box>
          <Box><Text color={colors.muted}>Rate (8h)</Text></Box>
        </Box>
        {visibleRates.map(item => (
          <Box key={item.symbol}>
            <Box width={4}><Text color={colors.muted}>{item.rank}.</Text></Box>
            <Box width={14}><Text color={colors.white}>{item.symbol}</Text></Box>
            <Box>
              <Text color={item.rate >= 0 ? colors.success : colors.error}>
                {item.rate >= 0 ? '+' : ''}{item.rate.toFixed(4)}%
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
});
