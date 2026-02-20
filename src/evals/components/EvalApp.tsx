import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { colors } from '../../theme.js';
import { EvalProgress } from './EvalProgress.js';
import { EvalCurrentQuestion } from './EvalCurrentQuestion.js';
import { EvalStats } from './EvalStats.js';
import { EvalRecentResults, type EvalResult } from './EvalRecentResults.js';
import { EvalCompleteSummary } from './EvalCompleteSummary.js';


const SHOW_STATS = true;

interface EvalState {
  status: 'loading' | 'running' | 'complete';
  total: number;
  completed: number;
  correct: number;
  currentQuestion: string | null;
  results: EvalResult[];
  startTime: number;
  experimentName: string | null;
  datasetName: string | null;
}

export interface EvalProgressEvent {
  type: 'init' | 'question_start' | 'question_end' | 'complete';
  total?: number;
  datasetName?: string;
  question?: string;
  score?: number;
  comment?: string;
  experimentName?: string;
  averageScore?: number;
}

interface EvalAppProps {
  runEvaluation: () => AsyncGenerator<EvalProgressEvent, void, unknown>;
}

/**
 * Main Ink component that orchestrates the eval UI
 */
export function EvalApp({ runEvaluation }: EvalAppProps) {
  const { exit } = useApp();
  const [state, setState] = useState<EvalState>({
    status: 'loading',
    total: 0,
    completed: 0,
    correct: 0,
    currentQuestion: null,
    results: [],
    startTime: Date.now(),
    experimentName: null,
    datasetName: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      for await (const event of runEvaluation()) {
        if (cancelled) break;

        switch (event.type) {
          case 'init':
            setState(prev => ({
              ...prev,
              status: 'running',
              total: event.total ?? 0,
              datasetName: event.datasetName ?? null,
              startTime: Date.now(),
            }));
            break;

          case 'question_start':
            setState(prev => ({
              ...prev,
              currentQuestion: event.question ?? null,
            }));
            break;

          case 'question_end':
            setState(prev => ({
              ...prev,
              completed: prev.completed + 1,
              correct: prev.correct + (event.score === 1 ? 1 : 0),
              currentQuestion: null,
              results: [
                ...prev.results,
                {
                  question: event.question ?? '',
                  score: event.score ?? 0,
                  comment: event.comment ?? '',
                },
              ],
            }));
            break;

          case 'complete':
            setState(prev => ({
              ...prev,
              status: 'complete',
              experimentName: event.experimentName ?? null,
              currentQuestion: null,
            }));
            break;
        }
      }

      // Exit after a short delay to let the user see the final summary
      setTimeout(() => {
        exit();
      }, 100);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [runEvaluation, exit]);

  // Loading state
  if (state.status === 'loading') {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={colors.primary} bold>Tino Eval</Text>
        <Text color={colors.muted}>Loading dataset...</Text>
      </Box>
    );
  }

  // Complete state - show final summary
  if (state.status === 'complete') {
    return (
      <EvalCompleteSummary
        experimentName={state.experimentName}
        results={state.results}
      />
    );
  }

  // Running state - show progress UI
  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={colors.primary} bold>Tino Eval</Text>
        {state.datasetName && (
          <Text color={colors.muted}> • {state.datasetName}</Text>
        )}
      </Box>

      {/* Progress bar */}
      <EvalProgress completed={state.completed} total={state.total} />

      {/* Current question with spinner */}
      <Box marginTop={1}>
        <EvalCurrentQuestion question={state.currentQuestion} />
      </Box>

      {/* Live stats */}
      {SHOW_STATS && (
        <Box marginTop={1}>
          <EvalStats
            correct={state.correct}
            incorrect={state.completed - state.correct}
            startTime={state.startTime}
          />
        </Box>
      )}

      {/* Recent results */}
      <EvalRecentResults results={state.results} maxDisplay={5} />
    </Box>
  );
}
