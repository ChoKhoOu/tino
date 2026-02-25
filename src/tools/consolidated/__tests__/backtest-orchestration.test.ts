import { describe, test, expect } from 'bun:test';
import { buildSystemPrompt } from '@/runtime/prompt-builder.js';
import { BACKTEST_ORCHESTRATION_GUIDE } from '@/tools/descriptions/backtest-orchestration.js';
import { STRATEGY_LAB_DESCRIPTION } from '@/tools/descriptions/strategy-lab.js';

describe('backtest orchestration', () => {
  describe('prompt-builder includes orchestration section', () => {
    const prompt = buildSystemPrompt('(test tool descriptions)');

    test('system prompt contains Backtest Orchestration header', () => {
      expect(prompt).toContain('## Backtest Orchestration');
    });

    test('system prompt contains the full orchestration guide', () => {
      expect(prompt).toContain(BACKTEST_ORCHESTRATION_GUIDE);
    });

    test('orchestration guide appears after Financial Tools section', () => {
      const financialIdx = prompt.indexOf('### Financial Tools');
      const orchestrationIdx = prompt.indexOf('## Backtest Orchestration');
      expect(financialIdx).toBeGreaterThan(-1);
      expect(orchestrationIdx).toBeGreaterThan(financialIdx);
    });

    test('orchestration guide appears before Safety Constraints section', () => {
      const orchestrationIdx = prompt.indexOf('## Backtest Orchestration');
      const safetyIdx = prompt.indexOf('## Safety Constraints');
      expect(orchestrationIdx).toBeGreaterThan(-1);
      expect(safetyIdx).toBeGreaterThan(orchestrationIdx);
    });
  });

  describe('orchestration guide content', () => {
    test('contains all 6 pipeline steps', () => {
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('### Step 1: Parse Intent');
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('### Step 2: Fetch Data');
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('### Step 3: Generate Strategy');
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('### Step 4: Run Backtest');
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('### Step 5: Analyze Results');
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('### Step 6: Suggest Optimizations');
    });

    test('contains Strategy Keyword Mapping table', () => {
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('### Strategy Keyword Mapping');
    });

    test('contains Default Parameter Inference section', () => {
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('### Default Parameter Inference');
    });

    test('contains Sharpe Ratio thresholds', () => {
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('Sharpe Ratio thresholds');
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('> 2.0');
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('< 0.5');
    });

    test('contains Max Drawdown thresholds', () => {
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('Max Drawdown thresholds');
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('< 10%');
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('> 30%');
    });

    test('contains Win Rate context', () => {
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('Win Rate context');
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('profit factor');
    });

    test('references correct tool names', () => {
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('market_data');
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('strategy_lab');
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain('trading_sim');
    });

    test('instructs no intermediate user confirmations', () => {
      expect(BACKTEST_ORCHESTRATION_GUIDE).toContain(
        'Do not ask the user for intermediate confirmations',
      );
    });
  });

  describe('strategy keyword mapping', () => {
    const keywordTests: Array<{ keywords: string[]; expectedType: string }> = [
      { keywords: ['RSI', 'oversold', 'overbought', 'relative strength'], expectedType: 'momentum' },
      { keywords: ['moving average', 'SMA', 'EMA', 'crossover', 'golden cross'], expectedType: 'trend' },
      { keywords: ['mean reversion', 'bollinger', 'bands'], expectedType: 'mean_reversion' },
      { keywords: ['grid', 'grid trading', 'range trading'], expectedType: 'grid' },
      { keywords: ['arbitrage', 'spread', 'pairs'], expectedType: 'arbitrage' },
      { keywords: ['MACD', 'signal line', 'histogram'], expectedType: 'momentum' },
      { keywords: ['breakout', 'channel', 'support', 'resistance'], expectedType: 'trend' },
    ];

    for (const { keywords, expectedType } of keywordTests) {
      test(`keywords [${keywords.join(', ')}] map to ${expectedType}`, () => {
        for (const keyword of keywords) {
          // The keyword should appear in the same row as the strategy type
          const lines = BACKTEST_ORCHESTRATION_GUIDE.split('\n');
          const matchingLine = lines.find(
            (line) => line.includes(keyword) && line.includes(expectedType),
          );
          expect(matchingLine).toBeDefined();
        }
      });
    }
  });

  describe('result interpretation thresholds', () => {
    test('Sharpe ratio has 4 tiers', () => {
      const sharpeSection = BACKTEST_ORCHESTRATION_GUIDE.slice(
        BACKTEST_ORCHESTRATION_GUIDE.indexOf('**Sharpe Ratio thresholds:**'),
        BACKTEST_ORCHESTRATION_GUIDE.indexOf('**Max Drawdown thresholds:**'),
      );
      expect(sharpeSection).toContain('Excellent');
      expect(sharpeSection).toContain('Good');
      expect(sharpeSection).toContain('Mediocre');
      expect(sharpeSection).toContain('Poor');
    });

    test('Max Drawdown has 4 tiers', () => {
      const ddSection = BACKTEST_ORCHESTRATION_GUIDE.slice(
        BACKTEST_ORCHESTRATION_GUIDE.indexOf('**Max Drawdown thresholds:**'),
        BACKTEST_ORCHESTRATION_GUIDE.indexOf('**Win Rate context:**'),
      );
      expect(ddSection).toContain('Conservative');
      expect(ddSection).toContain('Moderate');
      expect(ddSection).toContain('Aggressive');
      expect(ddSection).toContain('Dangerous');
    });
  });

  describe('strategy-lab description enhancements', () => {
    test('contains Natural Language Mapping section', () => {
      expect(STRATEGY_LAB_DESCRIPTION).toContain('## Natural Language Mapping');
    });

    test('contains Connecting to Backtest section', () => {
      expect(STRATEGY_LAB_DESCRIPTION).toContain('## Connecting to Backtest');
    });

    test('contains parameter defaults by strategy type', () => {
      expect(STRATEGY_LAB_DESCRIPTION).toContain('Parameter defaults by strategy type');
      expect(STRATEGY_LAB_DESCRIPTION).toContain('momentum');
      expect(STRATEGY_LAB_DESCRIPTION).toContain('trend');
      expect(STRATEGY_LAB_DESCRIPTION).toContain('mean_reversion');
      expect(STRATEGY_LAB_DESCRIPTION).toContain('grid');
      expect(STRATEGY_LAB_DESCRIPTION).toContain('arbitrage');
    });

    test('references trading_sim for backtest connection', () => {
      expect(STRATEGY_LAB_DESCRIPTION).toContain('trading_sim');
    });
  });
});
