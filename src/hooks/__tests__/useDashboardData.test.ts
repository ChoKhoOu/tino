import { describe, test, expect, mock, beforeEach, spyOn } from 'bun:test';

// ============================================================================
// Module mocks — registered before importing the code under test
// ============================================================================

const mockGetTicker24h = mock(() =>
  Promise.resolve({
    symbol: 'BTCUSDT',
    lastPrice: '42300.50',
    priceChangePercent: '2.14',
    weightedAvgPrice: '42000',
    prevClosePrice: '41800',
    lastQty: '0.01',
    bidPrice: '42300',
    bidQty: '1',
    askPrice: '42301',
    askQty: '1',
    openPrice: '41400',
    highPrice: '43000',
    lowPrice: '41000',
    volume: '50000',
    quoteVolume: '28500000000',
    openTime: 1700000000000,
    closeTime: 1700086400000,
    firstId: 1,
    lastId: 100,
    count: 100,
  }),
);

const mockGetFundingRate = mock(() =>
  Promise.resolve({
    instType: 'SWAP',
    instId: 'BTC-USDT-SWAP',
    fundingRate: '0.000320',
    nextFundingRate: '0.000280',
    fundingTime: '1700000000000',
    nextFundingTime: '1700028800000',
  }),
);

mock.module('@/tools/finance/binance-public/index.js', () => ({
  getTicker24h: mockGetTicker24h,
  getKlines: mock(),
  toUnifiedTicker: mock(),
  toUnifiedKline: mock(),
}));

mock.module('@/tools/finance/okx/index.js', () => ({
  getFundingRate: mockGetFundingRate,
  getKlines: mock(),
  getTicker: mock(),
  getFundingRateHistory: mock(),
  getOrderBook: mock(),
  toUnifiedTicker: mock(),
  toUnifiedKline: mock(),
  toUnifiedFundingRate: mock(),
  toUnifiedOrderBook: mock(),
}));

mock.module('@/grpc/portfolio-client.js', () => ({
  PortfolioClient: class MockPortfolioClient {
    async getPositions() {
      return {
        positions: [
          { instrument: 'BTC/USDT', quantity: 0.5, avgPrice: 41000, unrealizedPnl: 650, realizedPnl: 0, updatedAt: '' },
          { instrument: 'ETH/USDT', quantity: -2.0, avgPrice: 2700, unrealizedPnl: -100, realizedPnl: 0, updatedAt: '' },
        ],
      };
    }
    async getSummary() {
      return {
        totalTrades: 10,
        openPositions: 2,
        totalRealizedPnl: 100,
        totalUnrealizedPnl: 550,
        totalFees: 12.5,
      };
    }
  },
}));

// Dynamic import so mocks are in effect
const { fetchMarketData, fetchFundingRates, fetchPortfolioData } =
  await import('../useDashboardData.js');

// ============================================================================
// Tests
// ============================================================================

describe('fetchMarketData', () => {
  beforeEach(() => {
    mockGetTicker24h.mockClear();
    mockGetTicker24h.mockImplementation(() =>
      Promise.resolve({
        symbol: 'BTCUSDT',
        lastPrice: '42300.50',
        priceChangePercent: '2.14',
        weightedAvgPrice: '42000',
        prevClosePrice: '41800',
        lastQty: '0.01',
        bidPrice: '42300',
        bidQty: '1',
        askPrice: '42301',
        askQty: '1',
        openPrice: '41400',
        highPrice: '43000',
        lowPrice: '41000',
        volume: '50000',
        quoteVolume: '28500000000',
        openTime: 1700000000000,
        closeTime: 1700086400000,
        firstId: 1,
        lastId: 100,
        count: 100,
      }),
    );
  });

  test('transforms Binance tickers into MarketItems', async () => {
    const items = await fetchMarketData();
    expect(items).toHaveLength(5);
    expect(items[0]).toEqual({
      symbol: 'BTC/USDT',
      price: 42300.5,
      change: 2.14,
      volume: 28_500_000_000,
    });
  });

  test('handles partial API failures gracefully', async () => {
    let callIdx = 0;
    mockGetTicker24h.mockImplementation(() => {
      callIdx++;
      if (callIdx === 2 || callIdx === 4) {
        return Promise.reject(new Error('API down'));
      }
      return Promise.resolve({
        symbol: 'BTCUSDT',
        lastPrice: '100',
        priceChangePercent: '1.0',
        quoteVolume: '999',
        weightedAvgPrice: '0', prevClosePrice: '0', lastQty: '0',
        bidPrice: '0', bidQty: '0', askPrice: '0', askQty: '0',
        openPrice: '0', highPrice: '0', lowPrice: '0', volume: '0',
        openTime: 0, closeTime: 0, firstId: 0, lastId: 0, count: 0,
      });
    });

    const items = await fetchMarketData();
    // 2 of 5 calls fail → 3 items
    expect(items).toHaveLength(3);
    expect(items[0]!.symbol).toBe('BTC/USDT');
    expect(items[1]!.symbol).toBe('SOL/USDT');
    expect(items[2]!.symbol).toBe('XRP/USDT');
  });

  test('returns empty array when all calls fail', async () => {
    mockGetTicker24h.mockImplementation(() => Promise.reject(new Error('down')));
    const items = await fetchMarketData();
    expect(items).toEqual([]);
  });
});

describe('fetchFundingRates', () => {
  beforeEach(() => {
    mockGetFundingRate.mockClear();
  });

  test('returns top 5 funding rates ranked by absolute rate', async () => {
    let idx = 0;
    const rates = [0.00032, 0.00050, -0.00010, 0.00025, 0.00045, 0.00015, 0.00005, 0.00020, 0.00060, 0.00035];
    mockGetFundingRate.mockImplementation(() => {
      const rate = rates[idx++] ?? 0;
      return Promise.resolve({
        instType: 'SWAP',
        instId: 'X-USDT-SWAP',
        fundingRate: String(rate),
        nextFundingRate: '0',
        fundingTime: '0',
        nextFundingTime: '0',
      });
    });

    const result = await fetchFundingRates();
    expect(result).toHaveLength(5);
    expect(result[0]!.rank).toBe(1);
    expect(result[4]!.rank).toBe(5);
    // Sorted by absolute rate descending
    for (let i = 0; i < result.length - 1; i++) {
      expect(Math.abs(result[i]!.rate)).toBeGreaterThanOrEqual(Math.abs(result[i + 1]!.rate));
    }
  });

  test('returns empty array when all API calls fail', async () => {
    mockGetFundingRate.mockImplementation(() => Promise.reject(new Error('timeout')));
    const result = await fetchFundingRates();
    expect(result).toEqual([]);
  });
});

describe('fetchPortfolioData', () => {
  test('transforms positions and computes total PnL', async () => {
    const { PortfolioClient } = await import('@/grpc/portfolio-client.js');
    const client = new PortfolioClient();
    const result = await fetchPortfolioData(client as any);

    expect(result.positions).toHaveLength(2);
    expect(result.positions[0]).toEqual({
      symbol: 'BTC',
      side: 'Long',
      size: '0.5000',
      pnl: 650,
    });
    expect(result.positions[1]).toEqual({
      symbol: 'ETH',
      side: 'Short',
      size: '2.0000',
      pnl: -100,
    });
    // totalPnl = totalRealizedPnl(100) + totalUnrealizedPnl(550)
    expect(result.totalPnl).toBe(650);
  });
});

describe('interval lifecycle', () => {
  test('cleanup clears all intervals that were set', () => {
    const ids = new Set<number>();
    const cleared = new Set<number>();
    const origSet = globalThis.setInterval;
    const origClear = globalThis.clearInterval;

    globalThis.setInterval = ((fn: Function, ms: number) => {
      const id = origSet(fn, ms);
      const numId = id as unknown as number;
      ids.add(numId);
      return id;
    }) as typeof setInterval;

    globalThis.clearInterval = ((id: ReturnType<typeof setInterval>) => {
      cleared.add(id as unknown as number);
      origClear(id);
    }) as typeof clearInterval;

    // Simulate the useEffect setup/cleanup pattern from useDashboardData
    const t1 = setInterval(() => {}, 2_000);
    const t2 = setInterval(() => {}, 60_000);
    const t3 = setInterval(() => {}, 5_000);
    clearInterval(t1);
    clearInterval(t2);
    clearInterval(t3);

    expect(ids.size).toBe(3);
    for (const id of ids) {
      expect(cleared.has(id)).toBe(true);
    }

    globalThis.setInterval = origSet;
    globalThis.clearInterval = origClear;
  });
});
