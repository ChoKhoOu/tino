import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../../theme.js';
import type { PositionItem } from '../../hooks/useDashboardData.js';

export interface PositionPanelProps {
  width: number;
  height: number;
  positions: PositionItem[];
  totalPnl: number;
  daemonConnected: boolean;
}

function formatPnl(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}$${Math.abs(value).toFixed(2)}`;
}

export const PositionPanel = React.memo(function PositionPanel({
  width, height, positions, totalPnl, daemonConnected,
}: PositionPanelProps) {
  const visiblePositions = positions.slice(0, Math.max(1, height - 5));

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
      {!daemonConnected ? (
        <Text color={colors.muted}>Daemon not connected</Text>
      ) : positions.length === 0 ? (
        <Text color={colors.muted}>No open positions</Text>
      ) : (
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
      )}
      {daemonConnected && (
        <Box marginTop={1}>
          <Text color={colors.muted}>Total PnL: </Text>
          <Text color={totalPnl >= 0 ? colors.success : colors.error}>
            {formatPnl(totalPnl)}
          </Text>
        </Box>
      )}
    </Box>
  );
});
