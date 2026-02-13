import { useCallback, useState } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';
import { useKeyboardBinding, useKeyboardMode } from '../keyboard/use-keyboard.js';
import type { KeyEvent } from '../keyboard/types.js';

interface ApiKeyConfirmProps {
  providerName: string;
  onConfirm: (wantsToSet: boolean) => void;
}

export function ApiKeyConfirm({ providerName, onConfirm }: ApiKeyConfirmProps) {
  useKeyboardMode('popup');

  const handleConfirmInput = useCallback((event: KeyEvent) => {
    const key = event.input.toLowerCase();
    if (key === 'y') {
      onConfirm(true);
      return true;
    }
    if (key === 'n') {
      onConfirm(false);
      return true;
    }
    return false;
  }, [onConfirm]);

  useKeyboardBinding('popup', 'any', handleConfirmInput);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Set API Key
      </Text>
      <Text>
        Would you like to set your {providerName} API key? <Text color={colors.muted}>(y/n)</Text>
      </Text>
    </Box>
  );
}

interface ApiKeyInputProps {
  providerName: string;
  apiKeyName: string;
  onSubmit: (apiKey: string | null) => void;
}

export function ApiKeyInput({ providerName, apiKeyName, onSubmit }: ApiKeyInputProps) {
  const [value, setValue] = useState('');

  useKeyboardMode('input');

  const handleInput = useCallback((event: KeyEvent) => {
    const { input, key } = event;
    if (key.return) {
      onSubmit(value.trim() || null);
      return true;
    }
    if (key.escape) {
      onSubmit(null);
      return true;
    }
    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return true;
    }
    if (input && !key.ctrl && !key.meta) {
      setValue((prev) => prev + input);
      return true;
    }
    return false;
  }, [onSubmit, value]);

  useKeyboardBinding('input', 'any', handleInput);

  // Mask the API key for display
  const maskedValue = value.length > 0 ? '*'.repeat(value.length) : '';

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>
        Enter {providerName} API Key
      </Text>
      <Text color={colors.muted}>
        ({apiKeyName})
      </Text>
      <Box marginTop={1}>
        <Text color={colors.primary}>{'> '}</Text>
        <Text>{maskedValue}</Text>
        <Text color={colors.muted}>█</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>Enter to confirm · Esc to cancel</Text>
      </Box>
    </Box>
  );
}
