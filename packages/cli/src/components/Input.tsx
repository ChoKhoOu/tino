import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface InputProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  prefix?: string;
  isLoading?: boolean;
}

export function Input({
  onSubmit,
  placeholder = 'Describe a trading strategy...',
  prefix = '> ',
  isLoading = false,
}: InputProps) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useInput((input, key) => {
    if (isLoading) return;

    if (key.return) {
      if (value.trim()) {
        setHistory((prev) => [...prev, value.trim()]);
        setHistoryIndex(-1);
        onSubmit(value.trim());
        setValue('');
      }
      return;
    }

    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return;
    }

    if (key.upArrow && history.length > 0) {
      const newIndex =
        historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setValue(history[newIndex] || '');
      return;
    }

    if (key.downArrow) {
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= history.length) {
        setHistoryIndex(-1);
        setValue('');
      } else {
        setHistoryIndex(newIndex);
        setValue(history[newIndex] || '');
      }
      return;
    }

    if (key.escape) {
      setValue('');
      setHistoryIndex(-1);
      return;
    }

    if (!key.ctrl && !key.meta && input) {
      setValue((prev) => prev + input);
    }
  });

  return (
    <Box>
      <Text color="cyan" bold>
        {prefix}
      </Text>
      {isLoading ? (
        <Text color="yellow">Thinking...</Text>
      ) : value ? (
        <Text>{value}</Text>
      ) : (
        <Text color="gray" dimColor>
          {placeholder}
        </Text>
      )}
      {!isLoading && <Text color="cyan">█</Text>}
    </Box>
  );
}
