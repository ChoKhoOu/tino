import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { classifyShortcut, shouldTreatAsMultiline } from '../useKeyboardShortcuts.js';

describe('classifyShortcut', () => {
  test('returns clear_screen for Ctrl+L', () => {
    expect(classifyShortcut('l', { ctrl: true })).toBe('clear_screen');
  });

  test('returns exit for Ctrl+D', () => {
    expect(classifyShortcut('d', { ctrl: true })).toBe('exit');
  });

  test('returns null for Ctrl+C (not handled by this hook)', () => {
    expect(classifyShortcut('c', { ctrl: true })).toBeNull();
  });

  test('returns null for regular characters', () => {
    expect(classifyShortcut('a', {})).toBeNull();
    expect(classifyShortcut('l', {})).toBeNull();
    expect(classifyShortcut('d', {})).toBeNull();
  });

  test('returns null for escape key', () => {
    expect(classifyShortcut('', { escape: true })).toBeNull();
  });

  test('returns null for return key', () => {
    expect(classifyShortcut('', { return: true })).toBeNull();
  });

  test('returns null for other ctrl combinations', () => {
    expect(classifyShortcut('a', { ctrl: true })).toBeNull();
    expect(classifyShortcut('e', { ctrl: true })).toBeNull();
    expect(classifyShortcut('z', { ctrl: true })).toBeNull();
  });
});

describe('shouldTreatAsMultiline', () => {
  test('returns true when text ends with backslash', () => {
    expect(shouldTreatAsMultiline('hello\\')).toBe(true);
  });

  test('returns true when text ends with backslash after spaces', () => {
    expect(shouldTreatAsMultiline('hello \\')).toBe(true);
  });

  test('returns false for empty text', () => {
    expect(shouldTreatAsMultiline('')).toBe(false);
  });

  test('returns false for text without trailing backslash', () => {
    expect(shouldTreatAsMultiline('hello')).toBe(false);
    expect(shouldTreatAsMultiline('hello world')).toBe(false);
  });

  test('returns false when backslash is not at end', () => {
    expect(shouldTreatAsMultiline('hel\\lo')).toBe(false);
  });

  test('returns true for just a backslash', () => {
    expect(shouldTreatAsMultiline('\\')).toBe(true);
  });

  test('returns true for multiline text ending with backslash', () => {
    expect(shouldTreatAsMultiline('line1\nline2\\')).toBe(true);
  });
});
