import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownText } from './MarkdownText.js';

interface MessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function Message({ role, content, timestamp }: MessageProps) {
  const labelMap = {
    user: { name: 'You', color: 'cyan' as const },
    assistant: { name: 'Tino', color: 'green' as const },
    system: { name: 'System', color: 'yellow' as const },
  };

  const { name, color } = labelMap[role];

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={color} bold>
          {name}
        </Text>
        {timestamp && (
          <Text color="gray" dimColor>
            {' '}
            {formatTime(timestamp)}
          </Text>
        )}
      </Box>
      <Box paddingLeft={2}>
        {role === 'assistant' ? (
          <MarkdownText>{content}</MarkdownText>
        ) : role === 'system' ? (
          <Text dimColor>{content}</Text>
        ) : (
          <Text>{content}</Text>
        )}
      </Box>
    </Box>
  );
}
