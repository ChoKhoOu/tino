import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../theme.js';
import type { StyleOption } from '../hooks/useStylePicker.js';

interface StylePickerProps {
  isOpen: boolean;
  selectedIndex: number;
  styles: StyleOption[];
}

const VISIBLE_COUNT = 5;

export function StylePicker({ isOpen, selectedIndex, styles }: StylePickerProps) {
  if (!isOpen || styles.length === 0) {
    return null;
  }

  let start = Math.max(0, selectedIndex - Math.floor(VISIBLE_COUNT / 2));
  if (start + VISIBLE_COUNT > styles.length) {
    start = Math.max(0, styles.length - VISIBLE_COUNT);
  }

  const visibleItems = styles.slice(start, start + VISIBLE_COUNT);
  const showUpArrow = start > 0;
  const showDownArrow = start + VISIBLE_COUNT < styles.length;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={componentTokens.popup.border}
      paddingX={1}
      marginBottom={0}
      width={50}
    >
      <Box marginBottom={0}>
        <Text color={colors.muted} bold>Output Style</Text>
      </Box>

      {showUpArrow && (
        <Box justifyContent="center">
          <Text color={colors.muted}>▲</Text>
        </Box>
      )}

      {visibleItems.map((style, index) => {
        const realIndex = start + index;
        const isSelected = realIndex === selectedIndex;
        const marker = style.isCurrent ? '✓ ' : '  ';

        return (
          <Box key={style.name} flexDirection="column">
            <Box flexDirection="row">
              <Text
                color={style.isCurrent ? colors.success : isSelected ? colors.white : colors.white}
                backgroundColor={isSelected ? componentTokens.popup.selected : undefined}
                bold={isSelected}
              >
                {marker}{style.name}
              </Text>
            </Box>
            <Box marginLeft={2}>
              <Text
                color={isSelected ? colors.white : colors.muted}
                backgroundColor={isSelected ? componentTokens.popup.selected : undefined}
                dimColor={!isSelected}
              >
                {style.description}
              </Text>
            </Box>
          </Box>
        );
      })}

      {showDownArrow && (
        <Box justifyContent="center">
          <Text color={colors.muted}>▼</Text>
        </Box>
      )}
    </Box>
  );
}
