import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';
import { getPortfolioClient } from '../portfolio/grpc-clients.js';
import { getExchangeClient } from '../trading/grpc-clients.js';
import { PORTFOLIO_DESCRIPTION } from '../descriptions/portfolio.js';
import type { ToolContext } from '@/domain/tool-plugin.js';

const SUPPORTED_EXCHANGES = ['binance', 'bybit', 'okx', 'bitget'] as const;

const schema = z.object({
  action: z.enum([
    'summary',
    'trades',
    'positions',
    'pnl_history',
    'cross_exchange_summary',
    'cross_exchange_positions',
  ]).describe('The portfolio action to perform'),
  instrument: z.string().optional().describe('Filter by instrument symbol'),
  start_date: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
  end_date: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
  limit: z.number().optional().describe('Max number of results to return'),
});

type Input = z.infer<typeof schema>;

async function handleSummary(ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.portfolio ?? getPortfolioClient();
  const response = await client.getSummary();

  return JSON.stringify({
    data: {
      totalTrades: response.totalTrades,
      openPositions: response.openPositions,
      totalRealizedPnl: response.totalRealizedPnl,
      totalUnrealizedPnl: response.totalUnrealizedPnl,
      totalFees: response.totalFees,
    },
  });
}

async function handleTrades(input: Input, ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.portfolio ?? getPortfolioClient();
  const response = await client.getTrades({
    instrument: input.instrument,
    startDate: input.start_date,
    endDate: input.end_date,
    limit: input.limit,
  });

  const trades = response.trades.map((t) => ({
    id: t.id,
    instrument: t.instrument,
    side: t.side,
    quantity: t.quantity,
    price: t.price,
    fee: t.fee,
    venue: t.venue,
    timestamp: t.timestamp,
    orderId: t.orderId,
    strategy: t.strategy,
  }));

  return JSON.stringify({ data: { trades } });
}

async function handlePositions(input: Input, ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.portfolio ?? getPortfolioClient();
  const response = await client.getPositions(input.instrument);

  const positions = response.positions.map((p) => ({
    instrument: p.instrument,
    quantity: p.quantity,
    avgPrice: p.avgPrice,
    unrealizedPnl: p.unrealizedPnl,
    realizedPnl: p.realizedPnl,
    updatedAt: p.updatedAt,
  }));

  return JSON.stringify({
    data: { totalPositions: positions.length, positions },
  });
}

async function handlePnLHistory(input: Input, ctx: ToolContext): Promise<string> {
  const client = ctx.grpc?.portfolio ?? getPortfolioClient();
  const response = await client.getPnLHistory({
    instrument: input.instrument,
    startDate: input.start_date,
    endDate: input.end_date,
  });

  const entries = response.entries.map((e) => ({
    date: e.date,
    instrument: e.instrument,
    totalPnl: e.totalPnl,
    realizedPnl: e.realizedPnl,
    unrealizedPnl: e.unrealizedPnl,
  }));

  return JSON.stringify({ data: { entries } });
}

async function handleCrossExchangeSummary(ctx: ToolContext): Promise<string> {
  const exchangeClient = ctx.grpc?.exchange ?? getExchangeClient();

  const results = await Promise.allSettled(
    SUPPORTED_EXCHANGES.map(async (exchange) => {
      const response = await exchangeClient.getAccountBalance(exchange);
      return { exchange, balances: response.balances };
    }),
  );

  const exchangeBalances: Array<{
    exchange: string;
    balances: Array<{ asset: string; free: number; locked: number; total: number }>;
    totalUsdtValue: number;
  }> = [];
  const errors: Array<{ exchange: string; error: string }> = [];
  const assetTotals: Record<string, { free: number; locked: number; total: number }> = {};
  let grandTotal = 0;

  for (const [i, result] of results.entries()) {
    const exchange = SUPPORTED_EXCHANGES[i];
    if (result.status === 'fulfilled') {
      let exchangeTotal = 0;
      const balances = result.value.balances.map((b) => {
        if (!assetTotals[b.asset]) {
          assetTotals[b.asset] = { free: 0, locked: 0, total: 0 };
        }
        assetTotals[b.asset].free += b.free;
        assetTotals[b.asset].locked += b.locked;
        assetTotals[b.asset].total += b.total;

        if (b.asset === 'USDT' || b.asset === 'USDC' || b.asset === 'USD') {
          exchangeTotal += b.total;
        }
        return { asset: b.asset, free: b.free, locked: b.locked, total: b.total };
      });
      exchangeBalances.push({ exchange, balances, totalUsdtValue: exchangeTotal });
      grandTotal += exchangeTotal;
    } else {
      errors.push({ exchange, error: String(result.reason) });
    }
  }

  const distribution = exchangeBalances.map((eb) => ({
    exchange: eb.exchange,
    usdtValue: eb.totalUsdtValue,
    percentage: grandTotal > 0 ? Math.round((eb.totalUsdtValue / grandTotal) * 10000) / 100 : 0,
  }));

  return JSON.stringify({
    data: {
      exchangeBalances,
      aggregatedAssets: Object.entries(assetTotals).map(([asset, totals]) => ({
        asset,
        ...totals,
      })),
      totalUsdtValue: grandTotal,
      distribution,
      exchangesQueried: SUPPORTED_EXCHANGES.length,
      exchangesSucceeded: exchangeBalances.length,
      ...(errors.length > 0 ? { errors } : {}),
    },
  });
}

async function handleCrossExchangePositions(ctx: ToolContext): Promise<string> {
  const exchangeClient = ctx.grpc?.exchange ?? getExchangeClient();

  const results = await Promise.allSettled(
    SUPPORTED_EXCHANGES.map(async (exchange) => {
      const response = await exchangeClient.getExchangePositions(exchange);
      return { exchange, positions: response.positions };
    }),
  );

  const allPositions: Array<{
    exchange: string;
    symbol: string;
    side: string;
    quantity: number;
    entryPrice: number;
    unrealizedPnl: number;
    leverage: number;
    markPrice: number;
    liquidationPrice: number;
    marginType: string;
  }> = [];
  const errors: Array<{ exchange: string; error: string }> = [];
  let totalUnrealizedPnl = 0;

  for (const [i, result] of results.entries()) {
    const exchange = SUPPORTED_EXCHANGES[i];
    if (result.status === 'fulfilled') {
      for (const p of result.value.positions) {
        totalUnrealizedPnl += p.unrealizedPnl;
        allPositions.push({
          exchange,
          symbol: p.symbol,
          side: p.side,
          quantity: p.quantity,
          entryPrice: p.entryPrice,
          unrealizedPnl: p.unrealizedPnl,
          leverage: p.leverage,
          markPrice: p.markPrice,
          liquidationPrice: p.liquidationPrice,
          marginType: p.marginType,
        });
      }
    } else {
      errors.push({ exchange, error: String(result.reason) });
    }
  }

  return JSON.stringify({
    data: {
      totalPositions: allPositions.length,
      totalUnrealizedPnl,
      positions: allPositions,
      exchangesQueried: SUPPORTED_EXCHANGES.length,
      exchangesSucceeded: SUPPORTED_EXCHANGES.length - errors.length,
      ...(errors.length > 0 ? { errors } : {}),
    },
  });
}

export default definePlugin({
  id: 'portfolio',
  domain: 'portfolio',
  riskLevel: 'safe',
  description: PORTFOLIO_DESCRIPTION,
  schema,
  execute: async (raw, ctx) => {
    const input = schema.parse(raw);

    switch (input.action) {
      case 'summary':
        return handleSummary(ctx);
      case 'trades':
        return handleTrades(input, ctx);
      case 'positions':
        return handlePositions(input, ctx);
      case 'pnl_history':
        return handlePnLHistory(input, ctx);
      case 'cross_exchange_summary':
        return handleCrossExchangeSummary(ctx);
      case 'cross_exchange_positions':
        return handleCrossExchangePositions(ctx);
    }
  },
});
