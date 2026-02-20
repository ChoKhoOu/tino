/**
 * Final summary view shown when an evaluation run completes.
 */
import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../../theme.js';
import type { EvalResult } from './EvalRecentResults.js';

interface EvalCompleteSummaryProps {
  experimentName: string | null;
  results: EvalResult[];
}

/**
 * Renders the final summary with per-question results after evaluation completes.
 */
export function EvalCompleteSummary({ experimentName, results }: EvalCompleteSummaryProps) {
  const avgScore = results.length > 0
    ? results.reduce((sum, r) => sum + r.score, 0) / results.length
    : 0;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{'\u2550'.repeat(70)}</Text>
      <Text bold>EVALUATION COMPLETE</Text>
      <Text>{'\u2550'.repeat(70)}</Text>
      <Text>Experiment: {experimentName ?? 'unknown'}</Text>
      <Text>Examples evaluated: {results.length}</Text>
      <Text>Average correctness score: <Text color={colors.primary} bold>{(avgScore * 100).toFixed(1)}%</Text></Text>
      <Text> </Text>
      <Text>Results by question:</Text>
      <Text>{'\u2500'.repeat(70)}</Text>
      {results.map((r, i) => {
        const icon = r.score === 1 ? '\u2713' : '\u2717';
        const iconColor = r.score === 1 ? colors.success : colors.error;
        return (
          <Box key={i} flexDirection="column">
            <Box>
              <Text color={iconColor}>{icon} </Text>
              <Text color={colors.muted}>[{r.score}] </Text>
              <Text>{r.question.slice(0, 65)}{r.question.length > 65 ? '...' : ''}</Text>
            </Box>
            {r.comment && r.score !== 1 && (
              <Text color={colors.muted}>    {r.comment.slice(0, 80)}{r.comment.length > 80 ? '...' : ''}</Text>
            )}
          </Box>
        );
      })}
      <Text> </Text>
      <Text>{'\u2500'.repeat(70)}</Text>
      <Text color={colors.muted}>View full results: https://smith.langchain.com</Text>
    </Box>
  );
}
