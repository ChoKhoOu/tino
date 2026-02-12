import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';
import type { PermissionRequestEvent } from '@/domain/index.js';

interface PermissionPromptProps {
  request: PermissionRequestEvent;
  onResponse: (allowed: boolean, alwaysAllow?: boolean) => void;
}

function summarizeArgs(args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return '';
  const json = JSON.stringify(args);
  return json.length > 100 ? json.slice(0, 100) + '…' : json;
}

export function PermissionPrompt({ request, onResponse }: PermissionPromptProps) {
  useInput((input) => {
    const key = input.toLowerCase();
    if (key === 'y') onResponse(true);
    else if (key === 'n') onResponse(false);
    else if (key === 'a') onResponse(true, true);
  });

  const argsSummary = summarizeArgs(request.args);

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor={colors.warning} padding={1}>
      <Text color={colors.warning} bold>
        ⚠️ Permission Request
      </Text>
      <Box marginTop={1}>
        <Text>
          Tool <Text bold color={colors.primary}>{request.toolId}</Text> wants to access <Text bold color={colors.primary}>{request.resource || 'resources'}</Text>
        </Text>
      </Box>
      {argsSummary && (
        <Box marginTop={1}>
          <Text color={colors.muted}>Args: {argsSummary}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={colors.muted}>
          Allow? [Y]es / [N]o / [A]lways allow this tool
        </Text>
      </Box>
    </Box>
  );
}
