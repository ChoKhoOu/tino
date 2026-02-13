import { useCallback, useState } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';
import type { SessionMetadata } from '../session/session.js';
import { useKeyboardBinding, useKeyboardMode } from '../keyboard/use-keyboard.js';
import type { KeyEvent } from '../keyboard/types.js';

interface SessionPickerProps {
  sessions: SessionMetadata[];
  onSelect: (sessionId: string | null) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function truncateTitle(title: string, max: number): string {
  return title.length > max ? title.slice(0, max - 1) + '…' : title;
}

export function SessionPicker({ sessions, onSelect }: SessionPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useKeyboardMode('popup');

  const handlePickerInput = useCallback((event: KeyEvent) => {
    const { input, key } = event;
    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return true;
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => Math.min(sessions.length - 1, prev + 1));
      return true;
    }
    if (key.return) {
      if (sessions.length > 0) {
        onSelect(sessions[selectedIndex].id);
      }
      return true;
    }
    if (key.escape) {
      onSelect(null);
      return true;
    }
    return false;
  }, [onSelect, selectedIndex, sessions]);

  useKeyboardBinding('popup', 'any', handlePickerInput);

  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={colors.primary} bold>Resume session</Text>
        <Box marginTop={1}>
          <Text color={colors.muted}>No previous sessions found.</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.muted}>esc to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colors.primary} bold>Resume session</Text>
      <Text color={colors.muted}>
        Select a previous session to resume or fork.
      </Text>
      <Box marginTop={1} flexDirection="column">
        {sessions.map((s, idx) => {
          const isSelected = idx === selectedIndex;
          const prefix = isSelected ? '> ' : '  ';
          const title = truncateTitle(s.title, 40);
          const date = formatDate(s.updatedAt);

          return (
            <Text
              key={s.id}
              color={isSelected ? colors.primaryLight : colors.primary}
              bold={isSelected}
            >
              {prefix}{idx + 1}. {title}
              <Text color={colors.muted}> {date} · {s.messageCount} msgs</Text>
            </Text>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color={colors.muted}>Enter to select · esc to cancel</Text>
      </Box>
    </Box>
  );
}
