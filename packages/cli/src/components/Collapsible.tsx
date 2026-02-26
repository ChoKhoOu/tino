import React from 'react';
import { Box, Text } from 'ink';

interface CollapsibleProps {
  summary: string;
  children: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
}

export function Collapsible({ summary, children, expanded = false, onToggle }: CollapsibleProps) {
  const indicator = expanded ? '▼' : '▶';

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{indicator} </Text>
        <Text bold>{summary}</Text>
        {onToggle && <Text dimColor> (press enter to {expanded ? 'collapse' : 'expand'})</Text>}
      </Box>
      {expanded && (
        <Box paddingLeft={2} flexDirection="column">
          {children}
        </Box>
      )}
    </Box>
  );
}
