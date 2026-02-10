import { describe, expect, test } from 'bun:test';
import { formatCompactNumber, scaleBarWidths, sparklineData } from '../../components/charts/index.js';

describe('chart data workflow integration', () => {
  test('sparklineData transforms financial price series to sparkline', () => {
    const aaplPrices = [182.41, 183.2, 181.95, 184.76, 187.1, 186.42, 188.9];
    const sparkline = sparklineData(aaplPrices);

    expect(sparkline.length).toBe(aaplPrices.length);
    expect(sparkline).toMatch(/^[▁▂▃▄▅▆▇█]+$/);
  });

  test('scaleBarWidths scales portfolio allocation data correctly', () => {
    const allocations = [45, 25, 15, 10, 5];
    const scaled = scaleBarWidths(allocations, 40);

    expect(scaled).toHaveLength(allocations.length);
    expect(scaled[0].width).toBe(40);
    expect(scaled[0].isPositive).toBe(true);
    expect(scaled[4].width).toBeGreaterThan(0);
    expect(scaled[4].width).toBeLessThan(scaled[0].width);
  });

  test('formatCompactNumber formats large financial values', () => {
    expect(formatCompactNumber(2_350_000_000_000)).toBe('2.4T');
    expect(formatCompactNumber(912_400_000)).toBe('912.4M');
    expect(formatCompactNumber(16_250_000)).toBe('16.3M');
  });
});
