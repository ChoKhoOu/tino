import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownText } from './MarkdownText.js';
import { Spinner } from './Spinner.js';

interface StreamingMessageProps {
  content: string;
  isStreaming: boolean;
  label?: string;
}

export function StreamingMessage({ content, isStreaming, label = 'Generating...' }: StreamingMessageProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="green" bold>
        Tino
      </Text>
      <Box paddingLeft={2} flexDirection="column">
        {content ? (
          <>
            <MarkdownText>{content}</MarkdownText>
            {isStreaming && (
              <Box marginTop={1}>
                <Spinner label={label} />
              </Box>
            )}
          </>
        ) : isStreaming ? (
          <Spinner label={label} />
        ) : null}
      </Box>
    </Box>
  );
}
