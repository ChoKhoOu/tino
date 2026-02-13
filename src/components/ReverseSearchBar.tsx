import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

import { colors } from '../theme.js';

interface ReverseSearchBarProps {
  searchQuery: string;
  currentMatch: string | null;
  matchIndex: number;
  totalMatches: number;
}

function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text;

  const before = text.slice(0, idx);
  const matched = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return before + chalk.bold.yellow(matched) + after;
}

export function ReverseSearchBar({
  searchQuery,
  currentMatch,
  matchIndex,
  totalMatches,
}: ReverseSearchBarProps) {
  const matchDisplay = currentMatch
    ? highlightMatch(currentMatch, searchQuery)
    : '';

  const counter = totalMatches > 0
    ? chalk.hex(colors.muted)(`[${matchIndex + 1}/${totalMatches}]`)
    : '';

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="single"
      borderColor={colors.warning}
      borderLeft={false}
      borderRight={false}
      width="100%"
    >
      <Box paddingX={1}>
        <Text>
          {chalk.hex(colors.warning)("(reverse-i-search)")}
          {chalk.hex(colors.accent)(`'${searchQuery}'`)}
          {': '}
          {matchDisplay}
          {counter ? ` ${counter}` : ''}
        </Text>
      </Box>
    </Box>
  );
}
