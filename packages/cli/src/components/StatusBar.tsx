import React from 'react';
import { Box, Text } from 'ink';

export type EngineStatus = 'healthy' | 'reconnecting' | 'offline';
export type AIStatus = 'connected' | 'degraded' | 'offline';
export type AppState = 'idle' | 'streaming' | 'backtest_running' | 'live_session';

interface StatusBarProps {
  modelName: string;
  tokenUsage: { input: number; output: number };
  engineStatus: EngineStatus;
  aiStatus: AIStatus;
  appState?: AppState;
  liveSessionInfo?: {
    state: string;
    tradingPair?: string;
    currentPnl?: string;
  };
}

function formatTokenCount(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}K`;
}

const engineColors: Record<EngineStatus, string> = {
  healthy: 'green',
  reconnecting: 'yellow',
  offline: 'red',
};

const aiColors: Record<AIStatus, string> = {
  connected: 'green',
  degraded: 'yellow',
  offline: 'red',
};

function getLiveStateColor(state: string): string {
  switch (state) {
    case 'RUNNING':
      return 'green';
    case 'PAUSED':
      return 'yellow';
    case 'STOPPED':
      return 'red';
    default:
      return 'cyan';
  }
}

function getKeybindingHints(appState: AppState): string {
  switch (appState) {
    case 'streaming':
      return 'Ctrl+C cancel | Ctrl+K kill switch';
    case 'backtest_running':
      return 'Ctrl+C cancel backtest | Ctrl+K kill switch';
    case 'live_session':
      return 'Ctrl+K kill switch | /kill emergency stop';
    default:
      return '/help commands | Ctrl+C cancel | Ctrl+K kill switch';
  }
}

export function StatusBar({
  modelName,
  tokenUsage,
  engineStatus,
  aiStatus,
  appState = 'idle',
  liveSessionInfo,
}: StatusBarProps) {
  const columns = process.stdout.columns || 80;
  const separator = '─'.repeat(columns);

  return (
    <Box flexDirection="column" marginTop={0}>
      <Text dimColor color="gray">
        {separator}
      </Text>
      <Box paddingX={1} gap={1} flexWrap="wrap">
        <Text>{modelName}</Text>
        <Text dimColor>|</Text>
        <Text>
          Token: {formatTokenCount(tokenUsage.input)}/{formatTokenCount(tokenUsage.output)}
        </Text>
        <Text dimColor>|</Text>
        <Text>
          Engine: <Text color={engineColors[engineStatus]}>{engineStatus}</Text>
        </Text>
        <Text dimColor>|</Text>
        <Text>
          AI: <Text color={aiColors[aiStatus]}>{aiStatus}</Text>
        </Text>
        {liveSessionInfo && (
          <>
            <Text dimColor>|</Text>
            <Text>
              Live: <Text color={getLiveStateColor(liveSessionInfo.state)}>{liveSessionInfo.state}</Text>
              {liveSessionInfo.tradingPair && (
                <Text> {liveSessionInfo.tradingPair}</Text>
              )}
              {liveSessionInfo.currentPnl && (
                <Text> PnL: {liveSessionInfo.currentPnl}</Text>
              )}
            </Text>
          </>
        )}
        <Text dimColor>|</Text>
        <Text dimColor>{getKeybindingHints(appState)}</Text>
      </Box>
    </Box>
  );
}
