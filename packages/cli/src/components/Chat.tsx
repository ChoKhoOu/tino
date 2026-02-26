import React from 'react';
import { Box, Text } from 'ink';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

interface ChatProps {
  messages: ChatMessage[];
  maxVisible?: number;
}

function formatCodeBlocks(content: string): React.ReactNode[] {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      // Extract language and code
      const lines = part.slice(3, -3).split('\n');
      const lang = lines[0]?.trim() || '';
      const code = lines.slice(lang ? 1 : 0).join('\n');
      return (
        <Box key={i} flexDirection="column" marginY={1} paddingX={1} borderStyle="single" borderColor="gray">
          {lang && <Text color="gray" dimColor>{lang}</Text>}
          <Text color="green">{code}</Text>
        </Box>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const roleConfig = {
    user: { color: 'cyan' as const, prefix: '> ' },
    assistant: { color: 'green' as const, prefix: '  ' },
    system: { color: 'yellow' as const, prefix: '! ' },
  };

  const config = roleConfig[message.role];

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={config.color} bold>
          {message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Tino' : 'System'}
        </Text>
        {message.timestamp && (
          <Text color="gray" dimColor>
            {' '}
            {message.timestamp.toLocaleTimeString()}
          </Text>
        )}
      </Box>
      <Box paddingLeft={2} flexDirection="column">
        {formatCodeBlocks(message.content)}
      </Box>
    </Box>
  );
}

export function Chat({ messages, maxVisible = 50 }: ChatProps) {
  const visibleMessages = messages.slice(-maxVisible);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleMessages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
    </Box>
  );
}
