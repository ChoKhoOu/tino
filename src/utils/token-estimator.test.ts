import { describe, test, expect } from 'bun:test';
import { estimateTokens } from './token-estimator.js';

describe('estimateTokens', () => {
  test('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  test('returns 0 for null/undefined input', () => {
    // @ts-expect-error testing invalid input
    expect(estimateTokens(null)).toBe(0);
    // @ts-expect-error testing invalid input
    expect(estimateTokens(undefined)).toBe(0);
  });

  test('estimates English prose at ~4 chars per token', () => {
    // 100 chars of English prose should produce ~25 tokens
    const text = 'The quick brown fox jumps over the lazy dog and runs across the field to find some food for dinner.';
    const tokens = estimateTokens(text);
    // Should be roughly text.length / 4 (with whitespace adjustment)
    expect(tokens).toBeGreaterThan(15);
    expect(tokens).toBeLessThan(40);
  });

  test('estimates code at ~3.5 chars per token', () => {
    const code = [
      'export function calculateTotal(items: number[]): number {',
      '  const sum = items.reduce((acc, item) => acc + item, 0);',
      '  return Math.round(sum * 100) / 100;',
      '}',
    ].join('\n');
    const tokens = estimateTokens(code);
    // Code is denser - more tokens per character than prose
    expect(tokens).toBeGreaterThan(30);
    expect(tokens).toBeLessThan(70);
  });

  test('estimates CJK text at ~1.5 chars per token', () => {
    // 10 CJK characters should produce ~6-7 tokens
    const cjk = '今天天气很好我们出去玩吧';
    const tokens = estimateTokens(cjk);
    // CJK chars are typically 1-2 tokens each
    expect(tokens).toBeGreaterThan(4);
    expect(tokens).toBeLessThan(15);
  });

  test('handles mixed English and CJK text', () => {
    const mixed = 'Hello 你好 World 世界 Testing 测试';
    const tokens = estimateTokens(mixed);
    // Should account for both ASCII and CJK portions
    expect(tokens).toBeGreaterThan(5);
    expect(tokens).toBeLessThan(20);
  });

  test('handles JSON data (code-like density)', () => {
    const json = JSON.stringify({
      ticker: 'AAPL',
      price: 150.25,
      volume: 1000000,
      change: -2.5,
      market_cap: 2500000000000,
    }, null, 2);
    const tokens = estimateTokens(json);
    expect(tokens).toBeGreaterThan(20);
    expect(tokens).toBeLessThan(80);
  });

  test('is more accurate than text.length / 3.5 for English prose', () => {
    // English prose should be closer to /4 than /3.5
    const prose = 'Apple reported strong quarterly earnings with revenue exceeding analyst expectations. The company saw growth across all product categories, particularly in services and wearables. Management remains optimistic about future prospects despite ongoing supply chain challenges in the semiconductor industry.';
    const ourEstimate = estimateTokens(prose);
    const naiveEstimate = Math.ceil(prose.length / 3.5);
    // Our estimate should be lower (fewer tokens) than naive for English prose
    expect(ourEstimate).toBeLessThanOrEqual(naiveEstimate);
  });

  test('is more accurate than text.length / 3.5 for CJK text', () => {
    // CJK should produce more tokens than naive /3.5 estimate
    const cjk = '苹果公司今天发布了最新的季度财报，显示营收超出分析师预期。公司在所有产品类别中都实现了增长。';
    const ourEstimate = estimateTokens(cjk);
    const naiveEstimate = Math.ceil(cjk.length / 3.5);
    // Our estimate should be higher (more tokens) than naive for CJK
    expect(ourEstimate).toBeGreaterThanOrEqual(naiveEstimate);
  });

  test('handles very long text without performance issues', () => {
    const longText = 'The financial market analysis shows significant trends. '.repeat(1000);
    const start = Date.now();
    const tokens = estimateTokens(longText);
    const elapsed = Date.now() - start;
    
    expect(tokens).toBeGreaterThan(10000);
    expect(elapsed).toBeLessThan(100); // Should complete in <100ms
  });
});
