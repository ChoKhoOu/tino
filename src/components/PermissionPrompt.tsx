import { useCallback, useMemo, useRef, useState } from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../theme.js';
import type { PermissionRequestEvent } from '@/domain/index.js';
import { useKeyboardBinding, useKeyboardMode } from '@/keyboard/use-keyboard.js';

interface PermissionPromptProps {
  request: PermissionRequestEvent;
  onResponse: (allowed: boolean, alwaysAllow?: boolean) => void;
}

function summarizeArgs(args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return '';
  const json = JSON.stringify(args);
  return json.length > 100 ? json.slice(0, 100) + '…' : json;
}

type PermissionChoice = {
  label: string;
  onConfirm: (callback: PermissionPromptProps['onResponse']) => void;
};

const TAB_CHOICES: PermissionChoice[] = [
  { label: 'Allow Once', onConfirm: (callback) => callback(true) },
  { label: 'Always Allow', onConfirm: (callback) => callback(true, true) },
  { label: 'Deny', onConfirm: (callback) => callback(false) },
];

export function PermissionPrompt({ request, onResponse }: PermissionPromptProps) {
  const [selectedTab, setSelectedTab] = useState(0);
  const selectedTabRef = useRef(0);
  useKeyboardMode('permission');

  const maxIndex = TAB_CHOICES.length - 1;

  const handleMoveLeft = useCallback(() => {
    setSelectedTab((current) => {
      const next = current === 0 ? maxIndex : current - 1;
      selectedTabRef.current = next;
      return next;
    });
    return true;
  }, [maxIndex]);

  const handleMoveRight = useCallback(() => {
    setSelectedTab((current) => {
      const next = current === maxIndex ? 0 : current + 1;
      selectedTabRef.current = next;
      return next;
    });
    return true;
  }, [maxIndex]);

  const handleConfirm = useCallback(() => {
    TAB_CHOICES[selectedTabRef.current]?.onConfirm(onResponse);
    return true;
  }, [onResponse]);

  useKeyboardBinding('permission', 'left', handleMoveLeft);
  useKeyboardBinding('permission', 'right', handleMoveRight);
  useKeyboardBinding('permission', 'return', handleConfirm);

  const argsSummary = summarizeArgs(request.args);
  const selectedLabel = useMemo(() => TAB_CHOICES[selectedTab]?.label ?? 'Allow Once', [selectedTab]);

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor={componentTokens.popup.border}
      padding={1}
    >
      <Text color={colors.warning} bold>
        ⚠️ Permission Request
      </Text>
      <Box marginTop={1}>
        {TAB_CHOICES.map((choice, index) => {
          const isSelected = index === selectedTab;
          return (
            <Box key={choice.label} marginRight={1}>
              <Text
                bold={isSelected}
                color={isSelected ? colors.white : colors.muted}
                backgroundColor={isSelected ? componentTokens.popup.selected : undefined}
              >
                {isSelected ? `[${choice.label}]` : ` ${choice.label} `}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text>
          Tool <Text bold color={colors.primary}>{request.toolId}</Text> wants to access <Text bold color={colors.primary}>{request.resource || 'resources'}</Text>
        </Text>
      </Box>
      {argsSummary && (
        <Box marginTop={1}>
          <Text color={colors.muted}>Args: {argsSummary}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={colors.muted}>
          Use ←/→ to switch tabs, Enter to confirm ({selectedLabel})
        </Text>
      </Box>
    </Box>
  );
}
