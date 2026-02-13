import { useState, useCallback } from 'react';

export interface ReverseSearchState {
  isSearching: boolean;
  searchQuery: string;
  currentMatch: string | null;
  matchIndex: number;
  totalMatches: number;
  startSearch: () => ReverseSearchState;
  stopSearch: (accept: boolean) => string | null;
  updateQuery: (query: string) => ReverseSearchState;
  cycleNext: () => ReverseSearchState;
}

function findMatches(history: string[], query: string): string[] {
  if (!query) return [];
  const lower = query.toLowerCase();
  return history.filter(entry => entry.toLowerCase().includes(lower));
}

export function createReverseSearch(history: string[]): ReverseSearchState {
  return createState(history, false, '', -1);
}

function createState(
  history: string[],
  isSearching: boolean,
  searchQuery: string,
  matchIndex: number,
): ReverseSearchState {
  const matches = findMatches(history, searchQuery);
  const totalMatches = matches.length;
  const safeIndex = totalMatches > 0 && matchIndex >= 0
    ? matchIndex % totalMatches
    : (totalMatches > 0 && searchQuery ? 0 : -1);
  const currentMatch = safeIndex >= 0 ? matches[safeIndex] ?? null : null;
  const resolvedIndex = searchQuery && totalMatches === 0 ? -1 : safeIndex;

  return {
    isSearching,
    searchQuery,
    currentMatch: isSearching ? currentMatch : null,
    matchIndex: isSearching ? resolvedIndex : -1,
    totalMatches: isSearching ? totalMatches : 0,

    startSearch() {
      return createState(history, true, '', -1);
    },

    stopSearch(accept: boolean): string | null {
      if (!isSearching) return null;
      return accept ? currentMatch : null;
    },

    updateQuery(query: string): ReverseSearchState {
      if (!isSearching) return this;
      return createState(history, true, query, query ? 0 : -1);
    },

    cycleNext(): ReverseSearchState {
      if (!isSearching || totalMatches === 0) return this;
      const next = (resolvedIndex + 1) % totalMatches;
      return createState(history, true, searchQuery, next);
    },
  };
}

export interface UseReverseSearchResult {
  isSearching: boolean;
  searchQuery: string;
  currentMatch: string | null;
  matchIndex: number;
  totalMatches: number;
  startSearch: () => void;
  stopSearch: (accept: boolean) => string | null;
  updateQuery: (query: string) => void;
  cycleNext: () => void;
}

export function useReverseSearch(history: string[]): UseReverseSearchResult {
  const [state, setState] = useState<ReverseSearchState>(() => createReverseSearch(history));

  const startSearch = useCallback(() => {
    setState(prev => prev.startSearch());
  }, []);

  const stopSearch = useCallback((accept: boolean): string | null => {
    let result: string | null = null;
    setState(prev => {
      result = prev.stopSearch(accept);
      return createReverseSearch(history);
    });
    return result;
  }, [history]);

  const updateQuery = useCallback((query: string) => {
    setState(prev => prev.updateQuery(query));
  }, []);

  const cycleNext = useCallback(() => {
    setState(prev => prev.cycleNext());
  }, []);

  return {
    isSearching: state.isSearching,
    searchQuery: state.searchQuery,
    currentMatch: state.currentMatch,
    matchIndex: state.matchIndex,
    totalMatches: state.totalMatches,
    startSearch,
    stopSearch,
    updateQuery,
    cycleNext,
  };
}
