/**
 * Unified response types for external financial data source clients.
 *
 * Each data source has its own response shapes. These types give
 * downstream consumers a consistent contract to code against.
 */

// ============================================================================
// FMP (Financial Modeling Prep)
// ============================================================================

export interface FmpFinancialStatement {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fillingDate: string;
  acceptedDate: string;
  calendarYear: string;
  period: string;
  [key: string]: string | number | null;
}

export interface FmpKeyMetric {
  date: string;
  symbol: string;
  period: string;
  revenuePerShare: number | null;
  netIncomePerShare: number | null;
  operatingCashFlowPerShare: number | null;
  freeCashFlowPerShare: number | null;
  peRatio: number | null;
  priceToSalesRatio: number | null;
  [key: string]: string | number | null;
}

export interface FmpRatio {
  date: string;
  symbol: string;
  period: string;
  currentRatio: number | null;
  quickRatio: number | null;
  debtEquityRatio: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  [key: string]: string | number | null;
}

export interface FmpDcf {
  symbol: string;
  date: string;
  dcf: number;
  stockPrice: number;
}

export interface FmpHistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
  unadjustedVolume: number;
  change: number;
  changePercent: number;
  vwap: number;
  label: string;
  changeOverTime: number;
}

export interface FmpInsiderTrade {
  symbol: string;
  filingDate: string;
  transactionDate: string;
  reportingCik: string;
  transactionType: string;
  securitiesOwned: number;
  securitiesTransacted: number;
  securityName: string;
  price: number;
  formType: string;
  link: string;
}

export interface FmpEarningsTranscript {
  symbol: string;
  quarter: number;
  year: number;
  date: string;
  content: string;
}

// ============================================================================
// FRED (Federal Reserve Economic Data)
// ============================================================================

export interface FredObservation {
  date: string;
  value: string; // FRED returns values as strings
}

export interface FredSeriesInfo {
  id: string;
  title: string;
  observation_start: string;
  observation_end: string;
  frequency: string;
  frequency_short: string;
  units: string;
  units_short: string;
  seasonal_adjustment: string;
  seasonal_adjustment_short: string;
  notes: string;
}

export interface FredSearchResult {
  id: string;
  title: string;
  observation_start: string;
  observation_end: string;
  frequency: string;
  units: string;
  popularity: number;
}

// ============================================================================
// CoinGecko
// ============================================================================

export interface CoinGeckoPriceEntry {
  [key: string]: number | undefined;
}

export interface CoinGeckoPrice {
  [coinId: string]: CoinGeckoPriceEntry;
}

export interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number | null;
  market_data: {
    current_price: Record<string, number>;
    market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    circulating_supply: number;
    total_supply: number | null;
    max_supply: number | null;
    price_change_percentage_24h: number | null;
    price_change_percentage_7d: number | null;
    price_change_percentage_30d: number | null;
  };
}

export interface CoinGeckoHistoryPoint {
  timestamp: number;
  price: number;
}

export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number | null;
}

// ============================================================================
// SEC EDGAR
// ============================================================================

export interface EdgarFiling {
  dateRange: string;
  category: string;
  form: string;
  description: string;
  fileUrl: string;
  filedAt: string;
}

export interface EdgarSearchResponse {
  query: string;
  total: { value: number };
  hits: Array<{
    _id: string;
    _source: {
      file_date: string;
      form_type: string;
      entity_name: string;
      file_num: string;
      period_of_report: string;
      file_url?: string;
    };
  }>;
}

export interface EdgarCompanyFact {
  taxonomy: string;
  tag: string;
  label: string;
  description: string;
  units: Record<
    string,
    Array<{
      val: number;
      end: string;
      start?: string;
      accn: string;
      fy: number;
      fp: string;
      form: string;
      filed: string;
    }>
  >;
}

export interface EdgarCompanyFacts {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, EdgarCompanyFact>>;
}

export interface EdgarSubmissions {
  cik: string;
  entityType: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}

// ============================================================================
// Polygon.io
// ============================================================================

export interface PolygonBar {
  /** Open price */
  o: number;
  /** High price */
  h: number;
  /** Low price */
  l: number;
  /** Close price */
  c: number;
  /** Volume */
  v: number;
  /** Volume-weighted average price */
  vw: number;
  /** Timestamp (ms) */
  t: number;
  /** Number of transactions */
  n: number;
}

export interface PolygonBarsResponse {
  ticker: string;
  queryCount: number;
  resultsCount: number;
  results: PolygonBar[];
  status: string;
  adjusted: boolean;
}

export interface PolygonTickerDetails {
  ticker: string;
  name: string;
  market: string;
  locale: string;
  primary_exchange: string;
  type: string;
  currency_name: string;
  market_cap: number | null;
  phone_number: string;
  address: {
    address1: string;
    city: string;
    state: string;
  };
  description: string;
  sic_code: string;
  sic_description: string;
  total_employees: number | null;
  list_date: string;
  homepage_url: string;
  branding: {
    logo_url: string;
    icon_url: string;
  };
}

export interface PolygonOptionsContract {
  ticker: string;
  underlying_ticker: string;
  contract_type: 'call' | 'put';
  expiration_date: string;
  strike_price: number;
  exercise_style: string;
}

export interface PolygonOptionQuote {
  T: string;
  t: number;
  y: number;
  q: number;
  i: string;
  p: number;
  s: number;
  x: number;
  c: number[];
}

export interface PolygonSnapshot {
  ticker: {
    ticker: string;
    todaysChangePerc: number;
    todaysChange: number;
    updated: number;
    day: PolygonBar;
    prevDay: PolygonBar;
    min: PolygonBar;
  };
  status: string;
}

// ============================================================================
// Finnhub
// ============================================================================

export interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface FinnhubSentiment {
  symbol: string;
  year: number;
  month: number;
  change: number;
  mspr: number;
}

export interface FinnhubSentimentResponse {
  symbol: string;
  data: FinnhubSentiment[];
}

export interface FinnhubEarningsEvent {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
}

export interface FinnhubInsiderTransaction {
  symbol: string;
  name: string;
  share: number;
  change: number;
  filingDate: string;
  transactionDate: string;
  transactionCode: string;
  transactionPrice: number;
}

export interface FinnhubInsiderResponse {
  symbol: string;
  data: FinnhubInsiderTransaction[];
}

// ============================================================================
// EODHD (HK Stock Data)
// ============================================================================

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

// ============================================================================
// Options (US Derivatives)
// ============================================================================

export interface OptionsContract {
  ticker: string;
  underlyingTicker: string;
  contractType: 'call' | 'put';
  strikePrice: number;
  expirationDate: string;
  exerciseStyle: string;
}

export interface OptionQuote {
  ticker: string;
  price: number;
  size: number;
  timestamp: number;
  conditions: number[];
}

export interface OptionsChainData {
  underlyingTicker: string;
  contracts: OptionsContract[];
}
