import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors } from '../theme.js';

export interface DaemonStatusBarProps {
  status: string;
  info?: {
    pythonVersion: string;
    nautilusVersion: string;
  };
}

export function DaemonStatusBar({ status, info }: DaemonStatusBarProps) {
  if (status === 'starting') {
    return (
      <Box paddingX={1}>
        <Text color={colors.primary}>
          <Spinner type="dots" />
        </Text>
        <Text color={colors.muted}> Daemon starting...</Text>
      </Box>
    );
  }

  if (status === 'connected') {
    return (
      <Box paddingX={1}>
        <Text color={colors.success}>● </Text>
        <Text color={colors.muted}>Daemon connected</Text>
        {info && (
          <Text color={colors.mutedDark}>
            {' '}
            (v{info.nautilusVersion} / Py {info.pythonVersion})
          </Text>
        )}
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box paddingX={1}>
        <Text color={colors.error}>○ </Text>
        <Text color={colors.muted}>Daemon error</Text>
      </Box>
    );
  }

  if (status === 'stopped') {
    return (
      <Box paddingX={1}>
        <Text color={colors.mutedDark}>○ </Text>
        <Text color={colors.mutedDark}>Daemon stopped</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1}>
      <Text color={colors.mutedDark}>○ </Text>
      <Text color={colors.mutedDark}>Daemon not configured</Text>
    </Box>
  );
}
