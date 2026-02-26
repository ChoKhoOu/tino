import React from 'react';
import { Box, Text } from 'ink';
import { highlight } from 'cli-highlight';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({ code, language, showLineNumbers = false }: CodeBlockProps) {
  let highlighted: string;
  try {
    highlighted = highlight(code, { language });
  } catch {
    highlighted = code;
  }

  const lines = highlighted.split('\n');
  const lineNumberWidth = String(lines.length).length;

  const content = showLineNumbers
    ? lines
        .map((line, i) => {
          const num = String(i + 1).padStart(lineNumberWidth, ' ');
          return `\u001b[90m${num}\u001b[39m  ${line}`;
        })
        .join('\n')
    : highlighted;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {language && (
        <Box justifyContent="flex-end">
          <Text color="gray" dimColor>{language}</Text>
        </Box>
      )}
      <Text>{content}</Text>
    </Box>
  );
}
