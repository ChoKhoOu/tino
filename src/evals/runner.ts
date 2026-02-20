/**
 * Eval runtime bootstrap, target function, and evaluation generator.
 */

import { Client } from 'langsmith';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ModelBroker } from '../runtime/model-broker.js';
import { ToolRegistry } from '../runtime/tool-registry.js';
import { PermissionEngine } from '../runtime/permission-engine.js';
import { HookRunner } from '../runtime/hook-runner.js';
import { SessionRuntime } from '../runtime/session-runtime.js';
import { buildSystemPrompt } from '../runtime/prompt-builder.js';
import { loadPermissions } from '../config/permissions.js';
import { loadHooks } from '../config/hooks.js';
import { discoverPlugins } from '../plugins/discover.js';
import type { EvalProgressEvent } from './components/index.js';
import type { EvalRuntime } from './types.js';
import { parseCSV, shuffleArray } from './csv-parser.js';
import { correctnessEvaluator } from './scoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Runtime bootstrap
// ============================================================================

export async function createEvalRuntime(): Promise<EvalRuntime> {
  const broker = new ModelBroker('gpt-5.2');
  const registry = new ToolRegistry();
  const permissions = new PermissionEngine(loadPermissions());
  const hooks = new HookRunner(loadHooks());

  const builtins = await registry.discoverTools(
    path.join(__dirname, '..', 'tools', 'consolidated'),
  );
  registry.registerAll(builtins);
  registry.registerAll(await discoverPlugins());
  registry.validate();

  const toolDescriptions = registry
    .getAll()
    .map((tool) => `### ${tool.id}\n\n${tool.description}`)
    .join('\n\n');

  return {
    runtime: new SessionRuntime({
      broker,
      registry,
      permissions,
      hooks,
      systemPrompt: buildSystemPrompt(toolDescriptions),
    }),
    broker,
  };
}

// ============================================================================
// Target function — runs the agent on a single question
// ============================================================================

async function target(
  inputs: { question: string },
  runtime: SessionRuntime,
): Promise<{ answer: string }> {
  let answer = '';

  for await (const event of runtime.startRun(inputs.question)) {
    if (event.type === 'done') {
      answer = event.answer;
    }
  }

  return { answer };
}

// ============================================================================
// Evaluation generator - yields progress events for the UI
// ============================================================================

export function createEvaluationRunner(sampleSize?: number) {
  return async function* runEvaluation(): AsyncGenerator<
    EvalProgressEvent,
    void,
    unknown
  > {
    // Load and parse dataset
    const csvPath = path.join(__dirname, 'dataset', 'finance_agent.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    let examples = parseCSV(csvContent);
    const totalCount = examples.length;

    // Apply sampling if requested
    if (sampleSize && sampleSize < examples.length) {
      examples = shuffleArray(examples).slice(0, sampleSize);
    }

    // Create LangSmith client
    const client = new Client();

    // Unique dataset name for this run (sampling creates different datasets)
    const datasetName = sampleSize
      ? `tino-finance-eval-sample-${sampleSize}-${Date.now()}`
      : 'tino-finance-eval';

    // Yield init event
    yield {
      type: 'init',
      total: examples.length,
      datasetName: sampleSize
        ? `finance_agent (sample ${sampleSize}/${totalCount})`
        : 'finance_agent',
    };

    // Check if dataset exists (only for full runs)
    let dataset: Awaited<ReturnType<typeof client.readDataset>> | null = null;
    if (!sampleSize) {
      try {
        dataset = await client.readDataset({ datasetName });
      } catch {
        // Dataset doesn't exist, will create
        dataset = null;
      }
    }

    // Create dataset if needed
    if (!dataset) {
      dataset = await client.createDataset(datasetName, {
        description: sampleSize
          ? `Finance agent evaluation (sample of ${sampleSize})`
          : 'Finance agent evaluation dataset',
      });

      // Upload examples
      await client.createExamples({
        datasetId: dataset.id,
        inputs: examples.map((e) => e.inputs),
        outputs: examples.map((e) => e.outputs),
      });
    }

    // Generate experiment name for tracking
    const experimentName = `tino-eval-${Date.now().toString(36)}`;
    const { runtime, broker } = await createEvalRuntime();

    // Run evaluation — process each example one by one
    for (const example of examples) {
      const question = example.inputs.question;

      yield { type: 'question_start', question };

      const startTime = Date.now();
      const outputs = await target(example.inputs, runtime);
      const endTime = Date.now();

      const evalResult = await correctnessEvaluator({
        inputs: example.inputs,
        outputs,
        referenceOutputs: example.outputs,
        broker,
      });

      // Log to LangSmith for tracking
      await client.createRun({
        name: 'tino-eval-run',
        run_type: 'chain',
        inputs: example.inputs,
        outputs,
        start_time: startTime,
        end_time: endTime,
        project_name: experimentName,
        extra: {
          dataset: datasetName,
          reference_outputs: example.outputs,
          evaluation: {
            score: evalResult.score,
            comment: evalResult.comment,
          },
        },
      });

      yield {
        type: 'question_end',
        question,
        score: typeof evalResult.score === 'number' ? evalResult.score : 0,
        comment: evalResult.comment || '',
      };
    }

    // Yield complete event
    yield { type: 'complete', experimentName };
  };
}
