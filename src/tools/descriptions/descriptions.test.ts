import { describe, test, expect } from 'bun:test';
import {
  MARKET_DATA_DESCRIPTION,
  FUNDAMENTALS_DESCRIPTION,
  FILINGS_DESCRIPTION,
  MACRO_DATA_DESCRIPTION,
  QUANT_COMPUTE_DESCRIPTION,
  TRADING_SIM_DESCRIPTION,
  TRADING_LIVE_DESCRIPTION,
  STRATEGY_LAB_DESCRIPTION,
  WEB_SEARCH_DESCRIPTION,
  BROWSER_DESCRIPTION,
  PORTFOLIO_DESCRIPTION,
  CHART_DESCRIPTION,
  STREAMING_DESCRIPTION,
  READ_DESCRIPTION,
  WRITE_DESCRIPTION,
  EDIT_DESCRIPTION,
  BASH_DESCRIPTION,
  GREP_DESCRIPTION,
  GLOB_DESCRIPTION,
  LSP_DESCRIPTION,
  TASK_DESCRIPTION,
  TODO_DESCRIPTION,
  QUESTION_DESCRIPTION,
} from './index.js';

const ALL_DESCRIPTIONS: Record<string, string> = {
  MARKET_DATA_DESCRIPTION,
  FUNDAMENTALS_DESCRIPTION,
  FILINGS_DESCRIPTION,
  MACRO_DATA_DESCRIPTION,
  QUANT_COMPUTE_DESCRIPTION,
  TRADING_SIM_DESCRIPTION,
  TRADING_LIVE_DESCRIPTION,
  STRATEGY_LAB_DESCRIPTION,
  WEB_SEARCH_DESCRIPTION,
  BROWSER_DESCRIPTION,
  PORTFOLIO_DESCRIPTION,
  CHART_DESCRIPTION,
  STREAMING_DESCRIPTION,
  READ_DESCRIPTION,
  WRITE_DESCRIPTION,
  EDIT_DESCRIPTION,
  BASH_DESCRIPTION,
  GREP_DESCRIPTION,
  GLOB_DESCRIPTION,
  LSP_DESCRIPTION,
  TASK_DESCRIPTION,
  TODO_DESCRIPTION,
  QUESTION_DESCRIPTION,
};

const NEW_DESCRIPTIONS: Record<string, string> = {
  READ_DESCRIPTION,
  WRITE_DESCRIPTION,
  EDIT_DESCRIPTION,
  BASH_DESCRIPTION,
  GREP_DESCRIPTION,
  GLOB_DESCRIPTION,
  LSP_DESCRIPTION,
  TASK_DESCRIPTION,
  TODO_DESCRIPTION,
  QUESTION_DESCRIPTION,
};

describe('tool descriptions', () => {
  test('exports exactly 23 descriptions', () => {
    expect(Object.keys(ALL_DESCRIPTIONS)).toHaveLength(23);
  });

  test('new batch has exactly 10 descriptions', () => {
    expect(Object.keys(NEW_DESCRIPTIONS)).toHaveLength(10);
  });

  for (const [name, description] of Object.entries(ALL_DESCRIPTIONS)) {
    describe(name, () => {
      test('is a non-empty string with length > 50', () => {
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(50);
      });

      test('is trimmed (no leading/trailing whitespace)', () => {
        expect(description).toBe(description.trim());
      });
    });
  }

  for (const [name, description] of Object.entries(NEW_DESCRIPTIONS)) {
    describe(`${name} (structured)`, () => {
      test('contains "When to Use"', () => {
        expect(description).toContain('When to Use');
      });

      test('contains "When NOT to Use"', () => {
        expect(description).toContain('When NOT to Use');
      });

      test('contains "Usage Notes"', () => {
        expect(description).toContain('Usage Notes');
      });
    });
  }
});
