import { describe, test, expect } from 'bun:test';
import { sparklineData } from './Sparkline.js';
import { formatColoredValue } from './ColoredTable.js';
import { scaleBarWidths, formatCompactNumber } from './BarChart.js';
import { colors } from '../../theme.js';

// ---------------------------------------------------------------------------
// sparklineData
// ---------------------------------------------------------------------------

describe('sparklineData', () => {
  test('returns correct Unicode blocks for ascending data', () => {
    const result = sparklineData([1, 2, 3, 4, 5]);
    expect(result).toBe('▁▃▅▆█');
  });

  test('returns all same blocks for constant data', () => {
    const result = sparklineData([5, 5, 5]);
    // When range is 0, all values map to the lowest block
    expect(result).toBe('▁▁▁');
  });

  test('returns lowest block for single zero', () => {
    const result = sparklineData([0]);
    expect(result).toBe('▁');
  });

  test('returns empty string for empty data', () => {
    expect(sparklineData([])).toBe('');
  });

  test('handles two-element data', () => {
    const result = sparklineData([0, 100]);
    expect(result).toBe('▁█');
  });

  test('handles negative numbers', () => {
    const result = sparklineData([-10, 0, 10]);
    expect(result).toBe('▁▅█');
  });
});

// ---------------------------------------------------------------------------
// formatColoredValue
// ---------------------------------------------------------------------------

describe('formatColoredValue', () => {
  test('positive numbers get green (success) color', () => {
    const { color } = formatColoredValue('12.5%');
    expect(color).toBe(colors.success);
  });

  test('negative numbers get red (error) color', () => {
    const { color } = formatColoredValue('-3.2%');
    expect(color).toBe(colors.error);
  });

  test('zero gets muted color', () => {
    const { color } = formatColoredValue('0');
    expect(color).toBe(colors.muted);
  });

  test('non-numeric text gets white color', () => {
    const { color } = formatColoredValue('AAPL');
    expect(color).toBe(colors.white);
  });

  test('parenthesized numbers treated as negative', () => {
    const { color } = formatColoredValue('(1,234)');
    expect(color).toBe(colors.error);
  });

  test('preserves original text', () => {
    const { text } = formatColoredValue('  $12.50  ');
    expect(text).toBe('  $12.50  ');
  });
});

// ---------------------------------------------------------------------------
// scaleBarWidths
// ---------------------------------------------------------------------------

describe('scaleBarWidths', () => {
  test('scales bars relative to max absolute value', () => {
    const result = scaleBarWidths([100, 50, 25], 40);
    expect(result[0].width).toBe(40);
    expect(result[1].width).toBe(20);
    expect(result[2].width).toBe(10);
  });

  test('marks positive and negative values correctly', () => {
    const result = scaleBarWidths([10, -5], 40);
    expect(result[0].isPositive).toBe(true);
    expect(result[1].isPositive).toBe(false);
  });

  test('returns empty array for empty input', () => {
    expect(scaleBarWidths([], 40)).toEqual([]);
  });

  test('handles all zeros', () => {
    const result = scaleBarWidths([0, 0, 0], 40);
    result.forEach((r) => {
      expect(r.width).toBe(0);
      expect(r.isPositive).toBe(true);
    });
  });

  test('minimum bar width is 1 for non-zero values', () => {
    const result = scaleBarWidths([1000, 1], 40);
    expect(result[1].width).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// formatCompactNumber
// ---------------------------------------------------------------------------

describe('formatCompactNumber', () => {
  test('formats trillions', () => {
    expect(formatCompactNumber(1_500_000_000_000)).toBe('1.5T');
  });

  test('formats billions', () => {
    expect(formatCompactNumber(2_300_000_000)).toBe('2.3B');
  });

  test('formats millions', () => {
    expect(formatCompactNumber(4_700_000)).toBe('4.7M');
  });

  test('formats thousands', () => {
    expect(formatCompactNumber(8_500)).toBe('8.5K');
  });

  test('formats small numbers', () => {
    expect(formatCompactNumber(42)).toBe('42.0');
  });

  test('formats negative numbers with sign', () => {
    expect(formatCompactNumber(-1_200_000)).toBe('-1.2M');
  });

  test('formats zero', () => {
    expect(formatCompactNumber(0)).toBe('0.0');
  });
});
