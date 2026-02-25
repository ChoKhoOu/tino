import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

export const AI_PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)' },
  { id: 'openai', label: 'OpenAI (GPT)' },
  { id: 'skip', label: 'Skip (Free Tier / Demo)' },
];

export const EXCHANGES = [
  { id: 'binance', label: 'Binance' },
  { id: 'okx', label: 'OKX' },
  { id: 'bybit', label: 'Bybit' },
  { id: 'skip', label: 'Skip for now' },
];

export function StepHeader({ step, title, description }: { step: number; title: string; description?: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={colors.primary} bold>Step {step} of 3: {title}</Text>
      {description && <Text color={colors.muted}>{description}</Text>}
    </Box>
  );
}

export function SelectionList({ items, selectedIndex }: { items: string[]; selectedIndex: number }) {
  return (
    <Box flexDirection="column">
      {items.map((item, i) => (
        <Text key={item} color={i === selectedIndex ? colors.white : colors.muted} bold={i === selectedIndex}>
          {i === selectedIndex ? '> ' : '  '}{item}
        </Text>
      ))}
      <Text color={colors.muted}>{'\n'}Use ↑/↓ to navigate, Enter to select</Text>
    </Box>
  );
}

export function TextInputStep({ label, value, masked }: { label: string; value: string; masked: boolean }) {
  const display = masked ? '*'.repeat(value.length) : value;
  return (
    <Box flexDirection="column">
      <Text bold>{label}</Text>
      <Box>
        <Text color={colors.muted}>{'> '}</Text>
        <Text>{display}</Text>
        <Text color={colors.primary}>|</Text>
      </Box>
      <Text color={colors.muted}>{'\n'}Press Enter to confirm, Esc to go back</Text>
    </Box>
  );
}

export function ValidateStep({ validating, error }: { validating: boolean; error: string }) {
  if (validating) {
    return (
      <Box flexDirection="column">
        <Text color={colors.warning}>Validating API credentials...</Text>
      </Box>
    );
  }
  if (error) {
    return (
      <Box flexDirection="column">
        <Text color={colors.error}>Validation failed: {error}</Text>
        <Text color={colors.muted}>{'\n'}Press Enter to re-enter credentials</Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column">
      <Text color={colors.success}>API credentials valid</Text>
    </Box>
  );
}

export function CompleteStep() {
  return (
    <Box flexDirection="column">
      <Text color={colors.success} bold>Setup Complete!</Text>
      <Text color={colors.muted}>{'\n'}Tino is ready. Try asking your first question:</Text>
      <Box paddingLeft={2} paddingTop={1} flexDirection="column">
        <Text color={colors.primary}>"How has BTC performed recently?"</Text>
        <Text color={colors.primary}>"Write a momentum strategy for ETH"</Text>
        <Text color={colors.primary}>"Check my Binance portfolio balance"</Text>
      </Box>
      <Text color={colors.muted}>{'\n'}Press Enter to start chatting.</Text>
    </Box>
  );
}
