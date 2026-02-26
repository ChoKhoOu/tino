import React from 'react';
import { Box, Text } from 'ink';

interface ModeBannerProps {
  mode: 'paper' | 'live';
  exchangeAccount?: string;
}

export function ModeBanner({ mode, exchangeAccount }: ModeBannerProps) {
  if (mode === 'paper') {
    return (
      <Box borderStyle="single" borderColor="green" justifyContent="center" paddingX={1}>
        <Text color="green">PAPER TRADING (simulated)</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="red"
      justifyContent="center"
      alignItems="center"
      paddingX={1}
    >
      <Text color="red" bold>
        LIVE TRADING (REAL MONEY)
      </Text>
      {exchangeAccount && (
        <Text color="red">{exchangeAccount}</Text>
      )}
    </Box>
  );
}
