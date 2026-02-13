import { describe, test, expect, beforeEach } from 'bun:test';
import { createReverseSearch, type ReverseSearchState } from '../useReverseSearch.js';

describe('createReverseSearch', () => {
  const history = [
    'backtest AAPL momentum',
    'show portfolio',
    'backtest TSLA mean reversion',
    'market data AAPL',
    'backtest AAPL ema crossover',
  ];

  let state: ReverseSearchState;

  beforeEach(() => {
    state = createReverseSearch(history);
  });

  describe('initial state', () => {
    test('starts inactive', () => {
      expect(state.isSearching).toBe(false);
      expect(state.searchQuery).toBe('');
      expect(state.currentMatch).toBeNull();
      expect(state.matchIndex).toBe(-1);
      expect(state.totalMatches).toBe(0);
    });
  });

  describe('startSearch', () => {
    test('activates search mode', () => {
      state = state.startSearch();
      expect(state.isSearching).toBe(true);
      expect(state.searchQuery).toBe('');
      expect(state.currentMatch).toBeNull();
    });
  });

  describe('updateQuery', () => {
    test('finds first matching entry (case-insensitive)', () => {
      state = state.startSearch();
      state = state.updateQuery('backtest');
      expect(state.currentMatch).toBe('backtest AAPL momentum');
      expect(state.matchIndex).toBe(0);
      expect(state.totalMatches).toBe(3);
    });

    test('case-insensitive matching', () => {
      state = state.startSearch();
      state = state.updateQuery('PORTFOLIO');
      expect(state.currentMatch).toBe('show portfolio');
      expect(state.totalMatches).toBe(1);
    });

    test('returns null when no match', () => {
      state = state.startSearch();
      state = state.updateQuery('nonexistent');
      expect(state.currentMatch).toBeNull();
      expect(state.matchIndex).toBe(-1);
      expect(state.totalMatches).toBe(0);
    });

    test('empty query resets match', () => {
      state = state.startSearch();
      state = state.updateQuery('backtest');
      expect(state.currentMatch).not.toBeNull();
      state = state.updateQuery('');
      expect(state.currentMatch).toBeNull();
      expect(state.matchIndex).toBe(-1);
    });

    test('narrows results when query becomes more specific', () => {
      state = state.startSearch();
      state = state.updateQuery('backtest');
      expect(state.totalMatches).toBe(3);
      state = state.updateQuery('backtest AAPL');
      expect(state.totalMatches).toBe(2);
      expect(state.currentMatch).toBe('backtest AAPL momentum');
    });
  });

  describe('cycleNext', () => {
    test('cycles to next older match', () => {
      state = state.startSearch();
      state = state.updateQuery('backtest');
      expect(state.currentMatch).toBe('backtest AAPL momentum');
      expect(state.matchIndex).toBe(0);

      state = state.cycleNext();
      expect(state.currentMatch).toBe('backtest TSLA mean reversion');
      expect(state.matchIndex).toBe(1);

      state = state.cycleNext();
      expect(state.currentMatch).toBe('backtest AAPL ema crossover');
      expect(state.matchIndex).toBe(2);
    });

    test('wraps around to first match after last', () => {
      state = state.startSearch();
      state = state.updateQuery('backtest');
      state = state.cycleNext();
      state = state.cycleNext();
      state = state.cycleNext();
      expect(state.matchIndex).toBe(0);
      expect(state.currentMatch).toBe('backtest AAPL momentum');
    });

    test('does nothing when no matches', () => {
      state = state.startSearch();
      state = state.updateQuery('nonexistent');
      state = state.cycleNext();
      expect(state.currentMatch).toBeNull();
      expect(state.matchIndex).toBe(-1);
    });

    test('does nothing when not searching', () => {
      state = state.cycleNext();
      expect(state.isSearching).toBe(false);
      expect(state.currentMatch).toBeNull();
    });
  });

  describe('stopSearch', () => {
    test('accept=true returns current match', () => {
      state = state.startSearch();
      state = state.updateQuery('portfolio');
      const result = state.stopSearch(true);
      expect(result).toBe('show portfolio');
    });

    test('accept=false returns null', () => {
      state = state.startSearch();
      state = state.updateQuery('portfolio');
      const result = state.stopSearch(false);
      expect(result).toBeNull();
    });

    test('returns null when no match even with accept=true', () => {
      state = state.startSearch();
      state = state.updateQuery('nonexistent');
      const result = state.stopSearch(true);
      expect(result).toBeNull();
    });

    test('returns null when not searching', () => {
      const result = state.stopSearch(true);
      expect(result).toBeNull();
    });
  });

  describe('query editing', () => {
    test('resets matchIndex when query changes', () => {
      state = state.startSearch();
      state = state.updateQuery('backtest');
      state = state.cycleNext();
      expect(state.matchIndex).toBe(1);

      state = state.updateQuery('backtest AAPL');
      expect(state.matchIndex).toBe(0);
      expect(state.currentMatch).toBe('backtest AAPL momentum');
    });
  });

  describe('empty history', () => {
    test('handles empty history gracefully', () => {
      state = createReverseSearch([]);
      state = state.startSearch();
      state = state.updateQuery('anything');
      expect(state.currentMatch).toBeNull();
      expect(state.totalMatches).toBe(0);
      state = state.cycleNext();
      expect(state.currentMatch).toBeNull();
    });
  });
});
