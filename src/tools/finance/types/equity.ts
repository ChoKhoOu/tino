/**
 * FMP (Financial Modeling Prep) response types.
 * Equity fundamentals, financials, and historical pricing.
 */

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
