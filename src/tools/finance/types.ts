/**
 * Unified response types for external financial data source clients.
 *
 * Each data source has its own response shapes. These types give
 * downstream consumers a consistent contract to code against.
 *
 * Types are organized by domain in ./types/ and re-exported here
 * so existing imports continue to work unchanged.
 */

export type {
  FmpFinancialStatement,
  FmpKeyMetric,
  FmpRatio,
  FmpDcf,
  FmpHistoricalPrice,
  FmpInsiderTrade,
  FmpEarningsTranscript,
} from './types/equity.js';

export type {
  FredObservation,
  FredSeriesInfo,
  FredSearchResult,
} from './types/macro.js';

export type {
  CoinGeckoPriceEntry,
  CoinGeckoPrice,
  CoinGeckoMarketData,
  CoinGeckoHistoryPoint,
  CoinGeckoCoin,
} from './types/crypto.js';

export type {
  PolygonBar,
  PolygonBarsResponse,
  PolygonTickerDetails,
  PolygonOptionsContract,
  PolygonOptionQuote,
  PolygonSnapshot,
} from './types/polygon.js';

export type {
  FinnhubNewsItem,
  FinnhubSentiment,
  FinnhubSentimentResponse,
  FinnhubEarningsEvent,
  FinnhubInsiderTransaction,
  FinnhubInsiderResponse,
} from './types/finnhub.js';

export type {
  OptionsContract,
  OptionQuote,
  OptionsChainData,
} from './types/options.js';

export type {
  CoinGlassResponse,
  CoinGlassFundingRate,
  CoinGlassFundingRateHistory,
  CoinGlassOpenInterest,
  CoinGlassOpenInterestHistory,
  CoinGlassLongShortRatio,
  CoinGlassLiquidation,
  CoinGlassLiquidationHistory,
  CoinGlassFuturesPremium,
} from './types/coinglass.js';
