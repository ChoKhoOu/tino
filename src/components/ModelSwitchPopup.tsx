import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentTokens } from '../theme.js';
import type { ModelOption } from '../hooks/useModelSwitchPopup.js';

interface ModelSwitchPopupProps {
  isOpen: boolean;
  selectedIndex: number;
  models: ModelOption[];
}

const VISIBLE_COUNT = 5;

export function ModelSwitchPopup({ isOpen, selectedIndex, models }: ModelSwitchPopupProps) {
  if (!isOpen || models.length === 0) {
    return null;
  }

  let start = Math.max(0, selectedIndex - Math.floor(VISIBLE_COUNT / 2));
  if (start + VISIBLE_COUNT > models.length) {
    start = Math.max(0, models.length - VISIBLE_COUNT);
  }

  const visibleItems = models.slice(start, start + VISIBLE_COUNT);

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
        <Text color={colors.muted} bold>Switch Model</Text>
      </Box>

      {visibleItems.map((model, index) => {
        const realIndex = start + index;
        const isSelected = realIndex === selectedIndex;
        const marker = model.isCurrent ? '✓ ' : '  ';

        return (
          <Box key={model.name} flexDirection="row" justifyContent="space-between">
            <Box>
              <Text
                color={model.isCurrent ? colors.success : isSelected ? colors.white : colors.white}
                backgroundColor={isSelected ? componentTokens.popup.selected : undefined}
                bold={isSelected}
              >
                {marker}{model.name}
              </Text>
            </Box>
            <Box marginLeft={2}>
              <Text
                color={isSelected ? colors.white : colors.muted}
                backgroundColor={isSelected ? componentTokens.popup.selected : undefined}
              >
                {model.provider}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
