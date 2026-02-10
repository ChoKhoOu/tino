import React from 'react';
import { Box, Text } from 'ink';

interface ThinkingViewProps {
  message: string;
}

export function ThinkingView({ message }: ThinkingViewProps) {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) return null;

  const displayMessage = trimmedMessage.length > 200 
    ? trimmedMessage.slice(0, 200) + '...' 
    : trimmedMessage;
  
  return (
    <Box>
      <Text>{displayMessage}</Text>
    </Box>
  );
}
