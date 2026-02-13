import { useCallback, useState } from 'react';
import { Box, Text } from 'ink';

import { colors } from '../../theme.js';
import { useKeyboardBinding, useKeyboardMode } from '../../keyboard/use-keyboard.js';
import type { KeyEvent } from '../../keyboard/types.js';
import { PROVIDERS } from './provider-catalog.js';

interface ModelInputFieldProps {
  providerId: string;
  currentModel?: string;
  onSubmit: (modelId: string | null) => void;
}

export function ModelInputField({ providerId, currentModel, onSubmit }: ModelInputFieldProps) {
  const initialValue = currentModel?.startsWith('openrouter:')
    ? currentModel.replace(/^openrouter:/, '')
    : '';

  const [inputValue, setInputValue] = useState(initialValue);
  const provider = PROVIDERS.find((entry) => entry.providerId === providerId);
  const providerName = provider?.displayName ?? providerId;

  useKeyboardMode('input');

  const handleInput = useCallback((event: KeyEvent) => {
    const { input, key } = event;

    if (key.return) {
      const trimmed = inputValue.trim();
      if (trimmed) {
        onSubmit(trimmed);
      }
      return true;
    }

    if (key.escape) {
      onSubmit(null);
      return true;
    }

    if (key.backspace || key.delete) {
      setInputValue((prev) => prev.slice(0, -1));
      return true;
    }

    if (input && !key.ctrl && !key.meta) {
      setInputValue((prev) => prev + input);
      return true;
    }

    return false;
  }, [inputValue, onSubmit]);

  useKeyboardBinding('input', 'any', handleInput);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Enter model name for {providerName}
      </Text>
      <Text color={colors.muted}>
        Type or paste the model name from openrouter.ai/models
      </Text>
      <Box marginTop={1}>
        <Text color={colors.primaryLight}>{'> '}</Text>
        <Text color={colors.primary}>{inputValue}</Text>
        <Text color={colors.primaryLight}>_</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={colors.muted}>
          Examples: anthropic/claude-3.5-sonnet, openai/gpt-4-turbo, meta-llama/llama-3-70b
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>Enter to confirm · esc to go back</Text>
      </Box>
    </Box>
  );
}
