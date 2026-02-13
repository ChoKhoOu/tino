import { useCallback, useState } from 'react';
import { Box, Text } from 'ink';

import { colors } from '../../theme.js';
import { useKeyboardBinding, useKeyboardMode } from '../../keyboard/use-keyboard.js';
import type { KeyEvent } from '../../keyboard/types.js';
import type { Model } from './provider-catalog.js';
import { PROVIDERS } from './provider-catalog.js';

interface ModelSelectorProps {
  providerId: string;
  models: Model[];
  currentModel?: string;
  onSelect: (modelId: string | null) => void;
}

export function ModelSelector({ providerId, models, currentModel, onSelect }: ModelSelectorProps) {
  const normalizedCurrentModel = providerId === 'ollama' && currentModel?.startsWith('ollama:')
    ? currentModel.replace(/^ollama:/, '')
    : currentModel;

  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (!normalizedCurrentModel) return 0;
    const idx = models.findIndex((model) => model.id === normalizedCurrentModel);
    return idx >= 0 ? idx : 0;
  });

  const provider = PROVIDERS.find((entry) => entry.providerId === providerId);
  const providerName = provider?.displayName ?? providerId;

  useKeyboardMode('popup');

  const handleSelectInput = useCallback((event: KeyEvent) => {
    const { input, key } = event;

    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return true;
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => Math.min(models.length - 1, prev + 1));
      return true;
    }

    if (key.return) {
      if (models.length > 0) {
        onSelect(models[selectedIndex]?.id ?? null);
      }
      return true;
    }

    if (key.escape) {
      onSelect(null);
      return true;
    }

    return false;
  }, [models, onSelect, selectedIndex]);

  useKeyboardBinding('popup', 'any', handleSelectInput);

  if (models.length === 0) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={colors.primary} bold>
          Select model for {providerName}
        </Text>
        <Box marginTop={1}>
          <Text color={colors.muted}>No models available. </Text>
          {providerId === 'ollama' && (
            <Text color={colors.muted}>
              Make sure Ollama is running and you have models downloaded.
            </Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text color={colors.muted}>esc to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Select model for {providerName}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {models.map((model, idx) => {
          const isSelected = idx === selectedIndex;
          const isCurrent = normalizedCurrentModel === model.id;
          const prefix = isSelected ? '> ' : '  ';

          return (
            <Text
              key={model.id}
              color={isSelected ? colors.primaryLight : colors.primary}
              bold={isSelected}
            >
              {prefix}
              {idx + 1}. {model.displayName}
              {isCurrent ? ' ✓' : ''}
            </Text>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>Enter to confirm · esc to go back</Text>
      </Box>
    </Box>
  );
}
