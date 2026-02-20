import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../theme.js';
import type { SlashCommandOption } from '../hooks/useSlashCommandMenu.js';

interface SlashCommandMenuProps {
  isOpen: boolean;
  selectedIndex: number;
  filteredCommands: SlashCommandOption[];
}

export const SLASH_MENU_VISIBLE_COUNT = 5;
const CMD_COL_WIDTH = 18;

export function SlashCommandMenu({
  isOpen,
  selectedIndex,
  filteredCommands,
}: SlashCommandMenuProps) {
  if (!isOpen || filteredCommands.length === 0) {
    return null;
  }

  let start = Math.max(0, selectedIndex - Math.floor(SLASH_MENU_VISIBLE_COUNT / 2));
  if (start + SLASH_MENU_VISIBLE_COUNT > filteredCommands.length) {
    start = Math.max(0, filteredCommands.length - SLASH_MENU_VISIBLE_COUNT);
  }
  
  const visibleItems = filteredCommands.slice(start, start + SLASH_MENU_VISIBLE_COUNT);

  return (
    <Box flexDirection="column" paddingX={1}>
      {visibleItems.map((item, index) => {
        const realIndex = start + index;
        const isSelected = realIndex === selectedIndex;
        const bg = isSelected ? componentTokens.popup.selected : undefined;
        const cmdColor = isSelected ? colors.white : colors.muted;
        const descColor = isSelected ? colors.white : colors.muted;
        
        return (
          <Box key={item.command}>
            <Text color={cmdColor} backgroundColor={bg} bold={isSelected}>
              {item.command.padEnd(CMD_COL_WIDTH)}
            </Text>
            <Text color={descColor} backgroundColor={bg}>
              {item.description}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
