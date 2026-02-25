import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../theme.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { MarketOverview } from './dashboard/MarketOverview.js';
import { PositionPanel } from './dashboard/PositionPanel.js';
import { FundingRatePanel } from './dashboard/FundingRatePanel.js';
import { ActiveStrategies } from './dashboard/ActiveStrategies.js';

export interface DashboardProps {
  height: number;
}

export const Dashboard = React.memo(function Dashboard({ height }: DashboardProps) {
  const { columns } = useTerminalSize();

  // Reserve 1 row for header, 1 for footer hint
  const contentHeight = Math.max(6, height - 2);
  const panelHeight = Math.max(4, Math.floor(contentHeight / 2));
  const leftWidth = Math.max(20, Math.floor(columns / 2));
  const rightWidth = Math.max(20, columns - leftWidth);

  return (
    <Box flexDirection="column" height={height}>
      {/* Header */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text color={colors.primary} bold>Tino Dashboard</Text>
        <Text color={colors.muted}>Press Esc to return</Text>
      </Box>

      {/* 2x2 Panel Grid */}
      <Box flexDirection="column" flexGrow={1}>
        {/* Top row */}
        <Box flexDirection="row">
          <MarketOverview width={leftWidth} height={panelHeight} />
          <PositionPanel width={rightWidth} height={panelHeight} />
        </Box>
        {/* Bottom row */}
        <Box flexDirection="row">
          <FundingRatePanel width={leftWidth} height={panelHeight} />
          <ActiveStrategies width={rightWidth} height={panelHeight} />
        </Box>
      </Box>
    </Box>
  );
});
