import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

interface ConfirmDialogProps {
  title: string;
  details: string[];
  confirmText: string;
  cooldownSeconds?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  details,
  confirmText,
  cooldownSeconds = 3,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [countdown, setCountdown] = useState(cooldownSeconds);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState(false);

  const inputReady = countdown <= 0;

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  useInput((input, key) => {
    if (!inputReady) return;

    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      if (typed === confirmText) {
        onConfirm();
      } else {
        setError(true);
        setTyped('');
      }
      return;
    }

    if (key.backspace || key.delete) {
      setError(false);
      setTyped((prev) => prev.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setError(false);
      setTyped((prev) => prev + input);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="red" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text color="red" bold>
          {title}
        </Text>
      </Box>

      {details.map((detail, i) => (
        <Text key={i} color="white">
          {detail}
        </Text>
      ))}

      <Box marginTop={1}>
        {!inputReady ? (
          <Text color="yellow">Input enabled in {countdown}s...</Text>
        ) : (
          <Box flexDirection="column">
            <Text dimColor>
              Type &quot;{confirmText}&quot; to proceed (Esc to cancel):
            </Text>
            <Box>
              <Text color="cyan">&gt; </Text>
              <Text>{typed}</Text>
              <Text color="gray">_</Text>
            </Box>
            {error && (
              <Text color="red">
                Input did not match. Type exactly: {confirmText}
              </Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
