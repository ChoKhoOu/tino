import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { colors, componentTokens } from '../theme.js';

export interface CommandPaletteItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  command: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  query: string;
  setQuery: (q: string) => void;
  selectedIndex: number;
  items: CommandPaletteItem[];
  onSelect: (command: string) => void;
}

const VISIBLE_COUNT = 10;

export function CommandPalette({ isOpen, query, setQuery, selectedIndex, items, onSelect }: CommandPaletteProps) {
  if (!isOpen) {
    return null;
  }

  // Calculate visible range
  let start = Math.max(0, selectedIndex - Math.floor(VISIBLE_COUNT / 2));
  if (start + VISIBLE_COUNT > items.length) {
    start = Math.max(0, items.length - VISIBLE_COUNT);
  }
  const visibleItems = items.slice(start, start + VISIBLE_COUNT);

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={componentTokens.popup.border}
      paddingX={1}
      width="80%"
      marginTop={1}
      marginBottom={1}
    >
      <Box paddingBottom={1} borderBottom={true} borderStyle="single" borderColor={colors.muted}>
        <Text color={colors.primary}>❯ </Text>
        <TextInput 
          value={query} 
          onChange={setQuery} 
          placeholder="Search commands, tokens, strategies..." 
          focus={isOpen}
        />
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {items.length === 0 ? (
          <Text color={colors.muted}>No results found.</Text>
        ) : (
          visibleItems.map((item, index) => {
            const realIndex = start + index;
            const isSelected = realIndex === selectedIndex;
            const bg = isSelected ? componentTokens.popup.selected : undefined;
            
            return (
              <Box key={item.id} flexDirection="column">
                <Box paddingX={1} backgroundColor={bg}>
                  <Box width={12}>
                    <Text color={isSelected ? colors.white : colors.muted} backgroundColor={bg}>
                      {item.category}
                    </Text>
                  </Box>
                  <Box flexGrow={1}>
                    <Text color={isSelected ? colors.white : undefined} backgroundColor={bg} bold={isSelected}>
                      {item.title}
                    </Text>
                    {item.subtitle && (
                      <Text color={isSelected ? colors.white : colors.muted} backgroundColor={bg}>
                        {' - '}{item.subtitle}
                      </Text>
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
