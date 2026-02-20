import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

type Step = 'welcome' | 'exchange' | 'api-key' | 'api-secret' | 'validate' | 'pair' | 'summary';

export const EXCHANGES = ['Binance', 'OKX', 'Bybit', 'Skip'];
export const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'Custom'];

export function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = ['welcome', 'exchange', 'pair', 'summary'];
  const idx = steps.indexOf(current);
  const display = idx >= 0 ? idx + 1 : '...';
  return (
    <Box marginBottom={1}>
      <Text color={colors.muted}>Step {display} of {steps.length}</Text>
    </Box>
  );
}

export function WelcomeStep() {
  return (
    <Box flexDirection="column">
      <Text color={colors.primary} bold>Initialize Tino Project</Text>
      <Text color={colors.muted}>{'\n'}This wizard will create:</Text>
      <Text>  .tino/settings.json   - provider and exchange config</Text>
      <Text>  .tino/permissions.json - tool permission rules</Text>
      <Text>  .tino/risk.json        - risk management rules</Text>
      <Text>  TINO.md               - project knowledge base</Text>
      <Text color={colors.muted}>{'\n'}Press Enter to continue</Text>
    </Box>
  );
}

export function ExchangeStep({ selectedIndex }: { selectedIndex: number }) {
  return (
    <Box flexDirection="column">
      <Text color={colors.primary} bold>Select Exchange</Text>
      <Text color={colors.muted}>Choose your exchange for API integration{'\n'}</Text>
      {EXCHANGES.map((ex, i) => (
        <Text key={ex} color={i === selectedIndex ? colors.white : colors.muted} bold={i === selectedIndex}>
          {i === selectedIndex ? '> ' : '  '}{ex}
        </Text>
      ))}
    </Box>
  );
}

export function TextInputStep({ label, value, masked }: { label: string; value: string; masked: boolean }) {
  const display = masked ? '*'.repeat(value.length) : value;
  return (
    <Box flexDirection="column">
      <Text color={colors.primary} bold>{label}</Text>
      <Box>
        <Text color={colors.muted}>{'> '}</Text>
        <Text>{display}</Text>
        <Text color={colors.primary}>|</Text>
      </Box>
      <Text color={colors.muted}>{'\n'}Press Enter to confirm</Text>
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

export function PairStep({ selectedIndex }: { selectedIndex: number }) {
  return (
    <Box flexDirection="column">
      <Text color={colors.primary} bold>Default Trading Pair</Text>
      <Text color={colors.muted}>Choose a default instrument{'\n'}</Text>
      {PAIRS.map((p, i) => (
        <Text key={p} color={i === selectedIndex ? colors.white : colors.muted} bold={i === selectedIndex}>
          {i === selectedIndex ? '> ' : '  '}{p}
        </Text>
      ))}
    </Box>
  );
}

export function SummaryStep({ exchange, pair }: { exchange: string; pair: string }) {
  return (
    <Box flexDirection="column">
      <Text color={colors.primary} bold>Summary</Text>
      <Text>  Exchange:     {exchange || '(none)'}</Text>
      <Text>  Trading Pair: {pair}</Text>
      <Text color={colors.muted}>{'\n'}Press Enter to create project files</Text>
    </Box>
  );
}
