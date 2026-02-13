import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { componentTokens, getContextColor, colors } from '../theme.js';
import type { PermissionMode } from '../domain/permission-mode.js';

export interface StatusLineProps {
  modelName: string;
  contextPercent: number;
  daemonStatus: 'not-configured' | 'starting' | 'connected' | 'error' | 'stopped';
  cost: number;
  duration: number | null;
  permissionMode?: PermissionMode;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/** Isolated spinner — internal state changes never propagate to parent */
const DaemonSpinner = React.memo(function DaemonSpinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 200);
    return () => clearInterval(id);
  }, []);
  return <Text color={colors.primary}>{SPINNER_FRAMES[frame]} </Text>;
});

/** Module-level component — stable type reference prevents remount on parent re-render */
const Separator = React.memo(function Separator() {
  return <Text color={componentTokens.statusLine.separator}> │ </Text>;
});

function renderDaemonStatus(status: StatusLineProps['daemonStatus'], fg: string) {
  switch (status) {
    case 'starting':
      return <><DaemonSpinner /><Text color={fg}>starting</Text></>;
    case 'connected':
      return <><Text color={colors.success}>● </Text><Text color={fg}>connected</Text></>;
    case 'error':
      return <><Text color={colors.error}>○ </Text><Text color={fg}>error</Text></>;
    case 'stopped':
      return <><Text color={colors.mutedDark}>○ </Text><Text color={fg}>stopped</Text></>;
    default:
      return <><Text color={colors.mutedDark}>○ </Text><Text color={fg}>not configured</Text></>;
  }
}

function formatCost(c: number) { return `$${c.toFixed(4)}`; }

function formatDuration(d: number | null) {
  if (d === null) return '--m --s';
  const m = Math.floor(d / 60);
  const s = Math.floor(d % 60);
  return `${m}m ${s}s`;
}

/** Memoized — only re-renders when props actually change */
export const StatusLine = React.memo(function StatusLine({
  modelName,
  contextPercent,
  daemonStatus,
  cost,
  duration,
  permissionMode,
}: StatusLineProps) {
  const { bg, fg } = componentTokens.statusLine;

  return (
    <Box width="100%" backgroundColor={bg} paddingX={1}>
      <Text color={colors.primary}>🦊</Text>
      <Separator />
      <Text color={fg}>{modelName}</Text>
      <Separator />
      
      <Text color={fg}>Context: </Text>
      <Text color={getContextColor(contextPercent)}>{Math.round(contextPercent)}%</Text>
      <Separator />
      
      <Text color={fg}>Daemon: </Text>
      {renderDaemonStatus(daemonStatus, fg)}
      <Separator />

      {permissionMode && permissionMode !== 'default' && (
        <>
          <Text color={colors.accent}>Mode: {permissionMode === 'auto-accept' ? 'Auto Accept' : permissionMode === 'plan' ? 'Plan' : 'Delegate'}</Text>
          <Separator />
        </>
      )}
      
      <Text color={fg}>{formatCost(cost)}</Text>
      <Separator />
      
      <Text color={fg}>{formatDuration(duration)}</Text>
    </Box>
  );
});
