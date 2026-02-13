import { Box, Text } from 'ink';
import { componentTokens, colors } from '../theme.js';
import type { HistoryItem } from './HistoryItemView.js';

interface RewindMenuProps {
  isOpen: boolean;
  selectedIndex: number;
  turns: HistoryItem[];
  subMenuOpen: boolean;
  subMenuIndex: number;
}

export const REWIND_OPTIONS = [
  'Restore code and conversation',
  'Restore conversation only',
  'Restore code only',
  'Summarize from here',
  'Cancel',
] as const;

const VISIBLE_COUNT = 5;

function truncatePrompt(query: string, max = 46): string {
  return query.length > max ? `${query.slice(0, max - 3)}...` : query;
}

function formatTime(startTime?: number): string {
  if (!startTime) return '--:--';
  const date = new Date(startTime);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function RewindMenu({ isOpen, selectedIndex, turns, subMenuOpen, subMenuIndex }: RewindMenuProps) {
  if (!isOpen || turns.length === 0) return null;

  let start = Math.max(0, selectedIndex - Math.floor(VISIBLE_COUNT / 2));
  if (start + VISIBLE_COUNT > turns.length) {
    start = Math.max(0, turns.length - VISIBLE_COUNT);
  }

  const visibleTurns = turns.slice(start, start + VISIBLE_COUNT);
  const showUpArrow = start > 0;
  const showDownArrow = start + VISIBLE_COUNT < turns.length;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={componentTokens.popup.border}
      backgroundColor={componentTokens.rewindMenu.bg}
      paddingX={1}
      width={72}
    >
      <Text color={colors.muted} bold>Rewind Session</Text>
      <Text color={colors.muted}>Select a turn to restore or summarize</Text>

      {showUpArrow && (
        <Box justifyContent="center">
          <Text color={colors.muted}>▲</Text>
        </Box>
      )}

      {visibleTurns.map((turn, idx) => {
        const realIndex = start + idx;
        const isSelected = realIndex === selectedIndex;
        return (
          <Text
            key={turn.id}
            color={colors.white}
            backgroundColor={isSelected ? componentTokens.rewindMenu.selected : undefined}
            bold={isSelected}
          >
            {isSelected ? '> ' : '  '}
            {turn.id} {truncatePrompt(turn.query)}
            <Text color={colors.muted}> · {formatTime(turn.startTime)}</Text>
          </Text>
        );
      })}

      {showDownArrow && (
        <Box justifyContent="center">
          <Text color={colors.muted}>▼</Text>
        </Box>
      )}

      {subMenuOpen && (
        <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor={componentTokens.popup.border} paddingX={1}>
          {REWIND_OPTIONS.map((label, idx) => (
            <Text
              key={label}
              color={colors.white}
              backgroundColor={idx === subMenuIndex ? componentTokens.rewindMenu.selected : undefined}
              bold={idx === subMenuIndex}
            >
              {idx === subMenuIndex ? '> ' : '  '}
              {label}
            </Text>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={colors.muted}>↑↓ navigate · Enter select · Esc close</Text>
      </Box>
    </Box>
  );
}
