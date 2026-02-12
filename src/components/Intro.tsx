import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';
import packageJson from '../../package.json';
import { getProviderDisplayName } from '../utils/env.js';
import { getModelDisplayName } from './ModelSelector.js';

interface IntroProps {
  provider: string;
  model: string;
}

export function Intro({ provider, model }: IntroProps) {
  return (
    <Box flexDirection="column" marginTop={1} marginBottom={1}>
      <Box flexDirection="column" borderStyle="round" borderColor={colors.mutedDark} paddingX={1}>
        <Text>
          <Text color={colors.primary} bold>✻ Tino</Text>
          <Text color={colors.muted}> v{packageJson.version}</Text>
        </Text>
        <Text color={colors.muted}>
          {getProviderDisplayName(provider)} · <Text color={colors.primary}>{getModelDisplayName(model)}</Text>
          <Text color={colors.muted}> · Type /model to change.</Text>
        </Text>
      </Box>
    </Box>
  );
}
