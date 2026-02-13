import { Box, Text } from 'ink';
import { colors, componentTokens } from '../theme.js';

interface CheckpointDiffProps {
  filesChanged: number;
  turnsRemoved: number;
  gitRef: string;
}

export function CheckpointDiff({ filesChanged, turnsRemoved, gitRef }: CheckpointDiffProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={componentTokens.popup.border}
      backgroundColor={componentTokens.rewindMenu.bg}
      paddingX={1}
    >
      <Text color={colors.white} bold>Checkpoint restore preview</Text>

      <Box marginTop={1} flexDirection="column">
        <Text>
          <Text color={colors.error}>{filesChanged} files will be reverted</Text>
          <Text color={colors.muted}> · </Text>
          <Text color={colors.error}>{turnsRemoved} conversation turns will be removed</Text>
        </Text>
        <Text>
          <Text color={colors.success}>Git ref: {gitRef || 'n/a'}</Text>
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color={colors.success}>[Confirm restore]</Text>
        <Text color={colors.muted}> </Text>
        <Text color={colors.error}>[Cancel]</Text>
      </Box>
    </Box>
  );
}
