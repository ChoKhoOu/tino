import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';
import type { PermissionRequestEvent } from '@/domain/index.js';

interface PermissionPromptProps {
  request: PermissionRequestEvent;
  onResponse: (allowed: boolean) => void;
}

export function PermissionPrompt({ request, onResponse }: PermissionPromptProps) {
  useInput((input) => {
    const key = input.toLowerCase();
    if (key === 'y') {
      onResponse(true);
    } else if (key === 'n') {
      onResponse(false);
    }
  });

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor={colors.warning} padding={1}>
      <Text color={colors.warning} bold>
        ⚠️ Permission Request
      </Text>
      <Box marginTop={1}>
        <Text>
          Tool <Text bold color={colors.primary}>{request.toolId}</Text> wants to access <Text bold color={colors.primary}>{request.resource}</Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>
          Allow this action? (y/n)
        </Text>
      </Box>
    </Box>
  );
}
