export const HK_MARKET = {
  exchange: 'HKEX',
  currency: 'HKD' as const,
  tradingHours: { open: '09:30', close: '16:00', timezone: 'Asia/Hong_Kong' },
  lunchBreak: { start: '12:00', end: '13:00' },
  settlement: 'T+2',
  lotSizes: new Map<string, number>([
    ['0700.HK', 100],
    ['9988.HK', 100],
    ['0005.HK', 400],
    ['1299.HK', 500],
    ['0941.HK', 500],
    ['2318.HK', 500],
    ['0388.HK', 100],
    ['0001.HK', 500],
    ['0003.HK', 500],
    ['0016.HK', 1000],
  ]),
  defaultLotSize: 100,
};

/**
 * Normalize various HK ticker formats to the canonical `NNNN.HK` form.
 *
 * "700" → "0700.HK", "0700" → "0700.HK", "0700.HK" → "0700.HK"
 */
export function normalizeHkTicker(ticker: string): string {
  const cleaned = ticker.trim().toUpperCase();

  if (cleaned.endsWith('.HK')) {
    const code = cleaned.slice(0, -3);
    return code.padStart(4, '0') + '.HK';
  }

  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 0) {
    throw new Error(`Invalid HK ticker: ${ticker}`);
  }
  return digits.padStart(4, '0') + '.HK';
}

export function getHkLotSize(ticker: string): number {
  const normalized = normalizeHkTicker(ticker);
  return HK_MARKET.lotSizes.get(normalized) ?? HK_MARKET.defaultLotSize;
}

export function isHkMarketOpen(now?: Date): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: HK_MARKET.tradingHours.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(now ?? new Date());
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';

  if (['Sat', 'Sun'].includes(weekday)) return false;

  const timeStr = `${hour}:${minute}`;
  const { open, close } = HK_MARKET.tradingHours;
  const { start: lunchStart, end: lunchEnd } = HK_MARKET.lunchBreak;

  if (timeStr < open || timeStr >= close) return false;
  if (timeStr >= lunchStart && timeStr < lunchEnd) return false;

  return true;
}
