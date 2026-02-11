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
  if (status === 'not-configured') {
    return null;
  }

  if (status === 'starting') {
    return (
      <Box marginTop={1}>
        <Text color={colors.primary}>
          <Spinner type="dots" />
        </Text>
        <Text color={colors.primary}> Daemon: Starting...</Text>
      </Box>
    );
  }

  if (status === 'connected') {
    return (
      <Box marginTop={1}>
        <Text color={colors.success}>● </Text>
        <Text color={colors.success}>Daemon: Connected</Text>
        {info && (
          <Text color={colors.muted}>
            {' '}
            (v{info.nautilusVersion} / Py {info.pythonVersion})
          </Text>
        )}
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box marginTop={1}>
        <Text color={colors.error}>○ </Text>
        <Text color={colors.error}>Daemon: Error</Text>
      </Box>
    );
  }

  if (status === 'stopped') {
    return (
      <Box marginTop={1}>
        <Text color={colors.muted}>○ </Text>
        <Text color={colors.muted}>Daemon: Stopped</Text>
      </Box>
    );
  }

  return null;
}
