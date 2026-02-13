import { Text } from 'ink';
import { componentTokens } from '../theme.js';

interface GhostTextProps {
  suggestion: string | null;
}

export function GhostText({ suggestion }: GhostTextProps) {
  if (!suggestion) return null;

  const value = suggestion.trim();
  if (!value) return null;

  return <Text color={componentTokens.ghostText.color}>{value}</Text>;
}
