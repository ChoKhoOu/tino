import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface ConfirmationProps {
  title: string;
  details: Array<{ label: string; value: string }>;
  dangerLevel?: 'safe' | 'warning' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function Confirmation({
  title,
  details,
  dangerLevel = 'warning',
  onConfirm,
  onCancel,
}: ConfirmationProps) {
  const [selected, setSelected] = useState<'y' | 'n'>('n');

  const borderColor =
    dangerLevel === 'danger' ? 'red' : dangerLevel === 'warning' ? 'yellow' : 'green';

  useInput((input, key) => {
    if (input === 'y' || input === 'Y') {
      setSelected('y');
      onConfirm();
    } else if (input === 'n' || input === 'N' || key.escape) {
      setSelected('n');
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={borderColor} paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color={borderColor} bold>
          {dangerLevel === 'danger' ? '⚠ LIVE TRADING ' : ''}
          {title}
        </Text>
      </Box>

      {details.map((d, i) => (
        <Box key={i}>
          <Box width={20}>
            <Text color="gray">{d.label}:</Text>
          </Box>
          <Text color="white">{d.value}</Text>
        </Box>
      ))}

      <Box marginTop={1}>
        <Text color={borderColor} bold>
          Confirm? [y/N]{' '}
        </Text>
        <Text color="gray">
          (Press Y to confirm, N or Esc to cancel)
        </Text>
      </Box>
    </Box>
  );
}
