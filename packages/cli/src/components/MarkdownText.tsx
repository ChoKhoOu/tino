import React from 'react';
import { Text } from 'ink';
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

interface MarkdownTextProps {
  children: string;
}

const marked = new Marked(markedTerminal() as Parameters<Marked['use']>[0]);

export function MarkdownText({ children }: MarkdownTextProps) {
  if (!children) {
    return null;
  }

  const rendered = String(marked.parse(children));
  const trimmed = rendered.replace(/\n+$/, '');

  return <Text>{trimmed}</Text>;
}
