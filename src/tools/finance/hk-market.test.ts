import { describe, test, expect } from 'bun:test';
import { normalizeHkTicker, getHkLotSize, isHkMarketOpen, HK_MARKET } from './hk-market.js';

describe('normalizeHkTicker', () => {
  test('pads short numeric codes', () => {
    expect(normalizeHkTicker('700')).toBe('0700.HK');
  });

  test('pads 4-digit codes without suffix', () => {
    expect(normalizeHkTicker('0700')).toBe('0700.HK');
  });

  test('passes through already-normalized tickers', () => {
    expect(normalizeHkTicker('0700.HK')).toBe('0700.HK');
  });

  test('handles lowercase suffix', () => {
    expect(normalizeHkTicker('0700.hk')).toBe('0700.HK');
  });

  test('pads short tickers with .HK suffix', () => {
    expect(normalizeHkTicker('5.HK')).toBe('0005.HK');
  });

  test('throws on empty/invalid input', () => {
    expect(() => normalizeHkTicker('ABC')).toThrow('Invalid HK ticker');
  });

  test('handles whitespace', () => {
    expect(normalizeHkTicker('  700  ')).toBe('0700.HK');
  });
});

describe('getHkLotSize', () => {
  test('returns known lot size for Tencent', () => {
    expect(getHkLotSize('0700.HK')).toBe(100);
  });

  test('returns known lot size for HSBC', () => {
    expect(getHkLotSize('0005.HK')).toBe(400);
  });

  test('returns default lot size for unknown ticker', () => {
    expect(getHkLotSize('9999.HK')).toBe(HK_MARKET.defaultLotSize);
  });

  test('normalizes ticker before lookup', () => {
    expect(getHkLotSize('700')).toBe(100);
  });
});

describe('isHkMarketOpen', () => {
  function hkTime(hour: number, minute: number, weekday: number): Date {
    const d = new Date();
    const hkNow = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' }));
    const diff = weekday - hkNow.getDay();
    hkNow.setDate(hkNow.getDate() + diff);
    hkNow.setHours(hour, minute, 0, 0);

    const utcTarget = new Date(
      hkNow.getTime() - (hkNow.getTimezoneOffset() * 60000) +
      (new Date().getTimezoneOffset() * 60000)
    );

    const offset = 8 * 60;
    const localOffset = new Date().getTimezoneOffset();
    const diffMs = (offset + localOffset) * 60000;
    return new Date(hkNow.getTime() - diffMs);
  }

  test('returns true during morning session (10:00 HK time on weekday)', () => {
    const monday10am = hkTime(10, 0, 1);
    expect(isHkMarketOpen(monday10am)).toBe(true);
  });

  test('returns false during lunch break (12:30 HK time)', () => {
    const monday1230 = hkTime(12, 30, 1);
    expect(isHkMarketOpen(monday1230)).toBe(false);
  });

  test('returns true during afternoon session (14:00 HK time)', () => {
    const monday2pm = hkTime(14, 0, 1);
    expect(isHkMarketOpen(monday2pm)).toBe(true);
  });

  test('returns false before market open (08:00 HK time)', () => {
    const monday8am = hkTime(8, 0, 1);
    expect(isHkMarketOpen(monday8am)).toBe(false);
  });

  test('returns false on Saturday', () => {
    const saturday10am = hkTime(10, 0, 6);
    expect(isHkMarketOpen(saturday10am)).toBe(false);
  });

  test('returns false on Sunday', () => {
    const sunday10am = hkTime(10, 0, 0);
    expect(isHkMarketOpen(sunday10am)).toBe(false);
  });

  test('returns false after market close (16:30 HK time)', () => {
    const monday430pm = hkTime(16, 30, 1);
    expect(isHkMarketOpen(monday430pm)).toBe(false);
  });
});
