import { Text } from 'ink';
import { componentTokens } from '../theme.js';

interface BashHistoryHintProps {
  text: string;
  bestMatch: string | null;
}

export function BashHistoryHint({ text, bestMatch }: BashHistoryHintProps) {
  if (!bestMatch) return null;

  const prefix = text.startsWith('!') ? text.slice(1) : text;
  if (!prefix) return null;

  if (!bestMatch.startsWith(prefix)) return null;

  const remainder = bestMatch.slice(prefix.length);
  if (!remainder) return null;

  return <Text color={componentTokens.ghostText.color}>{remainder}</Text>;
}
