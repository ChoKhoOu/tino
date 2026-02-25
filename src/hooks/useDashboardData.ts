/**
 * Real-time dashboard data hook.
 *
 * Fetches market tickers from Binance, funding rates from OKX,
 * and portfolio data via gRPC. Refreshes on independent intervals
 * and cleans up on unmount.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getTicker24h } from '../tools/finance/binance-public/index.js';
import { getFundingRate } from '../tools/finance/okx/index.js';
import { PortfolioClient } from '../grpc/portfolio-client.js';
import type { BinanceTicker24h } from '../tools/finance/binance-public/types.js';

// ============================================================================
// Data types
// ============================================================================

export interface MarketItem {
  symbol: string;
  price: number;
  change: number;
  volume: number;
}

export interface PositionItem {
  symbol: string;
  side: 'Long' | 'Short';
  size: string;
  pnl: number;
}

export interface FundingRateItem {
  rank: number;
  symbol: string;
  rate: number;
}

export interface StrategyItem {
  name: string;
  status: 'Running' | 'Paused' | 'Stopped';
  returnPct: number;
}

export interface DashboardData {
  market: MarketItem[];
  positions: PositionItem[];
  totalPnl: number;
  fundingRates: FundingRateItem[];
  strategies: StrategyItem[];
  lastUpdated: Date | null;
  isLoading: boolean;
  daemonConnected: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const MARKET_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

const FUNDING_INSTRUMENTS = [
  'BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'DOGE-USDT-SWAP',
  'SOL-USDT-SWAP', 'XRP-USDT-SWAP', 'PEPE-USDT-SWAP',
  'WIF-USDT-SWAP', 'SHIB-USDT-SWAP', 'BONK-USDT-SWAP',
  'BNB-USDT-SWAP',
];

export const MARKET_REFRESH_MS = 2_000;
export const FUNDING_REFRESH_MS = 60_000;
export const PORTFOLIO_REFRESH_MS = 5_000;

// ============================================================================
// Fetch helpers (exported for testing)
// ============================================================================

export async function fetchMarketData(): Promise<MarketItem[]> {
  const results = await Promise.allSettled(
    MARKET_SYMBOLS.map(sym => getTicker24h(sym)),
  );

  const items: MarketItem[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    if (result.status === 'fulfilled') {
      const t = result.value as BinanceTicker24h;
      const base = MARKET_SYMBOLS[i]!.replace('USDT', '');
      items.push({
        symbol: `${base}/USDT`,
        price: parseFloat(t.lastPrice),
        change: parseFloat(t.priceChangePercent),
        volume: parseFloat(t.quoteVolume),
      });
    }
  }
  return items;
}

export async function fetchFundingRates(): Promise<FundingRateItem[]> {
  const results = await Promise.allSettled(
    FUNDING_INSTRUMENTS.map(instId => getFundingRate(instId)),
  );

  const items: { symbol: string; rate: number }[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    if (result.status === 'fulfilled') {
      const fr = result.value;
      const parts = FUNDING_INSTRUMENTS[i]!.split('-');
      items.push({
        symbol: `${parts[0]}/${parts[1]}`,
        rate: parseFloat(fr.fundingRate) * 100,
      });
    }
  }

  items.sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate));
  return items.slice(0, 5).map((item, i) => ({ rank: i + 1, ...item }));
}

export async function fetchPortfolioData(client: PortfolioClient): Promise<{
  positions: PositionItem[];
  totalPnl: number;
}> {
  const [posRes, summaryRes] = await Promise.all([
    client.getPositions(),
    client.getSummary(),
  ]);

  const positions: PositionItem[] = (posRes.positions ?? []).map(p => ({
    symbol: p.instrument.split('/')[0] ?? p.instrument,
    side: (p.quantity < 0 ? 'Short' : 'Long') as 'Long' | 'Short',
    size: Math.abs(p.quantity).toFixed(4),
    pnl: p.unrealizedPnl,
  }));

  const totalPnl = (summaryRes.totalRealizedPnl ?? 0) + (summaryRes.totalUnrealizedPnl ?? 0);
  return { positions, totalPnl };
}

// ============================================================================
// Hook
// ============================================================================

const INITIAL: DashboardData = {
  market: [],
  positions: [],
  totalPnl: 0,
  fundingRates: [],
  strategies: [],
  lastUpdated: null,
  isLoading: true,
  daemonConnected: false,
};

export function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>(INITIAL);
  const clientRef = useRef<PortfolioClient | null>(null);
  const busyMarket = useRef(false);
  const busyFunding = useRef(false);
  const busyPortfolio = useRef(false);

  const refreshMarket = useCallback(async () => {
    if (busyMarket.current) return;
    busyMarket.current = true;
    try {
      const market = await fetchMarketData();
      if (market.length > 0) {
        setData(prev => ({ ...prev, market, lastUpdated: new Date(), isLoading: false }));
      }
    } catch {
      // keep stale data on failure
    } finally {
      busyMarket.current = false;
    }
  }, []);

  const refreshFunding = useCallback(async () => {
    if (busyFunding.current) return;
    busyFunding.current = true;
    try {
      const fundingRates = await fetchFundingRates();
      if (fundingRates.length > 0) {
        setData(prev => ({ ...prev, fundingRates }));
      }
    } catch {
      // keep stale data
    } finally {
      busyFunding.current = false;
    }
  }, []);

  const refreshPortfolio = useCallback(async () => {
    if (busyPortfolio.current) return;
    busyPortfolio.current = true;
    try {
      if (!clientRef.current) clientRef.current = new PortfolioClient();
      const { positions, totalPnl } = await fetchPortfolioData(clientRef.current);
      setData(prev => ({ ...prev, positions, totalPnl, daemonConnected: true }));
    } catch {
      setData(prev => ({ ...prev, daemonConnected: false }));
    } finally {
      busyPortfolio.current = false;
    }
  }, []);

  useEffect(() => {
    refreshMarket();
    refreshFunding();
    refreshPortfolio();

    const t1 = setInterval(refreshMarket, MARKET_REFRESH_MS);
    const t2 = setInterval(refreshFunding, FUNDING_REFRESH_MS);
    const t3 = setInterval(refreshPortfolio, PORTFOLIO_REFRESH_MS);

    return () => {
      clearInterval(t1);
      clearInterval(t2);
      clearInterval(t3);
    };
  }, [refreshMarket, refreshFunding, refreshPortfolio]);

  return data;
}
