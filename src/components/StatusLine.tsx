import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { componentTokens, getContextColor, colors } from '../theme.js';

export interface StatusLineProps {
  modelName: string;
  contextPercent: number;
  daemonStatus: 'not-configured' | 'starting' | 'connected' | 'error' | 'stopped';
  cost: number;
  duration: number | null;
}

export function StatusLine({
  modelName,
  contextPercent,
  daemonStatus,
  cost,
  duration,
}: StatusLineProps) {
  const { bg, fg, separator } = componentTokens.statusLine;

  const formatCost = (c: number) => `$${c.toFixed(4)}`;
  
  const formatDuration = (d: number | null) => {
    if (d === null) return '--m --s';
    const m = Math.floor(d / 60);
    const s = Math.floor(d % 60);
    return `${m}m ${s}s`;
  };

  const renderDaemonStatus = () => {
    switch (daemonStatus) {
      case 'starting':
        return (
          <>
            <Text color={colors.primary}><Spinner type="dots" /> </Text>
            <Text color={fg}>starting</Text>
          </>
        );
      case 'connected':
        return (
          <>
            <Text color={colors.success}>● </Text>
            <Text color={fg}>connected</Text>
          </>
        );
      case 'error':
        return (
          <>
            <Text color={colors.error}>○ </Text>
            <Text color={fg}>error</Text>
          </>
        );
      case 'stopped':
        return (
          <>
            <Text color={colors.mutedDark}>○ </Text>
            <Text color={fg}>stopped</Text>
          </>
        );
      default:
        return (
          <>
            <Text color={colors.mutedDark}>○ </Text>
            <Text color={fg}>not configured</Text>
          </>
        );
    }
  };

  const Separator = () => <Text color={separator}> │ </Text>;

  return (
    <Box width="100%" backgroundColor={bg} paddingX={1}>
      <Text color={fg}>{modelName}</Text>
      <Separator />
      
      <Text color={fg}>Context: </Text>
      <Text color={getContextColor(contextPercent)}>{Math.round(contextPercent)}%</Text>
      <Separator />
      
      <Text color={fg}>Daemon: </Text>
      {renderDaemonStatus()}
      <Separator />
      
      <Text color={fg}>{formatCost(cost)}</Text>
      <Separator />
      
      <Text color={fg}>{formatDuration(duration)}</Text>
    </Box>
  );
}
