/**
 * EODHD response types.
 * HK stock data, real-time quotes, historical prices, and fundamentals.
 */

export interface EodhdRealTimeQuote {
  code: string;
  timestamp: number;
  gmtoffset: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  previousClose: number;
  change: number;
  change_p: number;
}

export interface EodhdHistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
}

export interface EodhdFundamentals {
  General: {
    Code: string;
    Name: string;
    Exchange: string;
    CurrencyCode: string;
    CurrencyName: string;
    CountryName: string;
    Sector: string;
    Industry: string;
    Description: string;
    [key: string]: string | number | null | undefined;
  };
  Highlights: {
    MarketCapitalization: number | null;
    EBITDA: number | null;
    PERatio: number | null;
    PEGRatio: number | null;
    DividendYield: number | null;
    EarningsShare: number | null;
    BookValue: number | null;
    RevenueTTM: number | null;
    ProfitMargin: number | null;
    [key: string]: string | number | null | undefined;
  };
  [key: string]: unknown;
}

export interface HkStockPrice {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  currency: 'HKD';
}
