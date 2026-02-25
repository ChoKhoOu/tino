import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../../theme.js';
import type { StrategyItem } from '../../hooks/useDashboardData.js';

const STATUS_ICONS: Record<StrategyItem['status'], string> = {
  Running: '●',
  Paused: '◻',
  Stopped: '○',
};

function getStatusColor(status: StrategyItem['status']): string {
  switch (status) {
    case 'Running': return colors.success;
    case 'Paused': return colors.warning;
    case 'Stopped': return colors.muted;
  }
}

export interface ActiveStrategiesProps {
  width: number;
  height: number;
  strategies: StrategyItem[];
  daemonConnected: boolean;
}

export const ActiveStrategies = React.memo(function ActiveStrategies({
  width, height, strategies, daemonConnected,
}: ActiveStrategiesProps) {
  const visibleStrategies = strategies.slice(0, Math.max(1, height - 3));

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
        <Text color={colors.primary} bold>Active Strategies</Text>
      </Box>
      {!daemonConnected ? (
        <Text color={colors.muted}>Daemon not connected</Text>
      ) : strategies.length === 0 ? (
        <Text color={colors.muted}>No active strategies</Text>
      ) : (
        <Box flexDirection="column">
          <Box>
            <Box width={16}><Text color={colors.muted}>Strategy</Text></Box>
            <Box width={12}><Text color={colors.muted}>Status</Text></Box>
            <Box><Text color={colors.muted}>Return</Text></Box>
          </Box>
          {visibleStrategies.map(strat => (
            <Box key={strat.name}>
              <Box width={16}><Text color={colors.white}>{strat.name}</Text></Box>
              <Box width={12}>
                <Text color={getStatusColor(strat.status)}>
                  {STATUS_ICONS[strat.status]} {strat.status}
                </Text>
              </Box>
              <Box>
                <Text color={strat.returnPct >= 0 ? colors.success : colors.error}>
                  {strat.returnPct >= 0 ? '+' : ''}{strat.returnPct.toFixed(1)}%
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
});
