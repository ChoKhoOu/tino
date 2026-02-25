/**
 * Multi-exchange funding rate arbitrage analysis.
 *
 * Fetches funding rates from CoinGlass (primary) and direct exchange APIs
 * (Binance, OKX, Bybit), identifies arbitrage opportunities, and backtests
 * historical performance.
 *
 * Strategy: short on high-rate exchange + long on low-rate exchange,
 * collect rate differential every 8h funding settlement.
 */
import { getOptionalApiKey } from '../shared.js';
import { getFundingRates as getCoinGlassFundingRates } from '../coinglass/index.js';
import { getCurrentFundingRates as getBinanceFundingRates, getHistoricalFundingRates as getBinanceHistoricalRates } from '../funding-rates/index.js';
import { getFundingRate as getOkxFundingRate, getFundingRateHistory as getOkxFundingRateHistory } from '../okx/index.js';
import { getFundingRate as getBybitFundingRate, getFundingRateHistory as getBybitFundingRateHistory } from '../bybit/index.js';
import type {
  NormalizedFundingRate,
  ExchangeFees,
  FeeEstimate,
  ArbitrageOpportunity,
  ArbitrageBacktestResult,
  HistoricalFundingRate,
  SettlementRecord,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** Funding settlements per day (every 8 hours). */
const SETTLEMENTS_PER_DAY = 3;
const SETTLEMENTS_PER_YEAR = SETTLEMENTS_PER_DAY * 365;

/** Default perpetual futures fee schedules (taker rates). */
const DEFAULT_FEES: Record<string, ExchangeFees> = {
  Binance: { maker: 0.0002, taker: 0.0004 },
  OKX: { maker: 0.0002, taker: 0.0005 },
  Bybit: { maker: 0.0002, taker: 0.00055 },
  Bitget: { maker: 0.0002, taker: 0.0006 },
  dYdX: { maker: 0.0002, taker: 0.0005 },
};

/** Default symbols to scan when none specified. */
const DEFAULT_SCAN_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT'];

/** Exchanges supported for direct API fetch. */
const DIRECT_EXCHANGES = ['Binance', 'OKX', 'Bybit'] as const;

// ============================================================================
// Symbol normalization
// ============================================================================

/** Extract base coin symbol from any format (BTCUSDT, BTC-USDT-SWAP, BTC). */
export function toBaseSymbol(input: string): string {
  return input
    .toUpperCase()
    .replace(/-USDT-SWAP$/i, '')
    .replace(/USDT$/i, '')
    .replace(/-USDT$/i, '');
}

function toBinanceSymbol(base: string): string {
  return `${base.toUpperCase()}USDT`;
}

function toOkxSwapSymbol(base: string): string {
  return `${base.toUpperCase()}-USDT-SWAP`;
}

function toBybitSymbol(base: string): string {
  return `${base.toUpperCase()}USDT`;
}

// ============================================================================
// Fee estimation
// ============================================================================

function getExchangeFees(exchange: string): ExchangeFees {
  return DEFAULT_FEES[exchange] ?? { maker: 0.0003, taker: 0.0006 };
}

/** Estimate round-trip fees for opening and closing both arbitrage legs. */
export function estimateFees(longExchange: string, shortExchange: string): FeeEstimate {
  const longFees = getExchangeFees(longExchange);
  const shortFees = getExchangeFees(shortExchange);

  // Entry: taker on both legs
  const totalEntryFee = longFees.taker + shortFees.taker;
  // Exit: taker on both legs
  const totalExitFee = longFees.taker + shortFees.taker;
  const roundTripFee = totalEntryFee + totalExitFee;

  return { totalEntryFee, totalExitFee, roundTripFee };
}

// ============================================================================
// Multi-exchange rate scanning
// ============================================================================

function normalizeRate(exchange: string, symbol: string, rate: number, nextFundingTime?: number, markPrice?: number): NormalizedFundingRate {
  return {
    exchange,
    symbol: toBaseSymbol(symbol),
    fundingRate: rate,
    annualizedRate: rate * SETTLEMENTS_PER_YEAR,
    nextFundingTime,
    markPrice,
  };
}

/** Try CoinGlass first (multi-exchange in one call), fall back to direct APIs. */
async function fetchRatesViaCoinGlass(symbol: string): Promise<NormalizedFundingRate[]> {
  const base = toBaseSymbol(symbol);
  const data = await getCoinGlassFundingRates(base);
  return data.map(entry =>
    normalizeRate(entry.exchange, entry.symbol, entry.fundingRate, entry.nextFundingTime)
  );
}

async function fetchRatesFromDirectAPIs(symbol: string): Promise<NormalizedFundingRate[]> {
  const base = toBaseSymbol(symbol);
  const results: NormalizedFundingRate[] = [];

  const tasks = [
    // Binance
    getBinanceFundingRates([toBinanceSymbol(base)])
      .then(entries => {
        for (const e of entries) {
          results.push(normalizeRate('Binance', e.symbol, e.fundingRate, e.fundingTime, e.markPrice));
        }
      })
      .catch(() => { /* skip on error */ }),

    // OKX
    getOkxFundingRate(toOkxSwapSymbol(base))
      .then(e => {
        results.push(normalizeRate('OKX', e.instId, parseFloat(e.fundingRate), parseInt(e.nextFundingTime, 10)));
      })
      .catch(() => { /* skip on error */ }),

    // Bybit
    getBybitFundingRate(toBybitSymbol(base))
      .then(e => {
        results.push(normalizeRate('Bybit', e.symbol, parseFloat(e.fundingRate), parseInt(e.fundingRateTimestamp, 10)));
      })
      .catch(() => { /* skip on error */ }),
  ];

  await Promise.all(tasks);
  return results;
}

/**
 * Scan funding rates across multiple exchanges for given symbols.
 * Uses CoinGlass API if available, otherwise falls back to direct exchange APIs.
 */
export async function scanMultiExchangeRates(
  symbols?: string[],
): Promise<Map<string, NormalizedFundingRate[]>> {
  const targets = symbols?.map(toBaseSymbol) ?? DEFAULT_SCAN_SYMBOLS;
  const hasCoinGlass = !!getOptionalApiKey('COINGLASS_API_KEY');

  const ratesBySymbol = new Map<string, NormalizedFundingRate[]>();

  const fetcher = hasCoinGlass ? fetchRatesViaCoinGlass : fetchRatesFromDirectAPIs;

  const tasks = targets.map(async (sym) => {
    try {
      const rates = await fetcher(sym);
      if (rates.length > 0) {
        ratesBySymbol.set(sym, rates);
      }
    } catch {
      // skip symbols that fail
    }
  });

  await Promise.all(tasks);
  return ratesBySymbol;
}

// ============================================================================
// Opportunity detection
// ============================================================================

function assessRisk(annualizedSpread: number, spreadStability?: number): 'low' | 'medium' | 'high' {
  if (annualizedSpread > 0.5) return 'high'; // >50% annualized is suspicious
  if (annualizedSpread > 0.2) return 'medium';
  return 'low';
}

/**
 * Find the best funding rate arbitrage opportunities.
 * For each symbol, finds the exchange pair with the largest rate differential.
 */
export async function findArbitrageOpportunities(
  symbols?: string[],
  topN = 10,
): Promise<ArbitrageOpportunity[]> {
  const ratesBySymbol = await scanMultiExchangeRates(symbols);
  const opportunities: ArbitrageOpportunity[] = [];

  for (const [symbol, rates] of ratesBySymbol) {
    if (rates.length < 2) continue;

    // Find min and max rate exchanges
    let minRate = rates[0]!;
    let maxRate = rates[0]!;
    for (const r of rates) {
      if (r.fundingRate < minRate.fundingRate) minRate = r;
      if (r.fundingRate > maxRate.fundingRate) maxRate = r;
    }

    if (minRate.exchange === maxRate.exchange) continue;

    const rateDifferential = maxRate.fundingRate - minRate.fundingRate;
    if (rateDifferential <= 0) continue;

    const annualizedSpread = rateDifferential * SETTLEMENTS_PER_YEAR;
    const estimatedDailyReturn = rateDifferential * SETTLEMENTS_PER_DAY;
    const fees = estimateFees(minRate.exchange, maxRate.exchange);
    // Amortize round-trip fee over assumed 30-day holding period
    const dailyAmortizedFee = fees.roundTripFee / 30;
    const netDailyReturn = estimatedDailyReturn - dailyAmortizedFee;

    opportunities.push({
      symbol,
      longExchange: minRate.exchange,
      shortExchange: maxRate.exchange,
      longRate: minRate.fundingRate,
      shortRate: maxRate.fundingRate,
      rateDifferential,
      annualizedSpread,
      estimatedDailyReturn,
      fees,
      netDailyReturn,
      riskLevel: assessRisk(annualizedSpread),
    });
  }

  // Sort by net daily return descending
  opportunities.sort((a, b) => b.netDailyReturn - a.netDailyReturn);
  return opportunities.slice(0, topN);
}

// ============================================================================
// Historical data fetching (for backtest)
// ============================================================================

async function fetchHistoricalRates(
  exchange: string,
  symbol: string,
  startTime: number,
  endTime: number,
): Promise<HistoricalFundingRate[]> {
  const base = toBaseSymbol(symbol);

  switch (exchange) {
    case 'Binance': {
      const data = await getBinanceHistoricalRates(toBinanceSymbol(base), startTime, endTime);
      return data.map(e => ({ timestamp: e.fundingTime, fundingRate: e.fundingRate }));
    }
    case 'OKX': {
      // OKX uses `before` (newer than) and `after` (older than) for pagination
      // We need to paginate since limit is 100
      const allRates: HistoricalFundingRate[] = [];
      let cursor: number | undefined = undefined;
      const instId = toOkxSwapSymbol(base);

      for (let i = 0; i < 20; i++) { // max 20 pages
        const data = await getOkxFundingRateHistory(instId, cursor, undefined, 100);
        if (data.length === 0) break;

        for (const e of data) {
          const ts = parseInt(e.fundingTime, 10);
          if (ts >= startTime && ts <= endTime) {
            allRates.push({ timestamp: ts, fundingRate: parseFloat(e.fundingRate) });
          }
        }

        const lastTs = parseInt(data[data.length - 1]!.fundingTime, 10);
        if (lastTs <= startTime) break;
        cursor = lastTs;
      }

      return allRates.sort((a, b) => a.timestamp - b.timestamp);
    }
    case 'Bybit': {
      const data = await getBybitFundingRateHistory(toBybitSymbol(base), startTime, endTime, 200);
      return data.map(e => ({
        timestamp: parseInt(e.fundingRateTimestamp, 10),
        fundingRate: parseFloat(e.fundingRate),
      })).sort((a, b) => a.timestamp - b.timestamp);
    }
    default:
      throw new Error(`Unsupported exchange for historical rates: ${exchange}`);
  }
}

// ============================================================================
// Backtest engine
// ============================================================================

/** Align two rate series by nearest timestamp (within 1h tolerance). */
export function alignSettlements(
  longRates: HistoricalFundingRate[],
  shortRates: HistoricalFundingRate[],
): SettlementRecord[] {
  const TOLERANCE_MS = 3600_000; // 1 hour
  const settlements: SettlementRecord[] = [];

  // Build a map of short rates by approximate 8h window
  const shortByTime = new Map<number, HistoricalFundingRate>();
  for (const r of shortRates) {
    // Round to nearest 8h window
    const key = Math.round(r.timestamp / (8 * 3600_000)) * (8 * 3600_000);
    shortByTime.set(key, r);
  }

  for (const longRate of longRates) {
    const key = Math.round(longRate.timestamp / (8 * 3600_000)) * (8 * 3600_000);
    const shortRate = shortByTime.get(key);

    if (shortRate && Math.abs(longRate.timestamp - shortRate.timestamp) <= TOLERANCE_MS) {
      settlements.push({
        timestamp: longRate.timestamp,
        longRate: longRate.fundingRate,
        shortRate: shortRate.fundingRate,
        spread: shortRate.fundingRate - longRate.fundingRate,
      });
    }
  }

  return settlements.sort((a, b) => a.timestamp - b.timestamp);
}

/** Compute backtest metrics from aligned settlement records. */
export function computeBacktestMetrics(
  settlements: SettlementRecord[],
  fees: FeeEstimate,
): Pick<ArbitrageBacktestResult, 'grossReturn' | 'totalFees' | 'netReturn' | 'annualizedReturn' | 'maxDrawdown' | 'winRate' | 'avgSpread' | 'medianSpread' | 'spreadStdDev' | 'sharpeRatio'> {
  if (settlements.length === 0) {
    return {
      grossReturn: 0, totalFees: fees.roundTripFee, netReturn: -fees.roundTripFee,
      annualizedReturn: 0, maxDrawdown: 0, winRate: 0,
      avgSpread: 0, medianSpread: 0, spreadStdDev: 0, sharpeRatio: 0,
    };
  }

  const spreads = settlements.map(s => s.spread);
  const grossReturn = spreads.reduce((sum, s) => sum + s, 0);
  const totalFees = fees.roundTripFee;
  const netReturn = grossReturn - totalFees;

  // Annualize based on actual period
  const periodMs = settlements[settlements.length - 1]!.timestamp - settlements[0]!.timestamp;
  const periodDays = Math.max(periodMs / 86_400_000, 1);
  const annualizedReturn = (netReturn / periodDays) * 365;

  // Win rate
  const wins = spreads.filter(s => s > 0).length;
  const winRate = wins / spreads.length;

  // Average spread
  const avgSpread = grossReturn / spreads.length;

  // Median spread
  const sorted = [...spreads].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianSpread = sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;

  // Std dev
  const variance = spreads.reduce((sum, s) => sum + (s - avgSpread) ** 2, 0) / spreads.length;
  const spreadStdDev = Math.sqrt(variance);

  // Sharpe-like ratio (annualized). Guard against near-zero std dev.
  const sharpeRatio = spreadStdDev > 1e-12
    ? (avgSpread / spreadStdDev) * Math.sqrt(SETTLEMENTS_PER_YEAR)
    : 0;

  // Max drawdown on cumulative PnL
  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;
  for (const s of spreads) {
    cumulative += s;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return {
    grossReturn, totalFees, netReturn, annualizedReturn,
    maxDrawdown, winRate, avgSpread, medianSpread, spreadStdDev, sharpeRatio,
  };
}

/**
 * Backtest a funding rate arbitrage strategy between two exchanges.
 *
 * @param symbol  - Coin symbol (e.g. "BTC")
 * @param longExchange  - Exchange to go long (lower rate)
 * @param shortExchange - Exchange to go short (higher rate)
 * @param days - Number of days to look back (default 30)
 */
export async function backtestArbitrage(
  symbol: string,
  longExchange: string,
  shortExchange: string,
  days = 30,
): Promise<ArbitrageBacktestResult> {
  const base = toBaseSymbol(symbol);
  const endTime = Date.now();
  const startTime = endTime - days * 86_400_000;

  // Fetch historical rates from both exchanges in parallel
  const [longRates, shortRates] = await Promise.all([
    fetchHistoricalRates(longExchange, base, startTime, endTime),
    fetchHistoricalRates(shortExchange, base, startTime, endTime),
  ]);

  if (longRates.length === 0 || shortRates.length === 0) {
    throw new Error(`Insufficient historical data for ${base} on ${longExchange}/${shortExchange}`);
  }

  // Align and compute
  const settlements = alignSettlements(longRates, shortRates);
  if (settlements.length === 0) {
    throw new Error(`No overlapping funding settlements found for ${base} between ${longExchange} and ${shortExchange}`);
  }

  const fees = estimateFees(longExchange, shortExchange);
  const metrics = computeBacktestMetrics(settlements, fees);

  const actualStart = settlements[0]!.timestamp;
  const actualEnd = settlements[settlements.length - 1]!.timestamp;
  const actualDays = Math.max((actualEnd - actualStart) / 86_400_000, 1);

  return {
    symbol: base,
    longExchange,
    shortExchange,
    period: { start: actualStart, end: actualEnd, days: actualDays },
    totalSettlements: settlements.length,
    settlements,
    ...metrics,
  };
}

// ============================================================================
// Comprehensive analysis
// ============================================================================

/**
 * Analyze a specific arbitrage opportunity with current rates and historical backtest.
 * Returns a structured analysis suitable for AI agent evaluation.
 */
export async function analyzeOpportunity(
  symbol: string,
  longExchange: string,
  shortExchange: string,
  backtestDays = 30,
): Promise<{
  currentRates: { long: NormalizedFundingRate | null; short: NormalizedFundingRate | null };
  opportunity: ArbitrageOpportunity | null;
  backtest: ArbitrageBacktestResult | null;
  summary: string;
}> {
  const base = toBaseSymbol(symbol);

  // Fetch current rates
  const ratesBySymbol = await scanMultiExchangeRates([base]);
  const rates = ratesBySymbol.get(base) ?? [];

  const longRate = rates.find(r => r.exchange === longExchange) ?? null;
  const shortRate = rates.find(r => r.exchange === shortExchange) ?? null;

  let opportunity: ArbitrageOpportunity | null = null;
  if (longRate && shortRate) {
    const rateDifferential = shortRate.fundingRate - longRate.fundingRate;
    const annualizedSpread = rateDifferential * SETTLEMENTS_PER_YEAR;
    const estimatedDailyReturn = rateDifferential * SETTLEMENTS_PER_DAY;
    const fees = estimateFees(longExchange, shortExchange);
    const dailyAmortizedFee = fees.roundTripFee / 30;
    const netDailyReturn = estimatedDailyReturn - dailyAmortizedFee;

    opportunity = {
      symbol: base,
      longExchange,
      shortExchange,
      longRate: longRate.fundingRate,
      shortRate: shortRate.fundingRate,
      rateDifferential,
      annualizedSpread,
      estimatedDailyReturn,
      fees,
      netDailyReturn,
      riskLevel: assessRisk(annualizedSpread),
    };
  }

  // Run backtest
  let backtest: ArbitrageBacktestResult | null = null;
  try {
    backtest = await backtestArbitrage(base, longExchange, shortExchange, backtestDays);
  } catch {
    // backtest may fail if historical data is unavailable
  }

  // Build summary
  const lines: string[] = [];
  lines.push(`=== Funding Rate Arbitrage Analysis: ${base} ===`);
  lines.push(`Strategy: Long ${longExchange} / Short ${shortExchange}`);
  lines.push('');

  if (opportunity) {
    lines.push('-- Current Rates --');
    lines.push(`${longExchange} rate: ${fmtRate(opportunity.longRate)} (annualized: ${fmtPct(opportunity.longRate * SETTLEMENTS_PER_YEAR)})`);
    lines.push(`${shortExchange} rate: ${fmtRate(opportunity.shortRate)} (annualized: ${fmtPct(opportunity.shortRate * SETTLEMENTS_PER_YEAR)})`);
    lines.push(`Rate differential: ${fmtRate(opportunity.rateDifferential)}`);
    lines.push(`Annualized spread: ${fmtPct(opportunity.annualizedSpread)}`);
    lines.push(`Estimated daily return: ${fmtPct(opportunity.estimatedDailyReturn)}`);
    lines.push(`Round-trip fees: ${fmtPct(opportunity.fees.roundTripFee)}`);
    lines.push(`Net daily return (30d amortized fees): ${fmtPct(opportunity.netDailyReturn)}`);
    lines.push(`Risk level: ${opportunity.riskLevel}`);
  } else {
    lines.push('Current rate data unavailable for one or both exchanges.');
  }

  if (backtest) {
    lines.push('');
    lines.push(`-- ${backtestDays}-Day Backtest --`);
    lines.push(`Settlements: ${backtest.totalSettlements}`);
    lines.push(`Gross return: ${fmtPct(backtest.grossReturn)}`);
    lines.push(`Net return (after fees): ${fmtPct(backtest.netReturn)}`);
    lines.push(`Annualized return: ${fmtPct(backtest.annualizedReturn)}`);
    lines.push(`Win rate: ${fmtPct(backtest.winRate)}`);
    lines.push(`Max drawdown: ${fmtPct(backtest.maxDrawdown)}`);
    lines.push(`Sharpe ratio: ${backtest.sharpeRatio.toFixed(2)}`);
    lines.push(`Avg spread: ${fmtRate(backtest.avgSpread)}`);
    lines.push(`Spread std dev: ${fmtRate(backtest.spreadStdDev)}`);
  }

  return {
    currentRates: { long: longRate, short: shortRate },
    opportunity,
    backtest,
    summary: lines.join('\n'),
  };
}

// ============================================================================
// Formatting helpers
// ============================================================================

function fmtRate(rate: number): string {
  return `${(rate * 100).toFixed(4)}%`;
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
