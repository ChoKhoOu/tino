/**
 * LangSmith Evaluation Runner for Tino
 *
 * Usage:
 *   bun run src/evals/run.ts              # Run on all questions
 *   bun run src/evals/run.ts --sample 10  # Run on random sample of 10 questions
 */

import 'dotenv/config';
import React from 'react';
import { render } from 'ink';
import { EvalApp } from './components/index.js';
import { createEvaluationRunner } from './runner.js';

async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const sampleIndex = args.indexOf('--sample');
  const sampleSize =
    sampleIndex !== -1 ? parseInt(args[sampleIndex + 1]) : undefined;

  // Create the evaluation runner with the sample size
  const runEvaluation = createEvaluationRunner(sampleSize);

  // Render the Ink UI
  const { waitUntilExit } = render(
    React.createElement(EvalApp, { runEvaluation }),
  );

  await waitUntilExit();
}

main().catch(console.error);
