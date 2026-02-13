import { describe, test, expect } from 'bun:test';
import { renderContextBar, formatTokenCount, getContextPercentage } from '../context-bar.js';

describe('getContextPercentage', () => {
  test('returns 0 when no tokens used', () => {
    expect(getContextPercentage(0, 150_000)).toBe(0);
  });

  test('returns correct percentage', () => {
    expect(getContextPercentage(67_500, 150_000)).toBe(45);
  });

  test('returns 100 when fully used', () => {
    expect(getContextPercentage(150_000, 150_000)).toBe(100);
  });

  test('caps at 100 when over budget', () => {
    expect(getContextPercentage(200_000, 150_000)).toBe(100);
  });

  test('returns 0 when maxTokens is 0', () => {
    expect(getContextPercentage(100, 0)).toBe(0);
  });
});

describe('formatTokenCount', () => {
  test('formats small numbers without commas', () => {
    expect(formatTokenCount(500)).toBe('500');
  });

  test('formats thousands with commas', () => {
    expect(formatTokenCount(67_500)).toBe('67,500');
  });

  test('formats large numbers with commas', () => {
    expect(formatTokenCount(150_000)).toBe('150,000');
  });

  test('formats zero', () => {
    expect(formatTokenCount(0)).toBe('0');
  });
});

describe('renderContextBar', () => {
  test('renders empty bar at 0%', () => {
    const bar = renderContextBar(0, 150_000, 30);
    expect(bar).toBe('[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0% (0 / 150,000)');
  });

  test('renders full bar at 100%', () => {
    const bar = renderContextBar(150_000, 150_000, 30);
    expect(bar).toBe('[██████████████████████████████] 100% (150,000 / 150,000)');
  });

  test('renders partial bar at 50%', () => {
    const bar = renderContextBar(75_000, 150_000, 30);
    expect(bar).toBe('[███████████████░░░░░░░░░░░░░░░] 50% (75,000 / 150,000)');
  });

  test('renders bar at 45%', () => {
    const bar = renderContextBar(67_500, 150_000, 30);
    expect(bar).toContain('45%');
    expect(bar).toContain('67,500');
    expect(bar).toContain('150,000');
  });

  test('uses default width of 30', () => {
    const bar = renderContextBar(75_000, 150_000);
    const match = bar.match(/\[([█░]+)\]/);
    expect(match).not.toBeNull();
    expect(match![1].length).toBe(30);
  });

  test('respects custom width', () => {
    const bar = renderContextBar(50_000, 100_000, 20);
    const match = bar.match(/\[([█░]+)\]/);
    expect(match).not.toBeNull();
    expect(match![1].length).toBe(20);
  });

  test('handles edge case of very small usage', () => {
    const bar = renderContextBar(1, 150_000, 30);
    expect(bar).toContain('0%');
    expect(bar).toContain('1');
  });
});
