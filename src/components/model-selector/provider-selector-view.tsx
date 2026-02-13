import { useCallback, useState } from 'react';
import { Box, Text } from 'ink';

import { colors } from '../../theme.js';
import { useKeyboardBinding, useKeyboardMode } from '../../keyboard/use-keyboard.js';
import type { KeyEvent } from '../../keyboard/types.js';
import { PROVIDERS } from './provider-catalog.js';

interface ProviderSelectorProps {
  provider?: string;
  onSelect: (providerId: string | null) => void;
}

export function ProviderSelector({ provider, onSelect }: ProviderSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (!provider) return 0;
    const idx = PROVIDERS.findIndex((entry) => entry.providerId === provider);
    return idx >= 0 ? idx : 0;
  });

  useKeyboardMode('popup');

  const handleSelectInput = useCallback((event: KeyEvent) => {
    const { input, key } = event;

    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return true;
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => Math.min(PROVIDERS.length - 1, prev + 1));
      return true;
    }

    if (key.return) {
      onSelect(PROVIDERS[selectedIndex]?.providerId ?? null);
      return true;
    }

    if (key.escape) {
      onSelect(null);
      return true;
    }

    return false;
  }, [onSelect, selectedIndex]);

  useKeyboardBinding('popup', 'any', handleSelectInput);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Select provider
      </Text>
      <Text color={colors.muted}>
        Switch between LLM providers. Applies to this session and future sessions.
      </Text>
      <Box marginTop={1} flexDirection="column">
        {PROVIDERS.map((entry, idx) => {
          const isSelected = idx === selectedIndex;
          const isCurrent = provider === entry.providerId;
          const prefix = isSelected ? '> ' : '  ';

          return (
            <Text
              key={entry.providerId}
              color={isSelected ? colors.primaryLight : colors.primary}
              bold={isSelected}
            >
              {prefix}
              {idx + 1}. {entry.displayName}
              {isCurrent ? ' ✓' : ''}
            </Text>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>Enter to confirm · esc to exit</Text>
      </Box>
    </Box>
  );
}
