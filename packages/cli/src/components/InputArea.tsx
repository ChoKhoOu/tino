import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';

interface InputAreaProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  historyUp?: () => string | null;
  historyDown?: () => string | null;
  resetHistory?: () => void;
  clearTrigger?: number;
}

export function InputArea({
  onSubmit,
  disabled = false,
  placeholder = 'Describe a trading strategy...',
  historyUp,
  historyDown,
  resetHistory,
  clearTrigger,
}: InputAreaProps) {
  const [value, setValue] = useState('');
  const isInitialRender = useRef(true);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    setValue('');
  }, [clearTrigger]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
    resetHistory?.();
  }, [value, onSubmit, resetHistory]);

  useInput((input, key) => {
    if (disabled) return;

    if (key.return) {
      if (key.shift) {
        // Shift+Enter: insert newline
        setValue((prev) => prev + '\n');
        return;
      }
      // Enter: submit
      handleSubmit();
      return;
    }

    if (key.escape) {
      setValue('');
      return;
    }

    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1));
      return;
    }

    if (key.upArrow) {
      if (historyUp) {
        const entry = historyUp();
        if (entry !== null) {
          setValue(entry);
        }
      }
      return;
    }

    if (key.downArrow) {
      if (historyDown) {
        const entry = historyDown();
        if (entry !== null) {
          setValue(entry);
        }
      }
      return;
    }

    // Regular character input (ignore ctrl/meta sequences)
    if (!key.ctrl && !key.meta && input) {
      setValue((prev) => prev + input);
    }
  });

  if (disabled) {
    return (
      <Box>
        <Text dimColor>Waiting for response...</Text>
      </Box>
    );
  }

  const lines = value.split('\n');
  const isEmpty = value === '';

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Box key={i}>
          <Text color="cyan" bold>
            {i === 0 ? '> ' : '  '}
          </Text>
          {i === lines.length - 1 ? (
            // Last line: show text + cursor, or placeholder on empty first line
            <>
              {isEmpty && i === 0 ? (
                <Text color="gray" dimColor>
                  {placeholder}
                </Text>
              ) : (
                <Text>{line}</Text>
              )}
              <Text color="cyan">█</Text>
            </>
          ) : (
            <Text>{line}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}
