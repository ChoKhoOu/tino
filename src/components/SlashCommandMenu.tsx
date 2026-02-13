import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../theme.js';
import type { SlashCommandOption } from '../hooks/useSlashCommandMenu.js';

interface SlashCommandMenuProps {
  isOpen: boolean;
  selectedIndex: number;
  filteredCommands: SlashCommandOption[];
}

const VISIBLE_COUNT = 5;

export function SlashCommandMenu({
  isOpen,
  selectedIndex,
  filteredCommands,
}: SlashCommandMenuProps) {
  if (!isOpen || filteredCommands.length === 0) {
    return null;
  }

  // Calculate window to keep selectedIndex in view
  let start = Math.max(0, selectedIndex - Math.floor(VISIBLE_COUNT / 2));
  if (start + VISIBLE_COUNT > filteredCommands.length) {
    start = Math.max(0, filteredCommands.length - VISIBLE_COUNT);
  }
  
  const visibleItems = filteredCommands.slice(start, start + VISIBLE_COUNT);
  const showUpArrow = start > 0;
  const showDownArrow = start + VISIBLE_COUNT < filteredCommands.length;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={componentTokens.popup.border}
      paddingX={1}
      marginBottom={0}
      width={60}
    >
      {showUpArrow && (
        <Box justifyContent="center">
          <Text color={colors.muted}>▲</Text>
        </Box>
      )}
      
      {visibleItems.map((item, index) => {
        const realIndex = start + index;
        const isSelected = realIndex === selectedIndex;
        
        return (
          <Box key={item.command} flexDirection="row" justifyContent="space-between">
            <Box>
              <Text
                color={isSelected ? colors.white : colors.white}
                backgroundColor={isSelected ? componentTokens.popup.selected : undefined}
                bold={isSelected}
              >
                {item.command}
              </Text>
            </Box>
            <Box marginLeft={2}>
              <Text
                color={isSelected ? colors.white : colors.muted}
                backgroundColor={isSelected ? componentTokens.popup.selected : undefined}
              >
                {item.description}
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
