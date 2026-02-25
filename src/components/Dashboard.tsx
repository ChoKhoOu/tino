import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../theme.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { MarketOverview } from './dashboard/MarketOverview.js';
import { PositionPanel } from './dashboard/PositionPanel.js';
import { FundingRatePanel } from './dashboard/FundingRatePanel.js';
import { ActiveStrategies } from './dashboard/ActiveStrategies.js';

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export interface DashboardProps {
  height: number;
}

export const Dashboard = React.memo(function Dashboard({ height }: DashboardProps) {
  const { columns } = useTerminalSize();
  const data = useDashboardData();

  // Reserve 1 row for header, 1 for footer hint
  const contentHeight = Math.max(6, height - 2);
  const panelHeight = Math.max(4, Math.floor(contentHeight / 2));
  const leftWidth = Math.max(20, Math.floor(columns / 2));
  const rightWidth = Math.max(20, columns - leftWidth);

  const statusText = data.isLoading
    ? 'Loading...'
    : data.lastUpdated
      ? `Updated ${formatTime(data.lastUpdated)}`
      : '';

  return (
    <Box flexDirection="column" height={height}>
      {/* Header */}
      <Box justifyContent="space-between" paddingX={1}>
        <Box>
          <Text color={colors.primary} bold>Tino Dashboard</Text>
          {data.daemonConnected && (
            <Text color={colors.success}> [Daemon]</Text>
          )}
        </Box>
        <Box>
          <Text color={colors.muted}>{statusText}  </Text>
          <Text color={colors.muted}>Press Esc to return</Text>
        </Box>
      </Box>

      {/* 2x2 Panel Grid */}
      <Box flexDirection="column" flexGrow={1}>
        {/* Top row */}
        <Box flexDirection="row">
          <MarketOverview width={leftWidth} height={panelHeight} items={data.market} />
          <PositionPanel
            width={rightWidth}
            height={panelHeight}
            positions={data.positions}
            totalPnl={data.totalPnl}
            daemonConnected={data.daemonConnected}
          />
        </Box>
        {/* Bottom row */}
        <Box flexDirection="row">
          <FundingRatePanel width={leftWidth} height={panelHeight} rates={data.fundingRates} />
          <ActiveStrategies
            width={rightWidth}
            height={panelHeight}
            strategies={data.strategies}
            daemonConnected={data.daemonConnected}
          />
        </Box>
      </Box>
    </Box>
  );
});
