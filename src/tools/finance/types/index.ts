/**
 * Barrel re-exports for all financial data source types.
 */

export type {
  FmpFinancialStatement,
  FmpKeyMetric,
  FmpRatio,
  FmpDcf,
  FmpHistoricalPrice,
  FmpInsiderTrade,
  FmpEarningsTranscript,
} from './equity.js';

export type {
  FredObservation,
  FredSeriesInfo,
  FredSearchResult,
} from './macro.js';

export type {
  CoinGeckoPriceEntry,
  CoinGeckoPrice,
  CoinGeckoMarketData,
  CoinGeckoHistoryPoint,
  CoinGeckoCoin,
} from './crypto.js';

export type {
  EdgarFiling,
  EdgarSearchResponse,
  EdgarCompanyFact,
  EdgarCompanyFacts,
  EdgarSubmissions,
} from './edgar.js';

export type {
  PolygonBar,
  PolygonBarsResponse,
  PolygonTickerDetails,
  PolygonOptionsContract,
  PolygonOptionQuote,
  PolygonSnapshot,
} from './polygon.js';

export type {
  FinnhubNewsItem,
  FinnhubSentiment,
  FinnhubSentimentResponse,
  FinnhubEarningsEvent,
  FinnhubInsiderTransaction,
  FinnhubInsiderResponse,
} from './finnhub.js';

export type {
  EodhdRealTimeQuote,
  EodhdHistoricalPrice,
  EodhdFundamentals,
  HkStockPrice,
} from './eodhd.js';

export type {
  OptionsContract,
  OptionQuote,
  OptionsChainData,
} from './options.js';
