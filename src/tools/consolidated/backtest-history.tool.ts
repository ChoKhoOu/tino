import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getBacktestClient } from '../trading/grpc-clients.js';
import { BACKTEST_HISTORY_DESCRIPTION } from '../descriptions/backtest-history.js';
import type { BacktestResult } from '@/grpc/gen/tino/backtest/v1/backtest_pb.js';
import type { ToolContext } from '@/domain/tool-plugin.js';

const schema = z.object({
  action: z.enum([
    'list_results',
    'get_result',
    'compare',
  ]).describe('The backtest history action to perform'),
  id: z.string().optional().describe('Backtest result ID (for get_result)'),
  ids: z.array(z.string()).optional().describe('Array of 2 backtest IDs (for compare)'),
});

type Input = z.infer<typeof schema>;

function summarize(r: BacktestResult) {
  return {
    id: r.id,
    totalReturn: r.totalReturn,
    sharpeRatio: r.sharpeRatio,
    maxDrawdown: r.maxDrawdown,
    sortinoRatio: r.sortinoRatio,
    totalTrades: r.totalTrades,
    winRate: r.winRate,
    profitFactor: r.profitFactor,
    createdAt: r.createdAt,
  };
}

function fullResult(r: BacktestResult) {
  return {
    ...summarize(r),
    winningTrades: r.winningTrades,
    equityCurveJson: r.equityCurveJson,
    tradesJson: r.tradesJson,
  };
}

function computeDeltas(a: BacktestResult, b: BacktestResult) {
  const metrics = ['totalReturn', 'sharpeRatio', 'maxDrawdown', 'winRate', 'profitFactor'] as const;
  const deltas: Record<string, number> = {};
  for (const m of metrics) {
    deltas[m] = b[m] - a[m];
  }
  return deltas;
}

async function handleListResults(ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.backtest ?? getBacktestClient();
  const response = await client.listResults();
  const summaries = response.results.map(summarize);
  return JSON.stringify({ data: { total: summaries.length, results: summaries } });
}

async function handleGetResult(input: Input, ctx: ToolContext): Promise<string> {
  if (!input.id) {
    return JSON.stringify({ data: { error: 'Missing required parameter: id' } });
  }
  const client = ctx.grpc?.backtest ?? getBacktestClient();
  const response = await client.getResult(input.id);
  if (!response.result) {
    return JSON.stringify({ data: { error: `No result found for id: ${input.id}` } });
  }
  return JSON.stringify({ data: fullResult(response.result) });
}

async function handleCompare(input: Input, ctx: ToolContext): Promise<string> {
  if (!input.ids || input.ids.length !== 2) {
    return JSON.stringify({ data: { error: 'compare requires exactly 2 IDs in the ids array' } });
  }
  const client = ctx.grpc?.backtest ?? getBacktestClient();
  const [respA, respB] = await Promise.all([
    client.getResult(input.ids[0]),
    client.getResult(input.ids[1]),
  ]);

  if (!respA.result || !respB.result) {
    const missing = [
      !respA.result ? input.ids[0] : null,
      !respB.result ? input.ids[1] : null,
    ].filter(Boolean);
    return JSON.stringify({ data: { error: `Results not found: ${missing.join(', ')}` } });
  }

  return JSON.stringify({
    data: {
      a: summarize(respA.result),
      b: summarize(respB.result),
      deltas: computeDeltas(respA.result, respB.result),
    },
  });
}

export default definePlugin({
  id: 'backtest_history',
  domain: 'trading',
  riskLevel: 'safe',
  description: BACKTEST_HISTORY_DESCRIPTION,
  schema,
  execute: async (raw, ctx) => {
    const input = schema.parse(raw);

    switch (input.action) {
      case 'list_results':
        return handleListResults(ctx);
      case 'get_result':
        return handleGetResult(input, ctx);
      case 'compare':
        return handleCompare(input, ctx);
    }
  },
});
