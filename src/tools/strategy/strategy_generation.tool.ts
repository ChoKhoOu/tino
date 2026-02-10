import { z } from 'zod';
import { definePlugin } from '@/domain/tool-plugin.js';
import type { ModelBroker } from '@/runtime/model-broker.js';
import { validateStrategyCode, extractStrategyClassName } from './validator.js';
import type { StrategyGenerationRequest, StrategyValidationResult } from './types.js';
import { formatToolResult } from '../types.js';

const SYSTEM_PROMPT = `You are an expert NautilusTrader strategy code generator.

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

const schema = z.object({
  description: z.string().describe('Natural language strategy description'),
  instrument: z.string().optional().describe('Instrument symbol, e.g., AAPL or BTCUSDT'),
  timeframe: z.string().optional().describe('Timeframe, e.g., 1-DAY or 1-HOUR'),
});

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

function buildUserPrompt(req: StrategyGenerationRequest): string {
  return [
    'Generate NautilusTrader strategy Python code for this request:',
    `Description: ${req.description}`,
    `Instrument: ${req.instrument}`,
    `Timeframe: ${req.timeframe}`,
    `Parameters: ${JSON.stringify(req.parameters ?? {}, null, 2)}`,
  ].join('\n');
}

function buildRetryPrompt(
  req: StrategyGenerationRequest,
  previousCode: string,
  validation: StrategyValidationResult,
): string {
  return [
    buildUserPrompt(req),
    '',
    'The previous generation failed safety/completeness checks.',
    `Validation errors: ${validation.errors.join('; ')}`,
    'Fix the issues and regenerate a full strategy implementation.',
    'Previous code:',
    previousCode,
  ].join('\n');
}

async function generate(req: StrategyGenerationRequest, broker: ModelBroker) {
  let code = '';
  let validation: StrategyValidationResult = {
    valid: false,
    errors: ['No strategy code was generated'],
    warnings: [],
  };

  let prompt = buildUserPrompt(req);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await broker.generateText({
      model: broker.getModel('reason'),
      system: SYSTEM_PROMPT,
      prompt,
    });
    const raw = (result as { text: string }).text ?? '';
    code = extractPythonCode(raw);
    validation = validateStrategyCode(code);

    if (validation.valid || attempt === 1) break;
    prompt = buildRetryPrompt(req, code, validation);
  }

  const className = extractStrategyClassName(code) ?? 'GeneratedStrategy';
  const fileName = toSnakeCase(className);

  return {
    code,
    className,
    suggestedPath: `strategies/${fileName}.py`,
    validation,
    parameters: req.parameters ?? {},
  };
}

export default definePlugin({
  id: 'strategy_generation',
  domain: 'strategy',
  riskLevel: 'moderate',
  description:
    'Generate NautilusTrader strategy Python code from natural language with built-in safety validation.',
  schema,
  execute: async (args, ctx) => {
    ctx.onProgress('Generating strategy code...');
    const input = schema.parse(args);
    const broker = ctx.config.broker as ModelBroker | undefined;
    if (!broker) return formatToolResult({ error: 'ModelBroker not available in tool context' });

    const result = await generate(
      {
        description: input.description,
        instrument: input.instrument ?? 'AAPL',
        timeframe: input.timeframe ?? '1-DAY',
      },
      broker,
    );

    return formatToolResult(result);
  },
});
