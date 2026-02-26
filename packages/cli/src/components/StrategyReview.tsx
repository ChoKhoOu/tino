import React from 'react';
import { Box, Text } from 'ink';

interface StrategyReviewProps {
  strategyName: string | null;
  code: string | null;
  description?: string;
  parameters?: Record<string, unknown>;
  changesSummary?: string;
  isModified?: boolean;
  versionHash?: string | null;
}

export function StrategyReview({
  strategyName,
  code,
  description,
  parameters,
  changesSummary,
  isModified,
  versionHash,
}: StrategyReviewProps) {
  if (!code) {
    return (
      <Box paddingY={1}>
        <Text color="gray" dimColor>
          No strategy loaded. Describe a trading idea to get started.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="green" bold>
          Strategy: {strategyName || 'Untitled'}
        </Text>
        {isModified && (
          <Text color="yellow"> [unsaved]</Text>
        )}
        {versionHash && (
          <Text color="gray" dimColor>
            {' '}
            ({versionHash.slice(0, 15)}...)
          </Text>
        )}
      </Box>

      {/* Description */}
      {description && (
        <Box marginBottom={1}>
          <Text color="white">{description}</Text>
        </Box>
      )}

      {/* Changes summary (for refinements) */}
      {changesSummary && (
        <Box marginBottom={1} paddingX={1} borderStyle="round" borderColor="yellow">
          <Text color="yellow">Changes: {changesSummary}</Text>
        </Box>
      )}

      {/* Code display */}
      <Box
        flexDirection="column"
        paddingX={1}
        borderStyle="single"
        borderColor="green"
      >
        <Text color="gray" dimColor>
          python
        </Text>
        {code.split('\n').map((line, i) => (
          <Box key={i}>
            <Text color="gray" dimColor>
              {String(i + 1).padStart(3, ' ')} │{' '}
            </Text>
            <Text color="green">{line}</Text>
          </Box>
        ))}
      </Box>

      {/* Parameters */}
      {parameters && Object.keys(parameters).length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="cyan" bold>
            Parameters:
          </Text>
          {Object.entries(parameters).map(([key, val]) => (
            <Box key={key} paddingLeft={2}>
              <Text color="white">
                {key}: {JSON.stringify(val)}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Actions hint */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Type a modification to refine, "save" to persist, or "explain" for analysis
        </Text>
      </Box>
    </Box>
  );
}
