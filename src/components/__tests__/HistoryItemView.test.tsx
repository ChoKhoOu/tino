import { describe, test, expect } from 'bun:test';
import { formatTurnStats, formatDuration } from '../HistoryItemView.js';

describe('formatDuration', () => {
  test('sub-second shows milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  test('exactly 1 second', () => {
    expect(formatDuration(1000)).toBe('1s');
  });

  test('seconds only for < 60s', () => {
    expect(formatDuration(45000)).toBe('45s');
  });

  test('minutes and seconds for >= 60s', () => {
    expect(formatDuration(91000)).toBe('1m 31s');
  });

  test('rounds to nearest second', () => {
    expect(formatDuration(1500)).toBe('2s');
  });
});

describe('formatTurnStats', () => {
  test('formats duration, tokens with commas, and throughput', () => {
    const result = formatTurnStats(10000, { totalTokens: 5000 });
    expect(result).toBe('10s · 5,000 tokens · (500.0 tok/s)');
  });

  test('formats with minutes duration', () => {
    const result = formatTurnStats(91000, { totalTokens: 12345 });
    expect(result).toBe('1m 31s · 12,345 tokens · (135.7 tok/s)');
  });

  test('omits throughput when duration is zero', () => {
    const result = formatTurnStats(0, { totalTokens: 100 });
    expect(result).toBe('0ms · 100 tokens');
  });

  test('handles sub-second duration', () => {
    const result = formatTurnStats(500, { totalTokens: 250 });
    expect(result).toBe('500ms · 250 tokens · (500.0 tok/s)');
  });

  test('formats large token counts with commas', () => {
    const result = formatTurnStats(60000, { totalTokens: 1234567 });
    expect(result).toBe('1m 0s · 1,234,567 tokens · (20576.1 tok/s)');
  });

  test('handles zero tokens', () => {
    const result = formatTurnStats(5000, { totalTokens: 0 });
    expect(result).toBe('5s · 0 tokens · (0.0 tok/s)');
  });
});
