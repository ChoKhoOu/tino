import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

interface FileAutocompleteProps {
  files: string[];
  selectedIndex: number;
}

export function FileAutocomplete({ files, selectedIndex }: FileAutocompleteProps) {
  if (files.length === 0) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.primary}
      paddingX={1}
      marginBottom={0}
    >
      {files.map((file, index) => (
        <Box key={file}>
          <Text
            color={index === selectedIndex ? colors.white : colors.white}
            backgroundColor={index === selectedIndex ? colors.primary : undefined}
          >
            {file}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
