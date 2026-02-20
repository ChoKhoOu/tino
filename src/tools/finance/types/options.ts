/**
 * Options (US Derivatives) response types.
 * Contracts, quotes, and chain data.
 */

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
