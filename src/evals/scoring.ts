/**
 * Correctness evaluator — LLM-as-judge using the ModelBroker.
 */

import type { EvaluationResult } from 'langsmith/evaluation';
import type { ModelBroker } from '../runtime/model-broker.js';

// ============================================================================
// JSON parser for evaluator output
// ============================================================================

export function parseEvaluatorJson(
  text: string,
): { score: number; comment: string } | null {
  const block = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = (block?.[1] ?? text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || start >= end) return null;

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as {
      score?: unknown;
      comment?: unknown;
    };
    const score = parsed.score === 1 ? 1 : 0;
    const comment =
      typeof parsed.comment === 'string'
        ? parsed.comment
        : 'No comment provided.';
    return { score, comment };
  } catch {
    return null;
  }
}

// ============================================================================
// Correctness evaluator - LLM-as-judge
// ============================================================================

export async function correctnessEvaluator({
  outputs,
  referenceOutputs,
  broker,
}: {
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  referenceOutputs?: Record<string, unknown>;
  broker: ModelBroker;
}): Promise<EvaluationResult> {
  const actualAnswer = (outputs?.answer as string) || '';
  const expectedAnswer = (referenceOutputs?.answer as string) || '';

  const prompt = `You are evaluating the correctness of an AI assistant's answer to a financial question.

Compare the actual answer to the expected answer. The actual answer is considered correct if it conveys the same key information as the expected answer. Minor differences in wording, formatting, or additional context are acceptable as long as the core facts are correct.

Expected Answer:
${expectedAnswer}

Actual Answer:
${actualAnswer}

Evaluate and provide:
- score: 1 if the answer is correct (contains the key information), 0 if incorrect
- comment: brief explanation of why the answer is correct or incorrect

Return strict JSON only: {"score":0|1,"comment":"..."}`;

  try {
    const result = await broker.generateText({
      model: broker.getModel('summarize'),
      system: 'You are an evaluation judge. Respond with strict JSON only.',
      prompt,
    });
    const parsed = parseEvaluatorJson(
      (result as { text?: string }).text ?? '',
    );
    if (!parsed) {
      return {
        key: 'correctness',
        score: 0,
        comment: 'Evaluator returned invalid JSON.',
      };
    }

    return {
      key: 'correctness',
      score: parsed.score,
      comment: parsed.comment,
    };
  } catch (error) {
    return {
      key: 'correctness',
      score: 0,
      comment: `Evaluator error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
