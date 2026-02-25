import { readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { ModelBroker } from '@/runtime/model-broker.js';
import { validateStrategyCode, extractStrategyClassName } from '../strategy/validator.js';
import type {
  StrategyGenerationRequest,
  StrategyValidationResult,
  StrategyType,
  StrategyParameterSpec,
  SuggestedBacktest,
} from '../strategy/types.js';

// --- Strategy type detection ---

const STRATEGY_TYPE_KEYWORDS: Record<StrategyType, string[]> = {
  trend: [
    'trend', 'moving average', 'ma crossover', 'ema', 'sma', 'macd',
    'breakout', 'follow', 'golden cross', 'death cross', 'adx',
  ],
  mean_reversion: [
    'mean reversion', 'revert', 'bollinger', 'rsi oversold', 'rsi overbought',
    'z-score', 'zscore', 'deviation', 'range', 'channel', 'pairs',
  ],
  momentum: [
    'momentum', 'rsi', 'volume surge', 'relative strength', 'rate of change',
    'roc', 'stochastic', 'acceleration',
  ],
  grid: [
    'grid', 'dca', 'dollar cost', 'levels', 'range trading', 'ladder',
  ],
  arbitrage: [
    'arbitrage', 'arb', 'spread', 'funding rate', 'basis', 'cross-exchange',
    'statistical arbitrage', 'stat arb',
  ],
};

export function detectStrategyType(description: string): StrategyType | null {
  const lower = description.toLowerCase();
  let bestType: StrategyType | null = null;
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(STRATEGY_TYPE_KEYWORDS) as Array<
    [StrategyType, string[]]
  >) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestType;
}

// --- Template loading ---

interface TemplateEntry {
  type: StrategyType;
  description: string;
  filePath: string;
}

const TEMPLATE_META: Record<string, { type: StrategyType; description: string }> = {
  'ema_crossover.py': {
    type: 'trend',
    description: 'Dual EMA crossover with ATR-based stop/take-profit',
  },
  'mean_reversion.py': {
    type: 'mean_reversion',
    description: 'Bollinger + RSI mean reversion with ATR exits',
  },
  'momentum.py': {
    type: 'momentum',
    description: 'RSI + volume momentum surge with ATR exits',
  },
};

let _cachedTemplates: TemplateEntry[] | null = null;

export function getTemplateEntries(templatesDir: string): TemplateEntry[] {
  if (_cachedTemplates) return _cachedTemplates;
  try {
    const files = readdirSync(templatesDir).filter((f) => f.endsWith('.py'));
    _cachedTemplates = files
      .filter((f) => f in TEMPLATE_META)
      .map((f) => ({
        ...TEMPLATE_META[f],
        filePath: join(templatesDir, f),
      }));
  } catch {
    _cachedTemplates = [];
  }
  return _cachedTemplates;
}

/** Reset cache — used in tests */
export function _resetTemplateCache(): void {
  _cachedTemplates = null;
}

export async function loadTemplateCode(
  strategyType: StrategyType,
  templatesDir: string,
): Promise<{ code: string; name: string } | null> {
  const entries = getTemplateEntries(templatesDir);
  const entry = entries.find((e) => e.type === strategyType);
  if (!entry) return null;
  try {
    const file = Bun.file(entry.filePath);
    const code = await file.text();
    return { code, name: basename(entry.filePath, '.py') };
  } catch {
    return null;
  }
}

// --- System prompt ---

const SYSTEM_PROMPT = `You are an expert NautilusTrader strategy code generator.

Generate a complete Python strategy implementation that:
1. Defines exactly one strategy class that extends nautilus_trader.trading.Strategy.
2. Implements on_start and on_bar methods (on_stop is optional).
3. Includes configurable parameters and basic risk management (position sizing and stop-loss logic).
4. Uses deterministic strategy logic suitable for backtesting.
5. Avoids dangerous imports and dynamic code execution.
6. Always includes a CONFIG_SCHEMA class variable following JSON Schema 2020-12 format.

CONFIG_SCHEMA requirements:
- Must be a class variable of type dict assigned directly on the class body.
- Must include "$schema": "https://json-schema.org/draft/2020-12/schema".
- Each parameter property must include "type", "default", "description".
- Numeric parameters should include "minimum" and "maximum" where appropriate.
- Use getattr(config, 'param_name', default_value) for extracting parameters in __init__.
- Example:
  CONFIG_SCHEMA = {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "title": "MyStrategy Configuration",
      "type": "object",
      "properties": {
          "fast_period": {
              "type": "integer",
              "default": 10,
              "minimum": 2,
              "maximum": 200,
              "description": "Fast moving average lookback period."
          }
      },
      "required": [],
      "additionalProperties": false
  }

Strict safety requirements:
- Do NOT import os, subprocess, socket, shutil, requests, urllib, or pathlib write helpers.
- Do NOT use exec(), eval(), compile(), or __import__().
- Output Python code only (no markdown fences, no explanations).`;

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

function buildUserPrompt(
  req: StrategyGenerationRequest,
  constraints?: string,
  templateCode?: string,
  templateName?: string,
): string {
  const parts = [
    'Generate NautilusTrader strategy Python code for this request:',
    `Description: ${req.description}`,
    `Instrument: ${req.instrument}`,
    `Timeframe: ${req.timeframe}`,
    `Parameters: ${JSON.stringify(req.parameters ?? {}, null, 2)}`,
  ];
  if (req.strategyType) {
    parts.push(`Strategy type: ${req.strategyType}`);
  }
  if (constraints) parts.push(`Constraints: ${constraints}`);
  if (templateCode && templateName) {
    parts.push('');
    parts.push(`Reference template (${templateName}) — follow the same patterns for CONFIG_SCHEMA, getattr config extraction, ATR stops, and indicator registration:`);
    parts.push(templateCode);
  }
  return parts.join('\n');
}

function buildRetryPrompt(
  req: StrategyGenerationRequest,
  previousCode: string,
  validation: StrategyValidationResult,
  constraints?: string,
): string {
  return [
    buildUserPrompt(req, constraints),
    '',
    'The previous generation failed safety/completeness checks.',
    `Validation errors: ${validation.errors.join('; ')}`,
    'Fix the issues and regenerate a full strategy implementation.',
    'Previous code:',
    previousCode,
  ].join('\n');
}

export interface GenerateInput {
  description: string;
  instrument?: string;
  constraints?: string;
  strategyType?: StrategyType | 'auto';
  parameters?: Record<string, StrategyParameterSpec>;
}

/** Resolve the templates directory relative to the project root. */
function resolveTemplatesDir(): string {
  // import.meta.dir points to src/tools/consolidated at runtime
  return join(import.meta.dir, '..', '..', '..', 'templates');
}

export async function generateStrategy(input: GenerateInput, broker: ModelBroker) {
  // Detect strategy type
  let resolvedType: StrategyType | undefined;
  if (input.strategyType && input.strategyType !== 'auto') {
    resolvedType = input.strategyType;
  } else {
    resolvedType = detectStrategyType(input.description) ?? undefined;
  }

  const req: StrategyGenerationRequest = {
    description: input.description,
    instrument: input.instrument ?? 'AAPL',
    timeframe: '1-DAY',
    strategyType: resolvedType,
    parameters: input.parameters,
  };

  // Load matching template as few-shot example
  let templateCode: string | undefined;
  let templateName: string | undefined;
  if (resolvedType) {
    const tpl = await loadTemplateCode(resolvedType, resolveTemplatesDir());
    if (tpl) {
      templateCode = tpl.code;
      templateName = tpl.name;
    }
  }

  let code = '';
  let validation: StrategyValidationResult = {
    valid: false,
    errors: ['No strategy code was generated'],
    warnings: [],
  };

  let prompt = buildUserPrompt(req, input.constraints, templateCode, templateName);

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
    prompt = buildRetryPrompt(req, code, validation, input.constraints);
  }

  const className = extractStrategyClassName(code) ?? 'GeneratedStrategy';
  const fileName = toSnakeCase(className);

  const suggestedBacktest: SuggestedBacktest = {
    instrument: req.instrument,
    timeframe: req.timeframe,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
  };

  return {
    code,
    className,
    suggestedPath: `strategies/${fileName}.py`,
    validation,
    parameters: req.parameters ?? {},
    templateUsed: templateName,
    suggestedBacktest,
  };
}
