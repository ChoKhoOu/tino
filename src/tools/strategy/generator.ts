import { AIMessage } from '@langchain/core/messages';
import { callLlm } from '../../model/llm.js';
import type {
  StrategyGenerationRequest,
  StrategyGenerationResult,
  StrategyValidationResult,
} from './types.js';
import { extractStrategyClassName, validateStrategyCode } from './validator.js';

type CallLlmFn = typeof callLlm;

let callLlmImpl: CallLlmFn = callLlm;

const STRATEGY_GENERATOR_SYSTEM_PROMPT = `You are an expert NautilusTrader strategy code generator.

Generate a complete Python strategy implementation that:
1. Defines exactly one strategy class that extends nautilus_trader.trading.Strategy.
2. Implements on_start and on_bar methods (on_stop is optional).
3. Includes configurable parameters and basic risk management (position sizing and stop-loss logic).
4. Uses deterministic strategy logic suitable for backtesting.
5. Avoids dangerous imports and dynamic code execution.

Strict safety requirements:
- Do NOT import os, subprocess, socket, shutil, requests, urllib, or pathlib write helpers.
- Do NOT use exec(), eval(), compile(), or __import__().
- Output Python code only (no markdown fences, no explanations).`;

function normalizeResponse(response: AIMessage | string): string {
  if (typeof response === 'string') {
    return response;
  }

  if (typeof response.content === 'string') {
    return response.content;
  }

  if (Array.isArray(response.content)) {
    return response.content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('\n');
  }

  return '';
}

function extractPythonCode(raw: string): string {
  const fenced = raw.match(/```(?:python)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? raw).trim();
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .replace(/__+/g, '_')
    .toLowerCase();
}

function buildUserPrompt(request: StrategyGenerationRequest): string {
  return [
    'Generate NautilusTrader strategy Python code for this request:',
    `Description: ${request.description}`,
    `Instrument: ${request.instrument}`,
    `Timeframe: ${request.timeframe}`,
    `Parameters: ${JSON.stringify(request.parameters ?? {}, null, 2)}`,
  ].join('\n');
}

function buildRetryPrompt(
  request: StrategyGenerationRequest,
  previousCode: string,
  validation: StrategyValidationResult,
): string {
  return [
    buildUserPrompt(request),
    '',
    'The previous generation failed safety/completeness checks.',
    `Validation errors: ${validation.errors.join('; ')}`,
    'Fix the issues and regenerate a full strategy implementation.',
    'Previous code:',
    previousCode,
  ].join('\n');
}

function buildSuggestedPath(className: string): string {
  const fileName = toSnakeCase(className || 'generated_strategy');
  return `strategies/${fileName}.py`;
}

export async function generateStrategyCode(
  request: StrategyGenerationRequest,
  model: string,
): Promise<StrategyGenerationResult> {
  let code = '';
  let validation: StrategyValidationResult = {
    valid: false,
    errors: ['No strategy code was generated'],
    warnings: [],
  };

  let prompt = buildUserPrompt(request);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { response } = await callLlmImpl(prompt, {
      model,
      systemPrompt: STRATEGY_GENERATOR_SYSTEM_PROMPT,
    });

    code = extractPythonCode(normalizeResponse(response));
    validation = validateStrategyCode(code);

    if (validation.valid || attempt === 1) {
      break;
    }

    prompt = buildRetryPrompt(request, code, validation);
  }

  const className = extractStrategyClassName(code) ?? 'GeneratedStrategy';

  return {
    code,
    className,
    suggestedPath: buildSuggestedPath(className),
    validation,
    parameters: request.parameters ?? {},
  };
}

export function __setStrategyGeneratorDependencies(deps: { callLlm?: CallLlmFn }): void {
  if (deps.callLlm) {
    callLlmImpl = deps.callLlm;
  }
}

export function __resetStrategyGeneratorDependencies(): void {
  callLlmImpl = callLlm;
}
