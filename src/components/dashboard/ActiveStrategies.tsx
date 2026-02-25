import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../../theme.js';

interface Strategy {
  name: string;
  status: 'Running' | 'Paused' | 'Stopped';
  returnPct: number;
}

const MOCK_STRATEGIES: Strategy[] = [
  { name: 'funding_arb', status: 'Running', returnPct: 3.2 },
  { name: 'grid_trader', status: 'Paused', returnPct: 1.8 },
  { name: 'mean_revert', status: 'Running', returnPct: -0.5 },
  { name: 'momentum_v2', status: 'Stopped', returnPct: 0.0 },
];

const STATUS_ICONS: Record<Strategy['status'], string> = {
  Running: '●',
  Paused: '◻',
  Stopped: '○',
};

export interface ActiveStrategiesProps {
  width: number;
  height: number;
}

function getStatusColor(status: Strategy['status']): string {
  switch (status) {
    case 'Running': return colors.success;
    case 'Paused': return colors.warning;
    case 'Stopped': return colors.muted;
  }
}

export const ActiveStrategies = React.memo(function ActiveStrategies({ width, height }: ActiveStrategiesProps) {
  const visibleStrategies = MOCK_STRATEGIES.slice(0, Math.max(1, height - 3));

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
    </Box>
  );
});
