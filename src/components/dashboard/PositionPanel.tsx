import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../../theme.js';

interface Position {
  symbol: string;
  side: 'Long' | 'Short';
  size: string;
  pnl: number;
}

const MOCK_POSITIONS: Position[] = [
  { symbol: 'BTC', side: 'Long', size: '0.50', pnl: 1200.50 },
  { symbol: 'ETH', side: 'Short', size: '2.00', pnl: -340.20 },
  { symbol: 'SOL', side: 'Long', size: '15.0', pnl: 85.60 },
];

const MOCK_TOTAL_PNL = 946.0;
const MOCK_MAX_DRAWDOWN = -520.30;

export interface PositionPanelProps {
  width: number;
  height: number;
}

function formatPnl(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}$${Math.abs(value).toFixed(2)}`;
}

export const PositionPanel = React.memo(function PositionPanel({ width, height }: PositionPanelProps) {
  const visiblePositions = MOCK_POSITIONS.slice(0, Math.max(1, height - 6));

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
        <Text color={colors.primary} bold>Positions & PnL</Text>
      </Box>
      <Box flexDirection="column">
        <Box>
          <Box width={8}><Text color={colors.muted}>Asset</Text></Box>
          <Box width={8}><Text color={colors.muted}>Side</Text></Box>
          <Box width={8}><Text color={colors.muted}>Size</Text></Box>
          <Box><Text color={colors.muted}>PnL</Text></Box>
        </Box>
        {visiblePositions.map(pos => (
          <Box key={pos.symbol}>
            <Box width={8}><Text color={colors.white}>{pos.symbol}</Text></Box>
            <Box width={8}>
              <Text color={pos.side === 'Long' ? colors.success : colors.error}>{pos.side}</Text>
            </Box>
            <Box width={8}><Text color={colors.white}>{pos.size}</Text></Box>
            <Box>
              <Text color={pos.pnl >= 0 ? colors.success : colors.error}>
                {formatPnl(pos.pnl)}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text color={colors.muted}>Total PnL: </Text>
          <Text color={MOCK_TOTAL_PNL >= 0 ? colors.success : colors.error}>
            {formatPnl(MOCK_TOTAL_PNL)}
          </Text>
        </Box>
        <Box>
          <Text color={colors.muted}>Max DD: </Text>
          <Text color={colors.error}>{formatPnl(MOCK_MAX_DRAWDOWN)}</Text>
        </Box>
      </Box>
    </Box>
  );
});
