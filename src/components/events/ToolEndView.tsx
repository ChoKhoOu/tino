import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme.js';
import { formatToolName, formatArgs, formatDuration, truncateResult } from './utils.js';

interface ToolEndViewProps {
  toolId: string;
  args: Record<string, unknown>;
  result: string;
  duration: number;
}

export function ToolEndView({ toolId, args, result, duration }: ToolEndViewProps) {
  // Parse result to get a summary
  let summary = 'Received data';
  
  // Special handling for skill tool
  if (toolId === 'skill') {
    const skillName = args.skill as string;
    summary = `Loaded ${skillName} skill`;
  } else {
    try {
      const parsed = JSON.parse(result);
      if (parsed.data) {
        if (Array.isArray(parsed.data)) {
          summary = `Received ${parsed.data.length} items`;
        } else if (typeof parsed.data === 'object') {
          const keys = Object.keys(parsed.data).filter(k => !k.startsWith('_')); // Exclude _errors
          
          // Tool-specific summaries
          if (toolId === 'financial_search') {
            summary = keys.length === 1 
              ? `Called 1 data source` 
              : `Called ${keys.length} data sources`;
          } else if (toolId === 'web_search') {
            summary = `Did 1 search`;
          } else {
            summary = `Received ${keys.length} fields`;
          }
        }
      }
    } catch {
      // Not JSON, use truncated result
      summary = truncateResult(result, 50);
    }
  }
  
  return (
    <Box flexDirection="column">
      <Box>
        <Text>⏺ </Text>
        <Text>{formatToolName(toolId)}</Text>
        <Text color={colors.muted}>({formatArgs(args)})</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.muted}>⎿  </Text>
        <Text>{summary}</Text>
        <Text color={colors.muted}> in {formatDuration(duration)}</Text>
      </Box>
    </Box>
  );
}
